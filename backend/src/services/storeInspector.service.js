import logger from "../config/logger.js";
import dbStore from "../config/db_store.js";
import storeService from "../modules/store/storeService.js";
import moment from "moment-timezone";
import { formatNumber } from "../utils/numberUtils.js";
import { analyzeAcostChange, analyzeKonversiDetail } from "../modules/penyesuaian/analyzer/index.js";

const MSTRA_CATEGORIES = [
  { key: "trfin", label: "TRFIN", mapping: "trfin", match: r => r.RTYPE === "BPB" || r.RTYPE === "I" },
  { key: "trfout", label: "TRFOUT", mapping: "trfout", match: r => r.RTYPE === "K" || r.RTYPE === "O" },
  { key: "adj", label: "ADJ", mapping: "adj", match: r => r.RTYPE === "X" && r.ISTYPE !== "BA" && r.ISTYPE !== "BS" },
  { key: "ba", label: "BA", mapping: "ba", match: r => r.RTYPE === "X" && r.ISTYPE === "BA" },
  { key: "bs", label: "BS", mapping: "bs", match: r => r.RTYPE === "X" && r.ISTYPE === "BS" },
  { key: "other", label: "LAINNYA", mapping: null, match: r => true },
];

const MTRAN_CATEGORIES = [
  { key: "sales", label: "SALES", mapping: "rp_sales", match: r => r.RTYPE === "J" },
  { key: "retur_sales", label: "RETUR SALES", mapping: "rp_retur_sales", match: r => r.RTYPE === "D" },
  { key: "other", label: "LAINNYA", mapping: null, match: r => true },
];

function normalizeKeys(row) {
  const upper = {};
  for (const [k, v] of Object.entries(row)) {
    upper[k.toUpperCase()] = v;
  }
  return { ...row, ...upper };
}

function analyzeMstranRow(qty, gross, acost) {
  const warnings = [];
  const q = Number(qty) || 0;
  const r = Number(gross) || 0;
  const unitPrice = q !== 0 ? r / q : 0;

  if (q !== 0 && r === 0) {
    warnings.push({
      type: "critical",
      text: `QTY ${formatNumber(q)} tapi GROSS = 0 — transaksi tanpa nilai!`,
      deviation: 1,
    });
  }

  if (q !== 0 && r !== 0 && acost > 0) {
    const deviation = Math.abs(unitPrice - acost) / acost;
    if (deviation > 0.5) {
      warnings.push({
        type: "critical",
        text: `Unit price ${formatNumber(unitPrice)} berbeda ${(deviation * 100).toFixed(0)}% dari ACOST ${formatNumber(acost)}`,
        deviation,
      });
    } else if (deviation > 0.1) {
      warnings.push({
        type: "warning",
        text: `Unit price ${formatNumber(unitPrice)} berbeda ${(deviation * 100).toFixed(0)}% dari ACOST ${formatNumber(acost)}`,
        deviation,
      });
    }
  }

  if (q === 0 && r !== 0) {
    warnings.push({ type: "warning", text: `QTY nol tapi GROSS Rp ${formatNumber(r)}` });
  }

  return { unitPrice, qty: q, rupiah: r, warnings };
}

function analyzeMtranRow(qty, hpp, acost) {
  const warnings = [];
  const q = Number(qty) || 0;
  const h = Number(hpp) || 0;
  const unitPrice = h;

  if (q !== 0 && h === 0) {
    warnings.push({
      type: "critical",
      text: `QTY ${formatNumber(q)} tapi HPP = 0 — transaksi tanpa harga pokok!`,
      deviation: 1,
    });
  }

  if (q !== 0 && h !== 0 && acost > 0) {
    const deviation = Math.abs(unitPrice - acost) / acost;
    if (deviation > 0.5) {
      warnings.push({
        type: "critical",
        text: `HPP ${formatNumber(unitPrice)} berbeda ${(deviation * 100).toFixed(0)}% dari ACOST ${formatNumber(acost)}`,
        deviation,
      });
    } else if (deviation > 0.1) {
      warnings.push({
        type: "warning",
        text: `HPP ${formatNumber(unitPrice)} berbeda ${(deviation * 100).toFixed(0)}% dari ACOST ${formatNumber(acost)}`,
        deviation,
      });
    }
  }

  if (q === 0 && h !== 0) {
    warnings.push({ type: "warning", text: `QTY nol tapi HPP Rp ${formatNumber(h)}` });
  }

  const totalValue = q * h;
  return { unitPrice, qty: q, rupiah: totalValue, warnings };
}

