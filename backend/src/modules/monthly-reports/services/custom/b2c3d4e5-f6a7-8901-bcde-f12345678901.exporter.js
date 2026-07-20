import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";
import MCabang from "../../../../models/m_cabang.model.js";

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

const BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00B0F0" } };
const GREY_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF95B3D7" } };
const TOTAL_BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } };

function styleCell(cell, opts = {}) {
  if (!opts.noBorder) cell.border = THIN_BORDER;
  if (opts.font) cell.font = opts.font;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.alignment) cell.alignment = opts.alignment;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

function mergeRange(sheet, rangeStr, value, opts = {}) {
  sheet.mergeCells(rangeStr);
  const [topLeft] = rangeStr.split(":");
  const cell = sheet.getCell(topLeft);
  if (value !== undefined && value !== null) cell.value = value;
  styleCell(cell, opts);
}

/**
 * Build a single brand sheet (Sari Roti, Mr. Bread, etc.) with multi-level merged headers.
 * 16 columns: A=NO, B=KDTK, C=NAMA TOKO + D-H=SALES ALL, I-J=BPB, K-L=NRB, M-N=NKL, O-P=BA
 */
function buildBrandSheet(sheet, rows, brandName, prd, branchName) {
  if (!rows || rows.length === 0) return;
  let baris = 1,
    rowsNumber = 1;

  // Column widths (16 cols: A-P)
  const colWidths = [4, 5, 25, 7, 12, 12, 12, 12, 7, 12, 7, 12, 7, 12, 7, 12];
  colWidths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  // Title
  sheet.getCell(`C${baris}`).value = `LAPORAN SALES ${brandName.toUpperCase()}`;
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  // Month
  sheet.getCell(`C${baris}`).value = getMonthNameFull(prd);
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  // Branch
  sheet.getCell(`C${baris}`).value = `Cab. ${branchName}`;
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  const hdrRow = baris;
  const hdrStyle = {
    font: { bold: true, size: 10 },
    fill: BLUE_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  };

  // A-C: NO, KDTK, NAMA TOKO — each merged 2 rows
  for (let n = 0; n <= 2; n++) {
    mergeRange(sheet, `${CHR(n)}${hdrRow}:${CHR(n)}${hdrRow + 1}`, ["NO", "KDTK", "NAMA TOKO"][n], hdrStyle);
  }

  // Category groups: D-H (SALES ALL), I-J (BPB), K-L (NRB), M-N (NKL), O-P (BA)
  const categories = [
    { start: 4, end: 8, label: "SALES ALL" },
    { start: 9, end: 10, label: "BPB" },
    { start: 11, end: 12, label: "NRB" },
    { start: 13, end: 14, label: "NKL" },
    { start: 15, end: 16, label: "BA" },
  ];

  categories.forEach(({ start, end, label }) => {
    mergeRange(sheet, `${CHR(start - 1)}${hdrRow}:${CHR(end - 1)}${hdrRow}`, label, hdrStyle);
  });

  // Row 5: Sub-headers
  baris = hdrRow + 1;

  // D-H: QTY, NET, HPP, MARGIN, PPN
  const subSalesAll = ["QTY", "NET", "HPP", "MARGIN", "PPN"];
  for (let c = 0; c < 5; c++) {
    const cell = sheet.getCell(baris, 4 + c);
    cell.value = subSalesAll[c];
    styleCell(cell, hdrStyle);
  }

  // I-P: QTY, RP (x4 groups)
  for (let g = 0; g < 4; g++) {
    const cellQty = sheet.getCell(baris, 9 + g * 2);
    cellQty.value = "QTY";
    styleCell(cellQty, hdrStyle);
    const cellRp = sheet.getCell(baris, 10 + g * 2);
    cellRp.value = "RP";
    styleCell(cellRp, hdrStyle);
  }

  baris++; // Move to data

  // Data rows
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
      if (typeof val === "number" && !isNaN(val)) totalArray[i] = (totalArray[i] || 0) + val;
    });
    baris++;
  }

  // Total row
  const slicedTotal = totalArray.slice(2);
  const totalRowData = ["TOTAL", "", "", ...slicedTotal];
  const totalRow = sheet.addRow(totalRowData);

  mergeRange(sheet, `A${baris}:C${baris}`, undefined, {
    font: { bold: true, size: 10 },
    fill: TOTAL_BLUE_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  });
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = THIN_BORDER;
    cell.font = { bold: true, size: 10 };
    cell.fill = TOTAL_BLUE_FILL;
    if (colNumber >= 4) cell.numFmt = "#,##0";
  });

  sheet.views = [{ showGridLines: false }];
}

/**
 * Build REKAP ALL sheet — combines FRC, REG, ALL data with section headers and totals.
 * 14 columns: A=NAMA PRODUK, B-F=SALES ALL, G-H=BPB, I-J=NRB, K-L=NKL, M-N=BA
 */
