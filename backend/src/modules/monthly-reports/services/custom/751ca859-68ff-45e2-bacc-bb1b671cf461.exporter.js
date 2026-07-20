import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthName(prd) {
  if (!prd || prd.length !== 4) return prd;
  const monthNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
  ];
  const year = `20${prd.substring(0, 2)}`;
  const monthIdx = parseInt(prd.substring(2, 4), 10) - 1;
  const month = monthNames[monthIdx] || prd.substring(2, 4);
  return `${month} ${year}`;
}

function getMonthNameFull(prd) {
  if (!prd || prd.length !== 4) return prd;
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const year = `20${prd.substring(0, 2)}`;
  const monthIdx = parseInt(prd.substring(2, 4), 10) - 1;
  const month = monthNames[monthIdx] || prd.substring(2, 4);
  return `${month} ${year}`;
}

/**
 * Convert 0-based column index to Excel column letter(s).
 * 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, 27 -> AB, etc.
 */
function CHR(index) {
  let col = "";
  let i = index;
  while (i >= 0) {
    col = String.fromCharCode(65 + (i % 26)) + col;
    i = Math.floor(i / 26) - 1;
  }
  return col;
}

function branchText(cab) {
  const branchMap = {
    G026: "Tangerang 1",
    G033: "Tangerang 2",
    G107: "Parung",
    G113: "Bogor 1",
    G117: "Bogor 2",
    G157: "Lebak",
    G295: "Sukabumi(Supply)",
  };
  return branchMap[cab] || cab;
}

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const GREEN_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD8E4BC" } };

/**
 * Style a single cell with border, and optional font/fill/alignment/numFmt.
 * Does NOT apply border if opts.noBorder is true.
 */
function styleCell(cell, opts = {}) {
  if (!opts.noBorder) cell.border = THIN_BORDER;
  if (opts.font) cell.font = opts.font;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.alignment) cell.alignment = opts.alignment;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

/**
 * Merge cells, then style the top-left cell. Sets value if provided.
 */
function mergeRange(sheet, rangeStr, value, opts = {}) {
  sheet.mergeCells(rangeStr);
  const [topLeft] = rangeStr.split(":");
  const cell = sheet.getCell(topLeft);
  if (value !== undefined && value !== null) cell.value = value;
  styleCell(cell, opts);
}

// ─── Sheet Builders ──────────────────────────────────────────────────────────

/**
 * Build MASTER PLU sheet — 3 groups side by side (PC, YC, GOLD)
 */
function buildMasterPlu(sheet, rows) {
  let baris = 1;

  // Title
  const titleCell = sheet.getCell(`A${baris}`);
  titleCell.value = "MASTER PLU POINT COFFE, YUMMY COFFE, YUMMY COFFE GOLD";
  titleCell.font = { bold: true, size: 12 };
  baris++;

  // Column widths
  const colWidths = [8, 10, 20, 15, 8, 10, 20, 15, 8, 10, 20];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // Sub-header row
  const subHeaders = [
    "CAT_COD", "PRDCD", "SINGKATAN", "", "CAT_COD", "PRDCD", "SINGKATAN",
    "", "CAT_COD", "PRDCD", "SINGKATAN",
  ];
  const subRow = sheet.addRow(subHeaders);
  subRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true, size: 10 };
  });
  baris = subRow.number + 1;

  // Collect data per group
  const pcData = [];
  const ycData = [];
  const goldData = [];

  for (const row of rows) {
    if (row.cat_cod_pc != null) {
      pcData.push([row.cat_cod_pc, row.prdcd_pc, row.singkatan_pc]);
    }
    if (row.cat_cod_yc != null) {
      ycData.push([row.cat_cod_yc, row.prdcd_yc, row.singkatan_yc]);
    }
    if (row.cat_cod_gold != null) {
      goldData.push([row.cat_cod_gold, row.prdcd_gold, row.singkatan_gold]);
    }
  }

  const maxRows = Math.max(pcData.length, ycData.length, goldData.length);

  for (let i = 0; i < maxRows; i++) {
    const rowData = [];

    // PC group (cols 1-3)
    if (i < pcData.length) {
      rowData.push(...pcData[i]);
    } else {
      rowData.push("", "", "");
    }

    // Spacer (col 4)
    rowData.push("");

    // YC group (cols 5-7)
    if (i < ycData.length) {
      rowData.push(...ycData[i]);
    } else {
      rowData.push("", "", "");
    }

    // Spacer (col 8)
    rowData.push("");

    // GOLD group (cols 9-11)
    if (i < goldData.length) {
      rowData.push(...goldData[i]);
    } else {
      rowData.push("", "", "");
    }

    const dataRow = sheet.addRow(rowData);
    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { size: 10 };
    });
  }

  sheet.views = [{ showGridLines: false }];
}

