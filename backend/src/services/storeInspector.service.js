import logger from "../config/logger.js";
import dbStore from "../config/db_store.js";
import storeService from "../modules/store/storeService.js";
import moment from "moment-timezone";
import { formatNumber } from "../utils/numberUtils.js";

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
  async inspect({ kdtk, prdcd, periode }) {
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
        if (prodmast.SUPCO && String(prodmast.SUPCO).trim() !== "") prodmastWarnings.push("BKL item");
      }

      const groupsWithIssues = Object.entries(mstranAnalysis.groups)
        .filter(([, g]) => g.mapping && g.deviation > 0.5)
        .map(([key]) => key);

      logger.info(
        `[storeInspector] ${kdtk}/${prdcd} (${periode || "all"}): ` +
        `prodmast=${prodmast ? 1 : 0}, mstran=${mstranRows.length}, mtran=${mtranRows.length}, ` +
        `protect=${protectRows.length}, warnings=${mstranAnalysis.totalWarningCount + mtranAnalysis.totalWarningCount + prodmastWarnings.length}`,
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

export default new StoreInspectorService();
