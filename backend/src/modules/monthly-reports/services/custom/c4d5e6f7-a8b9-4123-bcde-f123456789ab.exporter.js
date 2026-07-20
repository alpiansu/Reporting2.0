/**
 * Custom Exporter — Sales Per Dept
 *
 * Menghasilkan file Excel dengan format 3 sheet (ALL, FRC, REG):
 *   - Komparasi periode ini vs periode lalu (7 fields masing-masing)
 *   - Variance/Growth analysis (9 fields)
 *   - Baris NILAI LPM SALES (perbandingan dengan data LPM)
 *   - Baris SELISIH (selisih data sales vs LPM)
 *
 * Juga melakukan persist data ke tabel sales_per_dept di central MySQL
 * agar data history tersimpan untuk komparasi periodik.
 *
 * ─── Data Sources (dari results) ──────────────────────────────────────
 *   NOW_ALL/NOW_REG/NOW_FRC  : Data aggregasi per dept periode ini
 *   PREV_ALL/PREV_REG/PREV_FRC: Data aggregasi per dept periode lalu
 *   LPM_NOW_ALL/LPM_NOW_*   : LPM summary periode ini
 *   LPM_PREV_ALL/LPM_PREV_* : LPM summary periode lalu
 */

import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";
import MCabang from "../../../../models/m_cabang.model.js";
import MDept from "../../../../models/m_dept.model.js";
import SalesPerDept from "../../../../models/sales_per_dept.model.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthNameFull(prd) {
  if (!prd || prd.length !== 4) return prd;
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const year = `20${prd.substring(0, 2)}`;
  const monthIdx = parseInt(prd.substring(2, 4), 10) - 1;
  return `${monthNames[monthIdx] || "?"} ${year}`;
}

function getPrevPrd(prd) {
  if (!prd || prd.length !== 4) return "";
  const yy = parseInt(prd.substring(0, 2), 10);
  const mm = parseInt(prd.substring(2, 4), 10);
  let prevYY = yy;
  let prevMM = mm - 1;
  if (prevMM === 0) {
    prevMM = 12;
    prevYY = yy - 1;
  }
  return `${String(prevYY).padStart(2, "0")}${String(prevMM).padStart(2, "0")}`;
}

function CHR(index) {
  let col = "";
  let i = index;
  while (i >= 0) {
    col = String.fromCharCode(65 + (i % 26)) + col;
    i = Math.floor(i / 26) - 1;
  }
  return col;
}

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

/**
 * Apply border ke SEMUA cell dalam merge range.
 * Excel menentukan border merged cell dari border cell individu di tepi merge range:
 *   - Left edge  = first cell's left border
 *   - Right edge = last cell's right border
 *   - Top edge   = first cell's top border
 *   - Bottom edge= last cell's bottom border
 * Tanpa ini, merged cell hanya punya border di 1 kolom saja.
 */
function applyMergeBorders(sheet, rangeStr, borderStyle) {
  const [startRef, endRef] = rangeStr.split(":");
  const startCell = sheet.getCell(startRef);
  const endCell = sheet.getCell(endRef);
  const startRow = startCell.row;
  const startCol = startCell.col;
  const endRow = endCell.row;
  const endCol = endCell.col;
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      sheet.getCell(r, c).border = borderStyle;
    }
  }
}

const STYLE_HEADER_CELL = {
  font: { bold: true, size: 10 },
  border: THIN_BORDER,
  alignment: { vertical: "middle", horizontal: "center" },
};

const GREEN_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
const YELLOW_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const ORANGE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8CBAD" } };
const BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };
const TOTAL_BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } };
const LPM_YELLOW_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

// ─── Department Lookup ────────────────────────────────────────────────────────

/**
 * Ambil semua department dari m_dept, return Map<dep_kd, dep_nm>
 */
async function getDeptMap() {
  try {
    const departments = await MDept.findAll();
    const map = new Map();
    if (departments && Array.isArray(departments)) {
      departments.forEach(d => {
        const kd = d.dep_kd || d.kode_dept;
        const nm = d.dep_nm || d.nama_dept || "";
        if (kd) map.set(String(kd).trim(), nm);
      });
    }
    return map;
  } catch (err) {
    logger.warn(`[spd_exporter] Gagal load m_dept: ${err.message}`);
    return new Map();
  }
}

// ─── Data Merging ─────────────────────────────────────────────────────────────