function categorizeRows(rows, categories, acost, mode = "mstran") {
  const normalizedRows = rows.map(normalizeKeys);
  const categorized = [];
  const groupData = {};

  for (const cat of categories) {
    groupData[cat.key] = { ...cat, rows: [], totalQty: 0, totalRupiah: 0, warnings: 0 };
  }

  for (const row of normalizedRows) {
    let categoryKey = "other";
    for (const cat of categories) {
      if (cat.match(row)) {
        categoryKey = cat.key;
        break;
      }
    }

    const qty = Number(row.QTY) || 0;
    let analysis;
    if (mode === "mstran") {
      const gross = Number(row.GROSS) || 0;
      analysis = analyzeMstranRow(qty, gross, acost);
    } else {
      const hpp = Number(row.HPP) || 0;
      analysis = analyzeMtranRow(qty, hpp, acost);
    }

    const enriched = {
      ...row,
      _category: categoryKey,
      _warnings: analysis.warnings,
      _unitPrice: analysis.unitPrice,
    };

    groupData[categoryKey].rows.push(enriched);
    groupData[categoryKey].totalQty += analysis.qty;
    groupData[categoryKey].totalRupiah += analysis.rupiah;
    if (analysis.warnings.length > 0) {
      groupData[categoryKey].warnings++;
    }

    categorized.push(enriched);
  }

  const groups = {};
  for (const cat of categories) {
    const g = groupData[cat.key];
    const groupUnitPrice = g.totalQty > 0 ? g.totalRupiah / g.totalQty : 0;
    let groupDeviation = 0;
    if (acost > 0 && groupUnitPrice > 0) {
      groupDeviation = Math.abs(groupUnitPrice - acost) / acost;
    }

    groups[cat.key] = {
      label: g.label,
      mapping: g.mapping,
      count: g.rows.length,
      totalQty: g.totalQty,
      totalRupiah: g.totalRupiah,
      unitPrice: groupUnitPrice,
      deviation: groupDeviation,
      warningCount: g.warnings,
      rows: g.rows,
    };
  }

  return { categorized, groups, totalWarningCount: Object.values(groups).reduce((s, g) => s + g.warningCount, 0) };
}