/**
 * Build POINT COFFE sheet — multi-level merged headers with 5 category groups.
 *
 * Layout:
 *   Row 1: "SALES POINT COFFE" (bold 12)
 *   Row 2: month name (bold 11)
 *   Row 3: "Cab. ..." (bold 11)
 *   Row 4: Merged headers (NO|KDTK|NAMA TOKO) + SALES ALL|SALES CUP|SALES BOTOL|SALES PLU ADD|SALES PLU UP SIZE
 *   Row 5: Sub-headers (NET(-PPN)|HPP|MRG|QTY|TSALES|PPN) × 5 groups
 *   Row 6+: Data rows
 *   Last: Total row
 */
function buildPointCoffee(sheet, rows, prd, cab) {
  if (!rows || rows.length === 0) return;

  let baris = 1;
  let rowsNumber = 1;

  // ── Column widths (33 columns: A-AG) ──
  const colWidths = [4, 5, 25, 12, 12, 12, 8, 12, 12, 12, 12, 12, 8, 12, 12, 12, 12, 12, 8, 12, 12, 12, 12, 12, 8, 12, 12, 12, 12, 12, 8, 12, 12];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ── Title ──
  sheet.getCell(`C${baris}`).value = "SALES POINT COFFE";
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  // ── Month ──
  sheet.getCell(`C${baris}`).value = getMonthNameFull(prd);
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  // ── Branch ──
  const branchName = branchText(cab);
  sheet.getCell(`C${baris}`).value = `Cab. ${branchName}`;
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  const hdrRow = baris; // Row 4

  // ── Row 4: Category headers ──
  const categoryStyle = {
    font: { bold: true, size: 10 },
    fill: GREEN_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  };

  // Merge A4:AG5 as ONE big background fill area, but only individual columns/groups are merged
  // Instead of touching all cells, we merge only the needed ranges.

  // A-C: each column merged 2 rows vertically
  for (let n = 0; n <= 2; n++) {
    mergeRange(sheet, `${CHR(n)}${hdrRow}:${CHR(n)}${hdrRow + 1}`, ["NO", "KDTK", "NAMA TOKO"][n], categoryStyle);
  }

  // Category groups: D-I (SALES ALL), J-O (SALES CUP), P-U (SALES BOTOL),
  //                  V-AA (SALES PLU ADD), AB-AG (SALES PLU UP SIZE)
  const categories = [
    { start: 4, end: 9, label: "SALES ALL" },
    { start: 10, end: 15, label: "SALES CUP" },
    { start: 16, end: 21, label: "SALES BOTOL" },
    { start: 22, end: 27, label: "SALES PLU ADD" },
    { start: 28, end: 33, label: "SALES PLU UP SIZE" },
  ];

  categories.forEach(({ start, end, label }) => {
    mergeRange(sheet, `${CHR(start - 1)}${hdrRow}:${CHR(end - 1)}${hdrRow}`, label, categoryStyle);
  });

  // ── Row 5: Sub-headers ──
  baris = hdrRow + 1;

  // For each column D-AG (4-33), set sub-header label
  const subLabels = [
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
  ];

  // Also style A-C in row 5 (they are merged with row 4, so just set fill on the merged cell's row 5 part)
  // Since A-C cells in row 5 are part of the A4:A5, B4:B5, C4:C5 merges, they don't need separate styling.
  // But we need to ensure row 5 cells for D-AG have green fill too.

  // Style cells in row 5, columns D-AG
  for (let colIdx = 4; colIdx <= 33; colIdx++) {
    const cell = sheet.getCell(baris, colIdx);
    cell.value = subLabels[colIdx - 4] || "";
    styleCell(cell, {
      font: { bold: true, size: 10 },
      fill: GREEN_FILL,
      alignment: { vertical: "middle", horizontal: "center" },
    });
  }

  baris++; // Move to data row

  // ── Data rows ──
  const dataKeys = Object.keys(rows[0]);
  const totalArray = new Array(dataKeys.length).fill(0);

  for (const rowObj of rows) {
    const values = Object.values(rowObj);
    const rowData = [rowsNumber++, ...values];

    const dataRow = sheet.addRow(rowData);

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { size: 10 };
      if (colNumber >= 4) cell.numFmt = "#,##0";
    });

    values.forEach((val, i) => {
      if (typeof val === "number" && !isNaN(val)) {
        totalArray[i] = (totalArray[i] || 0) + val;
      }
    });

    baris++;
  }

  // ── Total row ──
  const slicedTotal = totalArray.slice(2);
  const totalRowData = ["TOTAL", "", "", ...slicedTotal];
  const totalRow = sheet.addRow(totalRowData);

  mergeRange(sheet, `A${baris}:C${baris}`, undefined, {
    font: { bold: true, size: 10 },
    fill: TOTAL_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  });
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = THIN_BORDER;
    cell.font = { bold: true, size: 10 };
    cell.fill = TOTAL_FILL;
    if (colNumber >= 4) cell.numFmt = "#,##0";
  });

  sheet.views = [{ showGridLines: false }];
}