/**
 * Merge NOW dan PREV data per department untuk satu tipestore.
 * Hasilnya array objek dengan struktur:
 *   dep_kd, dep_nm,
 *   qty_sales, total_sales, total_hpp, margin_rp, margin_percent,
 *   harga_jual_per_pcs, hpp_per_pcs,
 *   qty_sales2, total_sales2, total_hpp2, margin_rp2, margin_percent2,
 *   harga_jual_per_pcs2, hpp_per_pcs2,
 *   sel_sales, sel_total_sales, sel_margin_rp, sel_margin_percent,
 *   sel_harga_jual_per_pcs, sel_hpp_per_pcs,
 *   sel_kenaikan, faktor_g, faktor_a
 */
function mergeDeptData(deptMap, nowRows, prevRows) {
  const nowMap = new Map();
  const prevMap = new Map();
  const allDeptCodes = new Set();

  if (nowRows && Array.isArray(nowRows)) {
    nowRows.forEach(r => {
      const kd = String(r.dep_kd || "").trim();
      if (kd) {
        nowMap.set(kd, r);
        allDeptCodes.add(kd);
      }
    });
  }
  if (prevRows && Array.isArray(prevRows)) {
    prevRows.forEach(r => {
      const kd = String(r.dep_kd || "").trim();
      if (kd) {
        prevMap.set(kd, r);
        allDeptCodes.add(kd);
      }
    });
  }

  // Jika tidak ada data sama sekali, gunakan semua department dari deptMap
  if (allDeptCodes.size === 0) {
    for (const kd of deptMap.keys()) allDeptCodes.add(kd);
  }

  const result = [];
  const sortedCodes = [...allDeptCodes].sort();

  for (const dep_kd of sortedCodes) {
    if (!dep_kd) continue; // skip empty department codes

    const now = nowMap.get(dep_kd);
    const prev = prevMap.get(dep_kd);

    const deptName = deptMap.has(dep_kd)
      ? deptMap.get(dep_kd)
      : now && now.dep_name
        ? now.dep_name
        : prev && prev.dep_name
          ? prev.dep_name
          : `Department ${dep_kd}`;

    // ── Current Period ──
    const qty = Number(now?.qty_sales ?? 0);
    const sales = Number(now?.total_sales ?? 0);
    const hpp = Number(now?.total_hpp ?? 0);
    const marginRp = sales - hpp;
    const marginPercent = sales > 0 ? (marginRp / sales) * 100 : 0;
    const hargaJual = qty > 0 ? sales / qty : 0;
    const hppPerPcs = qty > 0 ? hpp / qty : 0;

    // ── Previous Period ──
    const qty2 = Number(prev?.qty_sales ?? 0);
    const sales2 = Number(prev?.total_sales ?? 0);
    const hpp2 = Number(prev?.total_hpp ?? 0);
    const marginRp2 = sales2 - hpp2;
    const marginPercent2 = sales2 > 0 ? (marginRp2 / sales2) * 100 : 0;
    const hargaJual2 = qty2 > 0 ? sales2 / qty2 : 0;
    const hppPerPcs2 = qty2 > 0 ? hpp2 / qty2 : 0;

    // ── Variance ──
    const selQty = qty - qty2;
    const selSales = sales - sales2;
    const selMarginRp = marginRp - marginRp2;
    const selMarginPercent = marginPercent - marginPercent2;
    const selHargaJual = hargaJual - hargaJual2;
    const selHppPerPcs = hppPerPcs - hppPerPcs2;
    const selKenaikan = hargaJual - hppPerPcs; // Rp. Selisih Kenaikan Harga jual VS HPP (per pcs)
    const faktorG = selKenaikan * qty; // (FAKTOR G) TO MARGIN
    const faktorA = selQty * (hargaJual2 - hppPerPcs2); // (FAKTOR A) TO MARGIN

    result.push({
      dep_kd,
      dep_nm: deptName,
      qty_sales: qty,
      total_sales: sales,
      total_hpp: hpp,
      margin_rp: marginRp,
      margin_percent: marginPercent,
      harga_jual_per_pcs: hargaJual,
      hpp_per_pcs: hppPerPcs,
      qty_sales2: qty2,
      total_sales2: sales2,
      total_hpp2: hpp2,
      margin_rp2: marginRp2,
      margin_percent2: marginPercent2,
      harga_jual_per_pcs2: hargaJual2,
      hpp_per_pcs2: hppPerPcs2,
      sel_sales: selQty,
      sel_total_sales: selSales,
      sel_margin_rp: selMarginRp,
      sel_margin_percent: selMarginPercent,
      sel_harga_jual_per_pcs: selHargaJual,
      sel_hpp_per_pcs: selHppPerPcs,
      sel_kenaikan: selKenaikan,
      faktor_g: faktorG,
      faktor_a: faktorA,
    });
  }

  return result;
}

// ─── Persist to sales_per_dept ────────────────────────────────────────────────