class StoreInspectorService {
  async inspect({ kdtk, prdcd, periode, begbal }) {
    if (!kdtk || !prdcd) {
      throw new Error("kdtk and prdcd are required");
    }

    await storeService.ensureInitialized();
    const storeInfo = await storeService.getStoreIPHost(kdtk);
    if (!storeInfo) {
      throw new Error(`Store IP not found for ${kdtk}`);
    }

    const connection = await dbStore.createDbStore(storeInfo.dbHost);
    if (!connection) {
      throw new Error(`Failed to connect to store ${kdtk}`);
    }

    let month = null;
    let year = null;
    if (periode) {
      const m = moment(periode, "YYMM");
      month = m.format("MM");
      year = m.format("YYYY");
    }

    try {
      const prodmastQuery = "SELECT * FROM prodmast WHERE prdcd = ? LIMIT 1";
      const [prodmastRows] = await connection.query(prodmastQuery, [prdcd]);
      const rawProdmast = prodmastRows.length > 0 ? prodmastRows[0] : null;
      const prodmast = rawProdmast ? normalizeKeys(rawProdmast) : null;

      const acost = prodmast ? Number(prodmast.ACOST) || Number(prodmast.LCOST) || 0 : 0;

      const mstranQuery = periode
        ? "SELECT * FROM mstran WHERE prdcd = ? AND MONTH(bukti_tgl) = ? AND YEAR(bukti_tgl) = ? ORDER BY addtime"
        : "SELECT * FROM mstran WHERE prdcd = ? ORDER BY addtime";
      const mstranParams = periode ? [prdcd, month, year] : [prdcd];
      const [mstranRows] = await connection.query(mstranQuery, mstranParams);

      const mtranQuery = periode
        ? "SELECT * FROM mtran WHERE PLU = ? AND MONTH(TANGGAL) = ? AND YEAR(TANGGAL) = ? ORDER BY addtime"
        : "SELECT * FROM mtran WHERE PLU = ? ORDER BY addtime";
      const mtranParams = periode ? [prdcd, month, year] : [prdcd];
      const [mtranRows] = await connection.query(mtranQuery, mtranParams);

      let protectRows = [];
      if (prodmast && prodmast.SUPCO && String(prodmast.SUPCO).trim() !== "") {
        const [protectResult] = await connection.query("SELECT * FROM protect WHERE PRDCD = ?", [prdcd]);
        protectRows = protectResult.map(normalizeKeys);
      }

      const mstranAnalysis = categorizeRows(mstranRows, MSTRA_CATEGORIES, acost, "mstran");
      const mtranAnalysis = categorizeRows(mtranRows, MTRAN_CATEGORIES, acost, "mtran");

      const prodmastWarnings = [];
      if (prodmast) {
        if (!Number(prodmast.ACOST)) prodmastWarnings.push("ACOST = 0");
        if (!Number(prodmast.LCOST)) prodmastWarnings.push("LCOST = 0");
        if ((prodmast.SUPCO && String(prodmast.SUPCO).trim() !== "") || prodmast.kons === "K")
          prodmastWarnings.push("BKL item");
      }

      const groupsWithIssues = Object.entries(mstranAnalysis.groups)
        .filter(([, g]) => g.mapping && g.deviation > 0.5)
        .map(([key]) => key);

      // ── Analisis penyebab perubahan ACOST ───────────────────────
      // Gunakan data yang sudah di-fetch, TIDAK membuat query baru.
      const isBkl = Boolean((prodmast?.SUPCO && String(prodmast.SUPCO).trim() !== "") || prodmast?.kons == "K");
      const acostAnalysis = analyzeAcostChange({
        mstranRows: mstranAnalysis.categorized,
        mtranRows: mtranAnalysis.categorized,
        prodmast,
        begbal,
        acostSekarang: acost,
        isBkl,
        protectRow: protectRows.length > 0 ? protectRows[0] : null,
      });

      // ── Deep analysis untuk konversi (KO) ────────────────────────
      // Hanya jika ada perubahan dari sumber konversi_bm dengan ISTYPE='KO'
      if (acostAnalysis.cause === "transaction_evidence" && acostAnalysis.detail?.konversiBm?.changes?.length > 0) {
        const koChanges = acostAnalysis.detail.konversiBm.changes.filter(
          ch => (ch.ref?.ISTYPE || ch.ref?.istype || "").toUpperCase() === "KO",
        );
        if (koChanges.length > 0) {
          let konversiDetail = [];
          try {
            konversiDetail = await traceKonversiChanges(connection, prdcd, koChanges);
          } catch (konvErr) {
            logger.warn(`[storeInspector] Gagal trace konversi untuk ${kdtk}/${prdcd}: ${konvErr.message}`);
          }
          // Attach koDetail ke masing-masing change — selalu set, meskipun match gagal
          for (const ch of acostAnalysis.changes) {
            if (ch.source === "konversi_bm" && (ch.ref?.ISTYPE || ch.ref?.istype || "").toUpperCase() === "KO") {
              // Normalisasi addtime ke string untuk matching konsisten
              const rawAd = ch.ref?.ADDTIME || ch.ref?.addtime;
              const addtimeKo =
                rawAd instanceof Date ? rawAd.toISOString().replace("T", " ").split(".")[0] : String(rawAd || "");

              const match = konversiDetail.find(d => d.addtimeKo === addtimeKo);
              // Fallback: jika match tidak ketemu, set default agar button tetap muncul
              ch.koDetail = match || {
                pluKonv: prdcd,
                addtimeKo,
                found: false,
                kesimpulan: "Gagal mencocokkan data counterpart konversi",
              };
            }
          }
        }
      }

      logger.info(
        `[storeInspector] ${kdtk}/${prdcd} (${periode || "all"}): ` +
          `prodmast=${prodmast ? 1 : 0}, mstran=${mstranRows.length}, mtran=${mtranRows.length}, ` +
          `protect=${protectRows.length}, warnings=${mstranAnalysis.totalWarningCount + mtranAnalysis.totalWarningCount + prodmastWarnings.length}, ` +
          `acostCause=${acostAnalysis.cause}`,
      );

      return {
        prodmast,
        prodmastWarnings,
        mstran: {
          rows: mstranAnalysis.categorized,
          groups: mstranAnalysis.groups,
          totalWarnings: mstranAnalysis.totalWarningCount,
        },
        mtran: {
          rows: mtranAnalysis.categorized,
          groups: mtranAnalysis.groups,
          totalWarnings: mtranAnalysis.totalWarningCount,
        },
        protect: protectRows,
        acost: Number(prodmast?.ACOST) || 0,
        lcost: Number(prodmast?.LCOST) || 0,
        summary: {
          totalWarnings: mstranAnalysis.totalWarningCount + mtranAnalysis.totalWarningCount + prodmastWarnings.length,
          groupsWithIssues,
        },
        acostAnalysis, // field baru — tidak mengubah field lama
      };
    } catch (err) {
      logger.error(`[storeInspector] Error inspecting ${kdtk}/${prdcd}: ${err.message}`);
      throw err;
    } finally {
      try {
        await connection.end();
      } catch (e) {
        logger.warn(`[storeInspector] Connection close error: ${e.message}`);
      }
    }
  }
}