/**
 * Build YUMMY COFFE sheet — 9 columns, each column merged 2 rows for header.
 */
function buildYummyCoffee(sheet, rows, prd, cab) {
  if (!rows || rows.length === 0) return;

  let baris = 1;
  let rowsNumber = 1;

  // ── Column widths (9 columns: A-I) ──
  const colWidths = [4, 5, 25, 12, 12, 12, 7, 12, 12];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ── Title ──
  sheet.getCell(`C${baris}`).value = "SALES YUMMY COFFE";
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  // ── Month ──
  sheet.getCell(`C${baris}`).value = getMonthNameFull(prd);
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  // ── Branch ──
  const branchName = branchText(cab);
  sheet.getCell(`C${baris}`).value = `Cab. ${branchName}`;
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  // ── Header: merged 2 rows ──
  const hdrRow = baris;
  const hdrLabels = ["NO", "KDTK", "NAMA TOKO", "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN"];
  const hdrStyle = {
    font: { bold: true, size: 10 },
    fill: GREEN_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  };

  for (let n = 0; n <= 8; n++) {
    mergeRange(sheet, `${CHR(n)}${hdrRow}:${CHR(n)}${hdrRow + 1}`, hdrLabels[n], hdrStyle);
  }

  baris = hdrRow + 2; // Skip the merged second row

  // ── Data rows ──
  const dataKeys = Object.keys(rows[0]);
  const totalArray = new Array(dataKeys.length).fill(0);

  for (const rowObj of rows) {
    const values = Object.values(rowObj);
    const rowData = [rowsNumber++, ...values];

    const dataRow = sheet.addRow(rowData);

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { size: 10 };
      if (colNumber >= 4) cell.numFmt = "#,##0";
    });

    values.forEach((val, i) => {
      if (typeof val === "number" && !isNaN(val)) {
        totalArray[i] = (totalArray[i] || 0) + val;
      }
    });

    baris++;
  }

  // ── Total row ──
  const slicedTotal = totalArray.slice(2);
  const totalRowData = ["TOTAL", "", "", ...slicedTotal];
  const totalRow = sheet.addRow(totalRowData);

  mergeRange(sheet, `A${baris}:C${baris}`, undefined, {
    font: { bold: true, size: 10 },
    fill: TOTAL_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  });
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = THIN_BORDER;
    cell.font = { bold: true, size: 10 };
    cell.fill = TOTAL_FILL;
    if (colNumber >= 4) cell.numFmt = "#,##0";
  });

  sheet.views = [{ showGridLines: false }];
}