/**
 * Simpan data periode ini ke tabel sales_per_dept di central MySQL.
 * Menggunakan upsert agar aman jika data sudah ada (update).
 */
async function persistToSalesPerDept(cab, prd, deptMap, nowAll, nowReg, nowFrc) {
  const tipestoreMap = {
    ALL: nowAll,
    REG: nowReg,
    FRC: nowFrc,
  };

  for (const [tipestore, rows] of Object.entries(tipestoreMap)) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      const dep_kd = String(row.dep_kd || "").trim();
      if (!dep_kd) continue;

      const qty = Number(row.qty_sales ?? 0);
      const sales = Number(row.total_sales ?? 0);
      const hpp = Number(row.total_hpp ?? 0);
      const marginRp = sales - hpp;
      const marginPercent = sales > 0 ? (marginRp / sales) * 100 : 0;
      const hargaJual = qty > 0 ? sales / qty : 0;
      const hppPerPcs = qty > 0 ? hpp / qty : 0;
      const deptName = deptMap.has(dep_kd) ? deptMap.get(dep_kd) : row.dep_name || `Department ${dep_kd}`;

      try {
        await SalesPerDept.upsert({
          cab,
          periode: prd,
          tipestore,
          dep_kd,
          dep_name: deptName,
          qty_sales: qty,
          total_sales: sales,
          total_hpp: hpp,
          margin_rp: marginRp,
          margin_percent: Math.round(marginPercent * 100) / 100,
          harga_jual_per_pcs: Math.round(hargaJual * 100) / 100,
          hpp_per_pcs: Math.round(hppPerPcs * 100) / 100,
        });
      } catch (err) {
        logger.error(`[spd_exporter] Gagal persist sales_per_dept: ${err.message}`);
      }
    }
  }

  logger.info(`[spd_exporter] Data sales_per_dept tersimpan: cab=${cab} prd=${prd}`);
}

// ─── Excel Sheet Builder ──────────────────────────────────────────────────────

/**
 * Build satu sheet untuk satu tipestore (ALL / REG / FRC).
 * Layout persis seperti legacy formatXlsxSalesPerDept.js:
 *
 * Row 1: "REKAP SALES PER DEPARTEMEN PRODUK"
 * Row 2: "PERIODE {bulanIni} & {bulanLalu}"
 * Row 3: "CABANG {namaCabang}"
 * Row 4-5: (spacer)
 * Row 6: Merged headers — current month, last month, variance
 * Row 7: Sub-headers (7 + 7 + 9 columns)
 * Row 8+: Data rows
 * Last-2: GRAND TOTAL row
 * Last-1: NILAI LPM SALES row
 * Last: SELISIH row
 */