/**
 * Lacak counterpart konversi (KO) — query ke store DB untuk:
 * 1. konversi_plu (cari PLU_ASAL)
 * 2. mstran PLU_ASAL (cari KO yang mendahului + BPB)
 * 3. prodmast PLU_ASAL (dapatkan ACOST)
 *
 * CATATAN: Fungsi ini TIDAK throw error. Jika konversi_plu tidak ada
 * atau query gagal, tetap return hasil dengan found:false + addtimeKo
 * agar tombol Detail tetap muncul di frontend.
 */
async function traceKonversiChanges(connection, prdcd, koChanges) {
  const results = [];

  // Query konversi_plu sekali — bungkus try/catch untuk handle table tidak ada
  let konvRows = [];
  try {
    const [rows] = await connection.query("SELECT * FROM konversi_plu WHERE PLU_KONV = ?", [prdcd]);
    konvRows = rows || [];
  } catch (queryErr) {
    logger.warn(
      `[traceKonversi] Gagal query konversi_plu untuk ${prdcd}: ${queryErr.message}. Table mungkin tidak ada.`,
    );
    // Lanjutkan dengan konvRows = [], hasil per-change akan found:false
  }

  for (const change of koChanges) {
    const rawAddtime = change.ref?.ADDTIME || change.ref?.addtime;
    const addtimeKo =
      rawAddtime instanceof Date ? rawAddtime.toISOString().replace("T", " ").split(".")[0] : String(rawAddtime || "");
    if (!addtimeKo) continue;

    if (konvRows.length === 0) {
      results.push({
        pluKonv: prdcd,
        addtimeKo,
        found: false,
        kesimpulan: "PLU_ASAL tidak ditemukan di konversi_plu (table kosong atau tidak ada)",
      });
      continue;
    }

    const pluAsalList = konvRows
      .map(r => r.PLU_ASAL || r.plu_asal)
      .filter(v => v && String(v).trim() !== "");

    if (pluAsalList.length === 0) {
      results.push({
        pluKonv: prdcd,
        addtimeKo,
        found: false,
        kesimpulan: "Tidak ada PLU_ASAL yang valid di konversi_plu",
      });
      continue;
    }

    let mstranAsal = null;
    let matchedPluAsal = null;
    let matchedKonvRow = null;

    try {
      const [mstranAsalRows] = await connection.query(
        `SELECT * FROM mstran
         WHERE PRDCD IN (?) AND RTYPE = 'X' AND ISTYPE = 'KO'
           AND ADDTIME < ?
         ORDER BY ADDTIME DESC
         LIMIT 1`,
        [pluAsalList, addtimeKo],
      );

      mstranAsal = mstranAsalRows && mstranAsalRows.length > 0 ? mstranAsalRows[0] : null;
      if (mstranAsal) {
        matchedPluAsal = String(mstranAsal.PRDCD || mstranAsal.prdcd || "").trim();
        matchedKonvRow = konvRows.find(
          r => String(r.PLU_ASAL || r.plu_asal || "").trim() === matchedPluAsal,
        );
      }
    } catch (mstranErr) {
      logger.warn(`[traceKonversi] Gagal query mstran gabungan untuk ${prdcd} @ ${addtimeKo}: ${mstranErr.message}`);
    }

    if (!mstranAsal || !matchedKonvRow) {
      results.push({
        pluKonv: prdcd,
        addtimeKo,
        found: false,
        kesimpulan: "Tidak ada PLU_ASAL yang cocok — tidak ditemukan transaksi KO asal yang sesuai",
      });
      continue;
    }

    const nilai = Number(matchedKonvRow.NILAI || matchedKonvRow.nilai) || 1;

    try {
      const [bpbAsalRows] = await connection.query(
        `SELECT * FROM mstran
         WHERE PRDCD = ? AND RTYPE = 'BPB'
           AND ADDTIME < ?
         ORDER BY ADDTIME DESC
         LIMIT 1`,
        [matchedPluAsal, addtimeKo],
      );

      const [prodmastAsalRows] = await connection.query(
        "SELECT * FROM prodmast WHERE PRDCD = ? LIMIT 1",
        [matchedPluAsal],
      );

      const [prodmastKonvRows] = await connection.query(
        "SELECT * FROM prodmast WHERE PRDCD = ? LIMIT 1",
        [prdcd],
      );

      const prodRow = prodmastAsalRows && prodmastAsalRows.length > 0 ? prodmastAsalRows[0] : null;
      const prodKonvRow = prodmastKonvRows && prodmastKonvRows.length > 0 ? prodmastKonvRows[0] : null;
      const acostAsal = prodRow ? Number(prodRow.ACOST || prodRow.acost || 0) : 0;

      const analisis = analyzeKonversiDetail({
        pluAsal: matchedPluAsal,
        nilai,
        acostAsal,
        bpbAsal: bpbAsalRows && bpbAsalRows.length > 0 ? bpbAsalRows[0] : null,
        actualPrice: Number(change.ke),
      });

      results.push({
        pluKonv: prdcd,
        pluAsal: matchedPluAsal,
        nilai,
        addtimeKo,
        koAsal: mstranAsal,
        bpbAsal: bpbAsalRows && bpbAsalRows.length > 0 ? bpbAsalRows[0] : null,
        prodmastAsal: prodRow,
        prodmastKonv: prodKonvRow,
        acostAsal,
        actualPrice: Number(change.ke),
        hargaSebelum: Number(change.dari),
        singkatanPluAsal: prodRow ? (prodRow.SINGKATAN || prodRow.singkatan || "") : "",
        singkatanPluKonv: prodKonvRow ? (prodKonvRow.SINGKATAN || prodKonvRow.singkatan || "") : "",
        ...analisis,
        found: true,
      });
    } catch (innerErr) {
      logger.warn(`[traceKonversi] Gagal query detail untuk PLU_ASAL ${matchedPluAsal}: ${innerErr.message}`);
      results.push({
        pluKonv: prdcd,
        addtimeKo,
        found: false,
        kesimpulan: `Gagal mengambil data detail PLU_ASAL ${matchedPluAsal}: ${innerErr.message}`,
      });
    }
  }

  return results;
}

export default new StoreInspectorService();