function buildRekapAll(sheet, frcRows, regRows, allRows, prd, branchName) {
  let baris = 1;

  // Column widths (14 cols: A-N)
  const colWidths = [25, 9, 14, 12, 12, 12, 9, 12, 9, 12, 9, 12, 9, 12];
  colWidths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  // Title
  sheet.getCell(`A${baris}`).value = `LAPORAN SALES ROTI CABANG ${branchName.toUpperCase()}`;
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  // Month
  sheet.getCell(`A${baris}`).value = getMonthNameFull(prd);
  sheet.getRow(baris).font = { bold: true, size: 11 };
  baris++;

  const hdrRow = baris;
  const hdrStyle = {
    font: { bold: true, size: 10 },
    fill: BLUE_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
  };

  // A = NAMA PRODUK (merged 2 rows)
  mergeRange(sheet, `A${hdrRow}:A${hdrRow + 1}`, "NAMA PRODUK", hdrStyle);

  // B-F = SALES ALL
  mergeRange(sheet, `B${hdrRow}:F${hdrRow}`, "SALES ALL", hdrStyle);

  // G-H = BPB
  mergeRange(sheet, `G${hdrRow}:H${hdrRow}`, "BPB", hdrStyle);

  // I-J = NRB
  mergeRange(sheet, `I${hdrRow}:J${hdrRow}`, "NRB", hdrStyle);

  // K-L = NKL
  mergeRange(sheet, `K${hdrRow}:L${hdrRow}`, "NKL", hdrStyle);

  // M-N = BA
  mergeRange(sheet, `M${hdrRow}:N${hdrRow}`, "BA", hdrStyle);

  // Row 5: Sub-headers
  baris = hdrRow + 1;

  // B-F: QTY, NET, HPP, MARGIN, PPN
  const subSalesAll = ["QTY", "NET", "HPP", "MARGIN", "PPN"];
  for (let c = 0; c < 5; c++) {
    const cell = sheet.getCell(baris, 2 + c);
    cell.value = subSalesAll[c];
    styleCell(cell, hdrStyle);
  }

  // G-N: QTY, RP (x4 groups)
  for (let g = 0; g < 4; g++) {
    const cellQty = sheet.getCell(baris, 7 + g * 2);
    cellQty.value = "QTY";
    styleCell(cellQty, hdrStyle);
    const cellRp = sheet.getCell(baris, 8 + g * 2);
    cellRp.value = "RP";
    styleCell(cellRp, hdrStyle);
  }

  baris++; // Move to data area

  /**
   * Helper: write a section heading row (e.g. "FRANCHISE")
   */
  function writeHeading(label) {
    const rowEmpty = sheet.addRow([]);
    const rowHdr = sheet.addRow([label]);
    rowHdr.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { bold: true, size: 10 };
      cell.fill = BLUE_FILL;
      if (colNumber === 1) cell.alignment = { horizontal: "left" };
    });
    baris = rowHdr.number;
  }

  /**
   * Helper: write data rows with totals computation
   */
  function writeData(rows, totalLabel, totalFill) {
    if (!rows || rows.length === 0) return;

    const dataKeys = Object.keys(rows[0]);
    const totalArr = new Array(dataKeys.length - 1).fill(0); // skip NamaProduk

    for (const row of rows) {
      const values = Object.values(row);
      const dataRow = sheet.addRow(values);
      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = THIN_BORDER;
        cell.font = { size: 10 };
        if (colNumber >= 2) cell.numFmt = "#,##0";
      });

      // Accumulate totals (skip NamaProduk string)
      for (let i = 1; i < values.length; i++) {
        if (typeof values[i] === "number" && !isNaN(values[i])) totalArr[i - 1] = (totalArr[i - 1] || 0) + values[i];
      }
      baris = dataRow.number;
    }

    baris++; // Space before total

    // Total row
    const totalRowData = [totalLabel, ...totalArr];
    const totalRow = sheet.addRow(totalRowData);
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { bold: true, size: 10, color: { argb: "FF002060" } };
      cell.fill = totalFill;
      if (colNumber >= 2) cell.numFmt = "#,##0";
      if (colNumber === 1) cell.alignment = { horizontal: "right" };
    });
    baris = totalRow.number;
    baris++; // Gap for next section
  }

  // --- FRANCHISE Section ---
  writeHeading("FRANCHISE");
  writeData(frcRows, "TOTAL FRANCHISE:", GREY_FILL);

  // --- REGULER Section ---
  writeHeading("REGULER");
  writeData(regRows, "TOTAL REGULER:", GREY_FILL);

  // --- ALL Section ---
  writeHeading("TOTAL F & R");
  writeData(allRows, "GRAND TOTAL F & R:", GREY_FILL);

  sheet.views = [{ showGridLines: false }];
}

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const reportName = reportConfig["name-reports"] || "Sales Roti";
  const queriesExport = reportConfig["queries-export"] || [];

  const cabang = cab ? await MCabang.findByPk(cab) : null;
  const branchName = cabang ? cabang.namacab : cab;

  logger.info(`[custom_exporter_roti] Mulai build custom Excel: "${reportName}"`);

  const workbook = new ExcelJS.Workbook();

  // Collect REKAP data for REKAP ALL sheet
  const frcRows = results["REKAP FRC"] || [];
  const regRows = results["REKAP REG"] || [];
  const allRows = results["REKAP ALL"] || [];
  let rekapAllBuilt = false;

  for (const item of queriesExport) {
    const sheetName = item.key;
    const valueToExport = results[sheetName];
    if (!valueToExport || valueToExport.length === 0) continue;

    logger.info(`[custom_exporter_roti] Building sheet: "${sheetName}" (${valueToExport.length} rows)`);

    // Skip REKAP queries — they're used to build REKAP ALL later
    if (sheetName.startsWith("REKAP ")) continue;

    const sheet = workbook.addWorksheet(sheetName);
    buildBrandSheet(sheet, valueToExport, sheetName, prd, branchName);
  }

  // Build REKAP ALL sheet using combined REKAP data
  if (frcRows.length > 0 || regRows.length > 0 || allRows.length > 0) {
    const sheet = workbook.addWorksheet("REKAP ALL");
    buildRekapAll(sheet, frcRows, regRows, allRows, prd, branchName);
  }

  const filename = `${reportName} Cabang ${cab || ""} ${prd || ""}.xlsx`;
  logger.info(`[custom_exporter_roti] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();
  logger.info(`[custom_exporter_roti] Stream selesai: "${filename}"`);
}