function buildSheet(sheet, mergedData, tipestore, prd, prdPrev, branchName, lpmNow, lpmPrev) {
  let baris = 1;
  const prdMonth = getMonthNameFull(prd);
  const prdPrevMonth = getMonthNameFull(prdPrev || getPrevPrd(prd));

  // ─── Column Widths ──────────────────────────────────────────────────────────
  const colWidths = [
    2, 14, 28, 3, 10, 16, 16, 16, 16, 16, 16, 3, 16, 16, 16, 16, 16, 16, 16, 3, 16, 16, 16, 16, 16, 16, 16, 16, 16,
  ];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ─── Title ──────────────────────────────────────────────────────────────────
  const titleCell = sheet.getCell(`B${baris}`);
  titleCell.value = "REKAP SALES PER DEPARTEMEN PRODUK";
  titleCell.font = { bold: true, size: 12 };
  baris++;

  // ─── Period ─────────────────────────────────────────────────────────────────
  const periodCell = sheet.getCell(`B${baris}`);
  periodCell.value = `PERIODE ${prdMonth} & ${prdPrevMonth}`;
  periodCell.font = { bold: true, size: 12 };
  baris++;

  // ─── Branch ─────────────────────────────────────────────────────────────────
  const branchCell = sheet.getCell(`B${baris}`);
  branchCell.value = `CABANG ${branchName}`;
  branchCell.font = { bold: true, size: 12 };
  baris++;

  baris++; // spacer
  baris++; // spacer

  const hdrRow = baris; // Row 6 (header row 1)

  // ─── Row 6: Category headers (merged) ───────────────────────────────────────
  // A (col 1): spacer - but we skip it, start from B (col 2)

  // B:C merged 2 rows — "DEPARTEMEN", "KETERANGAN"
  for (let n = 0; n <= 1; n++) {
    const colLetter = CHR(1 + n); // B, C
    sheet.mergeCells(`${colLetter}${hdrRow}:${colLetter}${hdrRow + 1}`);
    const cell = sheet.getCell(`${colLetter}${hdrRow}`);
    cell.value = ["DEPARTEMEN", "KETERANGAN"][n];
    cell.style = { ...STYLE_HEADER_CELL, fill: GREEN_FILL };
    cell.border = THIN_BORDER;
  }
  applyMergeBorders(sheet, `B${hdrRow}:B${hdrRow + 1}`, THIN_BORDER);
  applyMergeBorders(sheet, `C${hdrRow}:C${hdrRow + 1}`, THIN_BORDER);

  // D (col 4): spacer column — skip

  // E:K merged → Current month period name
  sheet.mergeCells(`E${hdrRow}:K${hdrRow}`);
  let cell = sheet.getCell(`E${hdrRow}`);
  cell.value = prdMonth;
  cell.style = { ...STYLE_HEADER_CELL, fill: YELLOW_FILL };
  cell.border = THIN_BORDER;
  applyMergeBorders(sheet, `E${hdrRow}:K${hdrRow}`, THIN_BORDER);

  // M:S merged → Last month period name
  sheet.mergeCells(`M${hdrRow}:S${hdrRow}`);
  cell = sheet.getCell(`M${hdrRow}`);
  cell.value = prdPrevMonth;
  cell.style = { ...STYLE_HEADER_CELL, fill: ORANGE_FILL };
  applyMergeBorders(sheet, `M${hdrRow}:S${hdrRow}`, THIN_BORDER);

  // U:AC merged → "VARIANCE / GROWTH"
  sheet.mergeCells(`U${hdrRow}:AC${hdrRow}`);
  cell = sheet.getCell(`U${hdrRow}`);
  cell.value = "VARIANCE / GROWTH";
  cell.style = { ...STYLE_HEADER_CELL, fill: BLUE_FILL };
  applyMergeBorders(sheet, `U${hdrRow}:AC${hdrRow}`, THIN_BORDER);

  // ─── Row 7: Sub-headers ────────────────────────────────────────────────────
  baris = hdrRow + 1;

  // Sub-headers array (25 items, starting from column E/col 5)
  const subHeaders = [
    "Qty Sales", // E (col 5)
    "Sales", // F (col 6)
    "HPP", // G (col 7)
    "Margin Rp", // H (col 8)
    "Margin %", // I (col 9)
    "Harga Jual/pcs", // J (col 10)
    "HPP/Pcs", // K (col 11)
    "", // L (col 12) - spacer
    "Qty Sales", // M (col 13)
    "Sales", // N (col 14)
    "HPP", // O (col 15)
    "Margin Rp", // P (col 16)
    "Margin %", // Q (col 17)
    "Harga Jual/pcs", // R (col 18)
    "HPP/Pcs", // S (col 19)
    "", // T (col 20) - spacer
    "Qty Sales", // U (col 21)
    "Sales", // V (col 22)
    "Margin Rp", // W (col 23)
    "Margin %", // X (col 24)
    "Harga Jual/pcs", // Y (col 25)
    "HPP/Pcs", // Z (col 26)
    "Rp. Selisih Kenaikan Harga jual VS HPP (per pcs)", // AA (col 27)
    "(FAKTOR G) TO MARGIN", // AB (col 28)
    "(FAKTOR A) TO MARGIN", // AC (col 29)
  ];

  // Apply sub-header styles — 3 group ranges (skip spacers L and T)
  function styleSubHeader(colStart, colEnd, fill) {
    for (let colIdx = colStart; colIdx <= colEnd; colIdx++) {
      const cellSub = sheet.getCell(baris, colIdx);
      cellSub.value = subHeaders[colIdx - 5];
      cellSub.border = THIN_BORDER;
      cellSub.font = { bold: true, size: 10 };
      cellSub.fill = fill;
      cellSub.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
  }
  // E-K (cols 5-11): Yellow
  styleSubHeader(5, 11, YELLOW_FILL);
  // M-S (cols 13-19): Orange
  styleSubHeader(13, 19, ORANGE_FILL);
  // U-AC (cols 21-29): Blue
  styleSubHeader(21, 29, BLUE_FILL);
  // L(12), T(20) — spacer columns, NO border or fill (biarkan kosong)

  sheet.getRow(baris).height = 75; // Make sub-header row tall for wrapped text

  baris++; // Move to data row
  baris++; // Small spacer

  // ─── Data Rows ─────────────────────────────────────────────────────────────
  // 25 data items: 7 current + spacer(L) + 7 prev + spacer(T) + 9 variance
  const dataKeysForRow = [
    // Current month (cols 5-11 = E-K): 7 items
    "qty_sales",
    "total_sales",
    "total_hpp",
    "margin_rp",
    "margin_percent",
    "harga_jual_per_pcs",
    "hpp_per_pcs",
    null, // spacer untuk col 12 (L)
    // Previous month (cols 13-19 = M-S): 7 items
    "qty_sales2",
    "total_sales2",
    "total_hpp2",
    "margin_rp2",
    "margin_percent2",
    "harga_jual_per_pcs2",
    "hpp_per_pcs2",
    null, // spacer untuk col 20 (T)
    // Variance (cols 21-29 = U-AC): 9 items
    "sel_sales",
    "sel_total_sales",
    "sel_margin_rp",
    "sel_margin_percent",
    "sel_harga_jual_per_pcs",
    "sel_hpp_per_pcs",
    "sel_kenaikan",
    "faktor_g",
    "faktor_a",
  ];
  const dataStartRow = baris;

  // Accumulators for grand total (match legacy: sum ALL numeric fields, even non-summable ones)
  let totalQty = 0,
    totalSales = 0,
    totalHpp = 0,
    totalMarginRp = 0,
    totalMarginPct = 0,
    totalHjual = 0,
    totalHppPcs = 0;
  let totalQty2 = 0,
    totalSales2 = 0,
    totalHpp2 = 0,
    totalMarginRp2 = 0,
    totalMarginPct2 = 0,
    totalHjual2 = 0,
    totalHppPcs2 = 0;
  let totalSelQty = 0,
    totalSelSales = 0,
    totalSelMarginRp = 0,
    totalSelMarginPct = 0,
    totalSelHjual = 0,
    totalSelHpp = 0,
    totalSelKenaikan = 0,
    totalFaktorG = 0,
    totalFaktorA = 0;

  // Helper: apply THIN_BORDER to data columns ONLY (skip spacers D, L, T)
  // B-C (cols 2-3), E-K (cols 5-11), M-S (cols 13-19), U-AC (cols 21-29)
  function applyDataBorders(rowNum) {
    // B, C
    for (let c = 2; c <= 3; c++) sheet.getCell(rowNum, c).border = THIN_BORDER;
    // E-K (current month)
    for (let c = 5; c <= 11; c++) sheet.getCell(rowNum, c).border = THIN_BORDER;
    // M-S (prev month)
    for (let c = 13; c <= 19; c++) sheet.getCell(rowNum, c).border = THIN_BORDER;
    // U-AC (variance)
    for (let c = 21; c <= 29; c++) sheet.getCell(rowNum, c).border = THIN_BORDER;
    // D(4), L(12), T(20) — NO border (spacers)
  }

  for (const row of mergedData) {
    // Write dep_kd (col B) and dep_nm (col C)
    const cellB = sheet.getCell(baris, 2);
    cellB.value = row.dep_kd;
    cellB.style = { border: THIN_BORDER, font: { size: 10 }, alignment: { horizontal: "center", vertical: "middle" } };

    const cellC = sheet.getCell(baris, 3);
    cellC.value = row.dep_nm;
    cellC.style = { border: THIN_BORDER, font: { size: 10 } };

    // Write numeric data starting from column E (col 5) — 25 items with spacer nulls
    const rowData = dataKeysForRow.map(key => {
      if (key === null) return ""; // spacer column
      const val = row[key];
      return typeof val === "number" ? Math.round(val * 100) / 100 : 0;
    });

    for (let i = 0; i < rowData.length; i++) {
      const colIdx = 5 + i; // E = col 5
      const dataCell = sheet.getCell(baris, colIdx);
      dataCell.value = rowData[i];
      dataCell.border = THIN_BORDER;
      dataCell.font = { size: 10 };

      // Format: percentage for margin_percent columns, number for others
      if (colIdx === 9 || colIdx === 18 || colIdx === 24) {
        // Margin % columns: I (col 9), R (col 18), X (col 24)
        dataCell.numFmt = "#,##0.00";
      } else if (colIdx >= 5 && rowData[i] !== "") {
        dataCell.numFmt = "#,##0";
      }
    }

    // Apply border hanya ke kolom data (B-C, E-K, M-S, U-AC) — skip spacer D, L, T
    applyDataBorders(baris);

    // Accumulate for grand total (sum all numeric fields — matches legacy behavior)
    totalQty += row.qty_sales;
    totalSales += row.total_sales;
    totalHpp += row.total_hpp;
    totalMarginRp += row.margin_rp;
    totalMarginPct += row.margin_percent;
    totalHjual += row.harga_jual_per_pcs;
    totalHppPcs += row.hpp_per_pcs;
    totalQty2 += row.qty_sales2;
    totalSales2 += row.total_sales2;
    totalHpp2 += row.total_hpp2;
    totalMarginRp2 += row.margin_rp2;
    totalMarginPct2 += row.margin_percent2;
    totalHjual2 += row.harga_jual_per_pcs2;
    totalHppPcs2 += row.hpp_per_pcs2;
    totalSelQty += row.sel_sales;
    totalSelSales += row.sel_total_sales;
    totalSelMarginRp += row.sel_margin_rp;
    totalSelMarginPct += row.sel_margin_percent;
    totalSelHjual += row.sel_harga_jual_per_pcs;
    totalSelHpp += row.sel_hpp_per_pcs;
    totalSelKenaikan += row.sel_kenaikan;
    totalFaktorG += row.faktor_g;
    totalFaktorA += row.faktor_a;

    baris++;
  }

  // ─── GRAND TOTAL Row ───────────────────────────────────────────────────────
  baris++; // spacer
  const totalRow = baris;

  // Merge B:C for "GRAND TOTAL"
  sheet.mergeCells(`B${totalRow}:C${totalRow}`);
  applyMergeBorders(sheet, `B${totalRow}:C${totalRow}`, THIN_BORDER);
  const gtCell = sheet.getCell(`B${totalRow}`);
  gtCell.value = "GRAND TOTAL";
  gtCell.style = {
    border: THIN_BORDER,
    font: { bold: true, size: 10 },
    fill: TOTAL_BLUE_FILL,
    alignment: { horizontal: "center", vertical: "middle" },
  };

  const grandTotalData = [
    // Current month (7 items)
    Math.round(totalQty * 100) / 100,
    Math.round(totalSales * 100) / 100,
    Math.round(totalHpp * 100) / 100,
    Math.round(totalMarginRp * 100) / 100,
    Math.round(totalMarginPct * 100) / 100,
    Math.round(totalHjual * 100) / 100,
    Math.round(totalHppPcs * 100) / 100,
    "", // spacer col L (col 12)
    // Previous month (7 items)
    Math.round(totalQty2 * 100) / 100,
    Math.round(totalSales2 * 100) / 100,
    Math.round(totalHpp2 * 100) / 100,
    Math.round(totalMarginRp2 * 100) / 100,
    Math.round(totalMarginPct2 * 100) / 100,
    Math.round(totalHjual2 * 100) / 100,
    Math.round(totalHppPcs2 * 100) / 100,
    "", // spacer col T (col 20)
    // Variance (9 items)
    Math.round(totalSelQty * 100) / 100,
    Math.round(totalSelSales * 100) / 100,
    Math.round(totalSelMarginRp * 100) / 100,
    Math.round(totalSelMarginPct * 100) / 100,
    Math.round(totalSelHjual * 100) / 100,
    Math.round(totalSelHpp * 100) / 100,
    Math.round(totalSelKenaikan * 100) / 100,
    Math.round(totalFaktorG * 100) / 100,
    Math.round(totalFaktorA * 100) / 100,
  ];

  for (let i = 0; i < grandTotalData.length; i++) {
    const colIdx = 5 + i;
    const cellGT = sheet.getCell(totalRow, colIdx);
    cellGT.value = grandTotalData[i];
    cellGT.border = THIN_BORDER;
    cellGT.font = { bold: true, size: 10 };
    cellGT.fill = TOTAL_BLUE_FILL;
    if (colIdx >= 5 && grandTotalData[i] !== "") cellGT.numFmt = "#,##0";
  }
  // Apply border ke grand total row (B-C, E-K, M-S, U-AC) — D, L, T tanpa border
  applyDataBorders(totalRow);

  baris = totalRow + 1;

  // ─── NILAI LPM SALES Row ───────────────────────────────────────────────────
  baris++; // spacer
  const lpmRow = baris;

  const lpmNowNet = lpmNow && lpmNow.length > 0 ? Number(lpmNow[0].net ?? 0) : 0;
  const lpmNowHpp = lpmNow && lpmNow.length > 0 ? Number(lpmNow[0].hpp ?? 0) : 0;
  const lpmPrevNet = lpmPrev && lpmPrev.length > 0 ? Number(lpmPrev[0].net ?? 0) : 0;
  const lpmPrevHpp = lpmPrev && lpmPrev.length > 0 ? Number(lpmPrev[0].hpp ?? 0) : 0;

  // Merge B:C for "NILAI LPM SALES"
  sheet.mergeCells(`B${lpmRow}:C${lpmRow}`);
  applyMergeBorders(sheet, `B${lpmRow}:C${lpmRow}`, THIN_BORDER);
  const lpmLabelCell = sheet.getCell(`B${lpmRow}`);
  lpmLabelCell.value = "NILAI LPM SALES";
  lpmLabelCell.style = {
    border: THIN_BORDER,
    font: { bold: true, size: 10 },
    fill: LPM_YELLOW_FILL,
    alignment: { horizontal: "left", vertical: "middle" },
  };

  // F (col 6): LPM net current
  setLpmCell(sheet, lpmRow, 6, lpmNowNet);
  // G (col 7): LPM hpp current
  setLpmCell(sheet, lpmRow, 7, lpmNowHpp);
  // H (col 8): LPM margin current (net - hpp)
  setLpmCell(sheet, lpmRow, 8, lpmNowNet - lpmNowHpp);

  // N (col 14): LPM net previous
  setLpmCell(sheet, lpmRow, 14, lpmPrevNet);
  // O (col 15): LPM hpp previous
  setLpmCell(sheet, lpmRow, 15, lpmPrevHpp);
  // P (col 16): LPM margin previous
  setLpmCell(sheet, lpmRow, 16, lpmPrevNet - lpmPrevHpp);

  // LPM row: border hanya di B-C (merged), F(6), G(7), H(8), N(14), O(15), P(16)
  // Sudah dihandle oleh setLpmCell dan merged cell style — spacer columns tanpa border

  baris++;

  // ─── SELISIH Row ───────────────────────────────────────────────────────────
  const selisihRow = baris;

  sheet.mergeCells(`B${selisihRow}:C${selisihRow}`);
  applyMergeBorders(sheet, `B${selisihRow}:C${selisihRow}`, THIN_BORDER);
  const selisihLabelCell = sheet.getCell(`B${selisihRow}`);
  selisihLabelCell.value = "SELISIH";
  selisihLabelCell.style = {
    border: THIN_BORDER,
    font: { bold: true, size: 10 },
    fill: LPM_YELLOW_FILL,
    alignment: { horizontal: "left", vertical: "middle" },
  };

  // F (col 6): totalSales - LPM net current
  setLpmCell(sheet, selisihRow, 6, Math.round((totalSales - lpmNowNet) * 100) / 100);
  // G (col 7): totalHpp - LPM hpp current
  setLpmCell(sheet, selisihRow, 7, Math.round((totalHpp - lpmNowHpp) * 100) / 100);
  // H (col 8): totalMarginRp - (LPM net - LPM hpp) — menggunakan totalMarginRp yg sudah diakumulasi
  setLpmCell(sheet, selisihRow, 8, Math.round((totalMarginRp - (lpmNowNet - lpmNowHpp)) * 100) / 100);

  // N (col 14): totalSales2 - LPM net previous
  setLpmCell(sheet, selisihRow, 14, Math.round((totalSales2 - lpmPrevNet) * 100) / 100);
  // O (col 15): totalHpp2 - LPM hpp previous
  setLpmCell(sheet, selisihRow, 15, Math.round((totalHpp2 - lpmPrevHpp) * 100) / 100);
  // P (col 16): totalMarginRp2 - (LPM prev net - LPM prev hpp) — menggunakan totalMarginRp2
  setLpmCell(sheet, selisihRow, 16, Math.round((totalMarginRp2 - (lpmPrevNet - lpmPrevHpp)) * 100) / 100);

  // SELISIH row: border hanya di B-C (merged), F(6), G(7), H(8), N(14), O(15), P(16)
  // Sudah dihandle oleh setLpmCell dan merged cell style — spacer columns tanpa border

  // Hide gridlines
  sheet.views = [{ showGridLines: false }];
}

/**
 * Helper: style a cell in the LPM/SELISIH rows with yellow fill and number format.
 */
function setLpmCell(sheet, row, col, value) {
  const cell = sheet.getCell(row, col);
  cell.value = typeof value === "number" ? Math.round(value * 100) / 100 : 0;
  cell.border = THIN_BORDER;
  cell.font = { bold: true, size: 10 };
  cell.fill = LPM_YELLOW_FILL;
  cell.numFmt = "#,##0";
  cell.alignment = { horizontal: "center" };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const reportName = reportConfig["name-reports"] || "Sales Per Dept";
  const queriesExport = reportConfig["queries-export"] || [];

  const cabang = cab ? await MCabang.findByPk(cab) : null;
  const branchName = cabang ? cabang.namacab : cab;

  logger.info(`[spd_exporter] Mulai build custom Excel: "${reportName}" | cab=${cab} | prd=${prd}`);

  // ── 1. Load department names ─────────────────────────────────────────────
  const deptMap = await getDeptMap();
  logger.info(`[spd_exporter] Department ter-load: ${deptMap.size} items`);

  // ── 2. Extract raw data from results ─────────────────────────────────────
  const nowAll = results["NOW_ALL"] || [];
  const nowReg = results["NOW_REG"] || [];
  const nowFrc = results["NOW_FRC"] || [];
  const prevAll = results["PREV_ALL"] || [];
  const prevReg = results["PREV_REG"] || [];
  const prevFrc = results["PREV_FRC"] || [];

  const lpmNowAll = results["LPM_NOW_ALL"] || [];
  const lpmNowReg = results["LPM_NOW_REG"] || [];
  const lpmNowFrc = results["LPM_NOW_FRC"] || [];
  const lpmPrevAll = results["LPM_PREV_ALL"] || [];
  const lpmPrevReg = results["LPM_PREV_REG"] || [];
  const lpmPrevFrc = results["LPM_PREV_FRC"] || [];

  // ── 3. Merge data for each sheet type ────────────────────────────────────
  const mergedAll = mergeDeptData(deptMap, nowAll, prevAll);
  const mergedReg = mergeDeptData(deptMap, nowReg, prevReg);
  const mergedFrc = mergeDeptData(deptMap, nowFrc, prevFrc);

  logger.info(
    `[spd_exporter] Data merged: ALL=${mergedAll.length} dept, REG=${mergedReg.length}, FRC=${mergedFrc.length}`,
  );

  // ── 4. Persist to sales_per_dept ─────────────────────────────────────────
  try {
    await persistToSalesPerDept(cab, prd, deptMap, nowAll, nowReg, nowFrc);
  } catch (err) {
    logger.error(`[spd_exporter] Gagal persist data: ${err.message}`);
    // Tidak throw — tetap lanjut ke export Excel
  }

  // ── 5. Build Excel workbook ─────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Reporting2.0 — monthly-reports";
  workbook.created = new Date();
  workbook.modified = new Date();

  const prdPrev = getPrevPrd(prd);

  // Sheet definitions: type → (sheetLabel, nowData, prevData, lpmNow, lpmPrev)
  const sheetDefs = [
    { type: "ALL", label: "TABEL SUMMARY DEPT SALES ALL", merged: mergedAll, lpmNow: lpmNowAll, lpmPrev: lpmPrevAll },
    { type: "FRC", label: "TABEL SUMMARY DEPT SALES FRC", merged: mergedFrc, lpmNow: lpmNowFrc, lpmPrev: lpmPrevFrc },
    { type: "REG", label: "TABEL SUMMARY DEPT SALES REG", merged: mergedReg, lpmNow: lpmNowReg, lpmPrev: lpmPrevReg },
  ];

  // Collect all unique queries-export keys we've already processed
  const processedKeys = new Set([
    "NOW_ALL",
    "NOW_REG",
    "NOW_FRC",
    "PREV_ALL",
    "PREV_REG",
    "PREV_FRC",
    "LPM_NOW_ALL",
    "LPM_NOW_REG",
    "LPM_NOW_FRC",
    "LPM_PREV_ALL",
    "LPM_PREV_REG",
    "LPM_PREV_FRC",
  ]);

  for (const def of sheetDefs) {
    logger.info(`[spd_exporter] Building sheet: "${def.label}" (${def.merged.length} dept)`);
    const sheet = workbook.addWorksheet(def.label);
    buildSheet(sheet, def.merged, def.type, prd, prdPrev, branchName, def.lpmNow, def.lpmPrev);
  }

  // ── 6. Build any additional sheets from queries-export not yet processed ──
  for (const item of queriesExport) {
    const sheetName = item.key;
    if (processedKeys.has(sheetName)) continue;

    const valueToExport = results[sheetName];
    if (!valueToExport || valueToExport.length === 0) continue;

    logger.info(`[spd_exporter] Building additional sheet: "${sheetName}" (${valueToExport.length} rows)`);
    const sheet = workbook.addWorksheet(sheetName);

    // Simple default table for extra sheets
    const columns = Object.keys(valueToExport[0]);
    const simpleSheet = sheet;
    simpleSheet.columns = columns.map((col, idx) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 2, 12),
    }));
    const headerRow = simpleSheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, size: 10 };
      cell.fill = GREEN_FILL;
      cell.border = THIN_BORDER;
    });

    valueToExport.forEach((rowData, idx) => {
      const row = simpleSheet.addRow(rowData);
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = THIN_BORDER;
        cell.font = { size: 10 };
      });
    });
  }

  // ── 7. Stream to response ───────────────────────────────────────────────
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const safeName = String(reportName).replace(/[^a-zA-Z0-9_\-]/g, "_");
  const filename = `${safeName}_${prd}_${dateStr}.xlsx`;

  logger.info(`[spd_exporter] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[spd_exporter] Selesai: "${filename}"`);
}
