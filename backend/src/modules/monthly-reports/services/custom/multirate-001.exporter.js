import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";
import MCabang from "../../../../models/m_cabang.model.js";

function getMonthNameFull(prd) {
  if (!prd || prd.length !== 4) return prd;
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const year = `20${prd.substring(0, 2)}`;
  const monthIdx = parseInt(prd.substring(2, 4), 10) - 1;
  return `${monthNames[monthIdx] || "?"} ${year}`;
}

function getEndOfMonthDate(prd) {
  if (!prd || prd.length !== 4) return "";
  const year = 2000 + parseInt(prd.substring(0, 2), 10);
  const month = parseInt(prd.substring(2, 4), 10) - 1;
  const date = new Date(year, month + 1, 0);
  return `${date.getDate()} ${getMonthNameFull(prd)}`;
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

const YELLOW_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const ORANGE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
const GREEN_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92D050" } };
const BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
const LIGHT_GREEN_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };

const HEADER_FONT = { bold: true, size: 10 };
const TITLE_FONT_BOLD11 = { bold: true, size: 11 };
const TITLE_FONT_BOLD12 = { bold: true, size: 12 };

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

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const reportName = reportConfig["name-reports"] || "Sales Multirate";
  const queriesExport = reportConfig["queries-export"] || [];

  const cabang = cab ? await MCabang.findByPk(cab) : null;
  const branchName = cabang ? cabang.namacab : cab;

  logger.info(`[custom_exporter_multirate] Mulai build custom Excel: "${reportName}"`);

  const sheetKey = prd || Object.keys(results || {})[0];
  const valueToExport = results[sheetKey];

  if (!valueToExport || valueToExport.length === 0) {
    logger.warn("[custom_exporter_multirate] Hasil WRC kosong, tidak ada data yang diekspor.");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetKey || "Multirate");

  let baris = 1;

  // Row 1: Title
  sheet.getCell(`B${baris}`).value = "Rekap Data Sales dan HPP Toko ALL (Multirate)";
  sheet.getRow(baris).font = TITLE_FONT_BOLD11;
  baris++;

  // Row 2: Period
  const periodText = `1 s.d ${getEndOfMonthDate(prd)}`;
  sheet.getCell(`B${baris}`).value = periodText;
  sheet.getRow(baris).font = TITLE_FONT_BOLD12;
  baris++;

  // Row 3: Branch
  sheet.getCell(`B${baris}`).value = `Cab. ${branchName}`;
  sheet.getRow(baris).font = TITLE_FONT_BOLD11;
  baris++;

  baris++; // empty row

  // Column widths
  const columnWidths = [
    { column: "A", width: 4 },
    { column: "B", width: 10 },
    { column: "C", width: 10 },
    { column: "D", width: 27 },
    { column: "E", width: 9 },
    { column: "F", width: 13 },
    { column: "G", width: 13 },
    { column: "H", width: 13 },
    { column: "I", width: 13 },
    { column: "J", width: 13 },
    { column: "K", width: 13 },
    { column: "L", width: 13 },
    { column: "M", width: 13 },
    { column: "N", width: 13 },
    { column: "O", width: 13 },
    { column: "P", width: 13 },
    { column: "Q", width: 13 },
  ];
  for (const widthSetting of columnWidths) {
    sheet.getColumn(widthSetting.column).width = widthSetting.width;
  }

  // Row 5: Main headers (merged)
  const hdrRow = baris;
  const hdrStyle = {
    font: HEADER_FONT,
    fill: YELLOW_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
    border: THIN_BORDER,
  };

  mergeRange(sheet, `A${hdrRow}:A${hdrRow + 1}`, "NO", hdrStyle);
  mergeRange(sheet, `B${hdrRow}:B${hdrRow + 1}`, "CAB", hdrStyle);
  mergeRange(sheet, `C${hdrRow}:C${hdrRow + 1}`, "KDTK", hdrStyle);
  mergeRange(sheet, `D${hdrRow}:D${hdrRow + 1}`, "NAMA TOKO", hdrStyle);
  mergeRange(sheet, `E${hdrRow}:E${hdrRow + 1}`, "HR JUAL", hdrStyle);

  mergeRange(sheet, `F${hdrRow}:H${hdrRow}`, "DRY", { ...hdrStyle, fill: ORANGE_FILL });
  mergeRange(sheet, `I${hdrRow}:K${hdrRow}`, "BKL", { ...hdrStyle, fill: GREEN_FILL });
  mergeRange(sheet, `L${hdrRow}:N${hdrRow}`, "VIRTUAL", { ...hdrStyle, fill: BLUE_FILL });
  mergeRange(sheet, `O${hdrRow}:Q${hdrRow}`, "TOTAL", { ...hdrStyle, fill: LIGHT_GREEN_FILL });

  baris = hdrRow + 1;

  // Row 6: Sub-headers
  const subHeaders = ["SALES", "HPP", "MARGIN"];
  const groupColors = [ORANGE_FILL, GREEN_FILL, BLUE_FILL, LIGHT_GREEN_FILL];
  let colStart = 5; // F
  for (let g = 0; g < 4; g++) {
    for (let c = 0; c < 3; c++) {
      const cell = sheet.getCell(baris, colStart + c);
      cell.value = subHeaders[c];
      styleCell(cell, {
        font: HEADER_FONT,
        fill: groupColors[g],
        alignment: { vertical: "middle", horizontal: "center" },
      });
    }
    colStart += 3;
  }
  baris++;

  // Data rows
  if (valueToExport && valueToExport.length > 0) {
    let rowsNumber = 1;
    const dataKeys = Object.keys(valueToExport[0]);

    for (const rowObj of valueToExport) {
      const values = Object.values(rowObj);
      const rowData = [rowsNumber++, ...values];
      const dataRow = sheet.addRow(rowData);

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styleCell(cell, {
          font: { size: 10 },
          border: THIN_BORDER,
        });
        if (colNumber >= 6) {
          cell.numFmt = "#,##0";
        }
      });
      baris++;
    }
  }

  sheet.views = [{ showGridLines: false }];

  const filename = `${reportName} Cabang ${cab || ""} ${prd || ""}.xlsx`;
  logger.info(`[custom_exporter_multirate] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();
  logger.info(`[custom_exporter_multirate] Stream selesai: "${filename}"`);
}
