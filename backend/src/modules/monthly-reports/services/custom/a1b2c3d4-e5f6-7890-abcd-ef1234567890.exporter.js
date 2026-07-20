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
  const month = monthNames[monthIdx] || prd.substring(2, 4);
  return `${month} ${year}`;
}

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00B0F0" } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };

function buildPluPizza(sheet, rows) {
  let baris = 1;
  let rowsNumber = 1;

  // Column widths
  const colWidths = [4, 10, 9, 9, 25];
  colWidths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  // Header
  const headers = ["NO", "MERK", "CAT_COD", "PRDCD", "SINGKATAN"];
  const hdrRow = sheet.addRow(headers);
  hdrRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true };
    cell.border = THIN_BORDER;
    cell.fill = BLUE_FILL;
  });
  baris = hdrRow.number + 1;

  // Data
  for (const row of rows) {
    const dataRow = sheet.addRow([rowsNumber++, row.MERK, row.CAT_COD, parseInt(row.PRDCD, 10), row.SINGKATAN]);
    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: false };
      cell.border = THIN_BORDER;
    });
  }

  sheet.views = [{ showGridLines: false }];
}

function buildDetailPlu(sheet, rows) {
  let rowsNumber = 1;

  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  if (keys.length === 0) return;

  // Auto width
  keys.forEach((key, i) => {
    sheet.getColumn(i + 1).width = Math.max(key.length + 3, 10);
  });

  // Header
  const hdrRow = sheet.addRow(["No.", ...keys]);
  hdrRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true };
    cell.border = THIN_BORDER;
  });

  // Data
  for (const row of rows) {
    const dataRow = sheet.addRow([rowsNumber++, ...Object.values(row)]);
    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: false };
      cell.border = THIN_BORDER;
    });
  }

  sheet.views = [{ showGridLines: false }];
}

function buildRekap(sheet, rows, prd, branchName) {
  let baris = 1;
  let rowsNumber = 1;

  // Title
  sheet.getCell(`C${baris}`).value = "REKAP SALES PIZZA";
  sheet.getRow(baris).font = { bold: true, size: 14 };
  baris++;

  // Month
  sheet.getCell(`C${baris}`).value = getMonthNameFull(prd);
  sheet.getRow(baris).font = { bold: true, size: 13 };
  baris++;

  // Branch
  sheet.getCell(`C${baris}`).value = `Cab. ${branchName}`;
  sheet.getRow(baris).font = { bold: true, size: 12 };
  baris++;

  // Column widths A-I
  const colWidths = [4, 6, 25, 6, 10, 10, 10, 10, 10];
  colWidths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  // Header row
  const headers = ["NO", "KDTK", "NAMA TOKO", "QTY", "SALES NET", "HPP", "MRG", "TSALES", "TPPN"];
  const hdrRow = sheet.addRow(headers);
  hdrRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true };
    cell.border = THIN_BORDER;
    cell.fill = BLUE_FILL;
  });
  baris = hdrRow.number + 1;

  // Data rows + totals
  let totQty = 0,
    totNet = 0,
    totHpp = 0,
    totTsls = 0,
    totPpn = 0;

  for (const row of rows) {
    const values = Object.values(row);
    totQty += parseInt(row.QTY || 0, 10);
    totNet += parseInt(row.SALES_NET || 0, 10);
    totHpp += parseInt(row.HPP || 0, 10);
    totTsls += parseInt(row.TSALES || 0, 10);
    totPpn += parseInt(row.TPPN || 0, 10);

    const dataRow = sheet.addRow([rowsNumber++, ...values]);
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      if (colNumber >= 4) cell.numFmt = "#,##0";
    });
    baris++;
  }

  // Total row
  const totMrg = totNet - totHpp;
  const totalData = [totQty, totNet, totHpp, totMrg, totTsls, totPpn];
  const totalRow = sheet.addRow(["Total", "", "", ...totalData]);
  sheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = THIN_BORDER;
    cell.font = { bold: true };
    if (colNumber <= 3) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    } else {
      cell.numFmt = "#,##0";
      cell.fill = TOTAL_FILL;
    }
  });

  sheet.views = [{ showGridLines: false }];
}

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const reportName = reportConfig["name-reports"] || "Sales Pizza";
  const queriesExport = reportConfig["queries-export"] || [];

  const cabang = cab ? await MCabang.findByPk(cab) : null;
  const branchName = cabang ? cabang.namacab : cab;

  logger.info(`[custom_exporter_pizza] Mulai build custom Excel: "${reportName}"`);

  const workbook = new ExcelJS.Workbook();

  for (const item of queriesExport) {
    const sheetName = item.key;
    const valueToExport = results[sheetName];
    if (!valueToExport || valueToExport.length === 0) continue;

    logger.info(`[custom_exporter_pizza] Building sheet: "${sheetName}" (${valueToExport.length} rows)`);
    const sheet = workbook.addWorksheet(sheetName);

    switch (sheetName) {
      case "PluPizza":
        buildPluPizza(sheet, valueToExport);
        break;
      case "DetailPlu":
        buildDetailPlu(sheet, valueToExport);
        break;
      case "Rekap":
        buildRekap(sheet, valueToExport, prd, branchName);
        break;
      default:
        buildDetailPlu(sheet, valueToExport);
        break;
    }
  }

  const filename = `${reportName} Cabang ${cab || ""} ${prd || ""}.xlsx`;
  logger.info(`[custom_exporter_pizza] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();
  logger.info(`[custom_exporter_pizza] Stream selesai: "${filename}"`);
}