/**
 * Build YCOFFE GOLD sheet — multi-level merged headers with 3 category groups.
 *
 * Layout:
 *   Row 1: "SALES YCOFFE GOLD" (bold 12)
 *   Row 2: month name (bold 11)
 *   Row 3: "Cab. ..." (bold 11)
 *   Row 4: Merged headers: NO|KDTK|NAMA TOKO + SALES ALL|SALES CUP|SALES PLU ADD
 *   Row 5: Sub-headers (NET(-PPN)|HPP|MRG|QTY|TSALES|PPN) × 3 groups
 *   Row 6+: Data rows
 *   Last: Total row
 */
function buildGoldCoffee(sheet, rows, prd, cab) {
  if (!rows || rows.length === 0) return;

  let baris = 1;
  let rowsNumber = 1;

  // ── Column widths (21 columns: A-U) ──
  const colWidths = [4, 5, 25, 12, 12, 12, 7, 12, 12, 12, 12, 12, 7, 12, 12, 12, 12, 12, 7, 12, 12];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ── Title ──
  sheet.getCell(`C${baris}`).value = "SALES YCOFFE GOLD";
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  // ── Month ──
  sheet.getCell(`C${baris}`).value = getMonthNameFull(prd);
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  // ── Branch ──
  const branchName = branchText(cab);
  sheet.getCell(`C${baris}`).value = `Cab. ${branchName}`;
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  const hdrRow = baris; // Row 4

  const categoryStyle = {
    font: { bold: true, size: 10 },
    fill: GREEN_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  };

  // A-C: each column merged 2 rows vertically
  for (let n = 0; n <= 2; n++) {
    mergeRange(sheet, `${CHR(n)}${hdrRow}:${CHR(n)}${hdrRow + 1}`, ["NO", "KDTK", "NAMA TOKO"][n], categoryStyle);
  }

  // Category groups: D-I (SALES ALL), J-O (SALES CUP), P-U (SALES PLU ADD)
  const categories = [
    { start: 4, end: 9, label: "SALES ALL" },
    { start: 10, end: 15, label: "SALES CUP" },
    { start: 16, end: 21, label: "SALES PLU ADD" },
  ];

  categories.forEach(({ start, end, label }) => {
    mergeRange(sheet, `${CHR(start - 1)}${hdrRow}:${CHR(end - 1)}${hdrRow}`, label, categoryStyle);
  });

  // ── Row 5: Sub-headers ──
  baris = hdrRow + 1;

  const subLabels = [
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
    "NET(-PPN)", "HPP", "MRG", "QTY", "TSALES", "PPN",
  ];

  // Style cells in row 5, columns D-U
  for (let colIdx = 4; colIdx <= 21; colIdx++) {
    const cell = sheet.getCell(baris, colIdx);
    cell.value = subLabels[colIdx - 4] || "";
    styleCell(cell, {
      font: { bold: true, size: 10 },
      fill: GREEN_FILL,
      alignment: { vertical: "middle", horizontal: "center" },
    });
  }

  baris++; // Move to data row

  // ── Data rows ──
  const dataKeys = Object.keys(rows[0]);
  const totalArray = new Array(dataKeys.length).fill(0);

  for (const rowObj of rows) {
    const values = Object.values(rowObj);
    const rowData = [rowsNumber++, ...values];

    const dataRow = sheet.addRow(rowData);

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { size: 10 };
      if (colNumber >= 4) cell.numFmt = "#,##0";
    });

    values.forEach((val, i) => {
      if (typeof val === "number" && !isNaN(val)) {
        totalArray[i] = (totalArray[i] || 0) + val;
      }
    });

    baris++;
  }

  // ── Total row ──
  const slicedTotal = totalArray.slice(2);
  const totalRowData = ["TOTAL", "", "", ...slicedTotal];
  const totalRow = sheet.addRow(totalRowData);

  mergeRange(sheet, `A${baris}:C${baris}`, undefined, {
    font: { bold: true, size: 10 },
    fill: TOTAL_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  });
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = THIN_BORDER;
    cell.font = { bold: true, size: 10 };
    cell.fill = TOTAL_FILL;
    if (colNumber >= 4) cell.numFmt = "#,##0";
  });

  sheet.views = [{ showGridLines: false }];
}

/**
 * Build detail sheets (DETAIL PC, DETAIL YC, DETAIL GOLD) — default simple table
 */
function buildDetailSheet(sheet, rows, sheetName) {
  if (!rows || rows.length === 0) return;

  let baris = 1;

  // Title
  sheet.getCell(`A${baris}`).value = sheetName;
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  const dataKeys = Object.keys(rows[0]);

  // Set column widths
  dataKeys.forEach((key, idx) => {
    const minWidth = key.length + 3;
    sheet.getColumn(idx + 1).width = Math.max(minWidth, 10);
  });

  // Header
  const headerRow = sheet.addRow(dataKeys);
  headerRow.eachCell({ includeEmpty: true }, cell => {
    styleCell(cell, {
      font: { bold: true, size: 10 },
      fill: GREEN_FILL,
      alignment: { vertical: "middle", horizontal: "center" },
    });
  });
  baris = headerRow.number + 1;

  // Data rows
  for (const rowObj of rows) {
    const values = Object.values(rowObj);
    const dataRow = sheet.addRow(values);

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { size: 10 };
      if (colNumber >= 4 && typeof values[colNumber - 1] === "number") {
        cell.numFmt = "#,##0";
      }
    });

    baris++;
  }

  sheet.views = [{ showGridLines: false }];
}

// ─── Main Export ────────────────────────────────────────────────────────────

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const reportName = reportConfig["name-reports"] || "Sales Coffee";
  const queriesExport = reportConfig["queries-export"] || [];

  logger.info(`[custom_exporter_coffee] Mulai build custom Excel: "${reportName}"`);

  const sheetKeys = Object.keys(results || {});
  if (sheetKeys.length === 0) {
    logger.warn("[custom_exporter_coffee] Hasil WRC kosong, tidak ada sheet yang diproses.");
  }

  const workbook = new ExcelJS.Workbook();

  for (const item of queriesExport) {
    const sheetName = item.key;
    const valueToExport = results[sheetName];

    if (!valueToExport || valueToExport.length === 0) {
      continue;
    }

    logger.info(`[custom_exporter_coffee] Building sheet: "${sheetName}" (${valueToExport.length} rows)`);

    const sheet = workbook.addWorksheet(sheetName);

    switch (sheetName) {
      case "MASTER PLU":
        buildMasterPlu(sheet, valueToExport);
        break;
      case "POINT COFFE":
        buildPointCoffee(sheet, valueToExport, prd, cab);
        break;
      case "YUMMY COFFE":
        buildYummyCoffee(sheet, valueToExport, prd, cab);
        break;
      case "YCOFFE GOLD":
        buildGoldCoffee(sheet, valueToExport, prd, cab);
        break;
      default:
        buildDetailSheet(sheet, valueToExport, sheetName);
        break;
    }
  }

  // ── Stream response ──
  const safeName = String(reportName).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_");
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prdSuffix = prd ? `_${prd}` : "";
  const filename = `${safeName}${prdSuffix}_${dateStr}.xlsx`;

  logger.info(`[custom_exporter_coffee] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[custom_exporter_coffee] Stream selesai: "${filename}"`);
}
