import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";

function getMonthName(prd) {
  if (!prd || prd.length !== 4) return prd;
  const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  const year = `20${prd.substring(0, 2)}`;
  const monthIdx = parseInt(prd.substring(2, 4), 10) - 1;
  const month = monthNames[monthIdx] || prd.substring(2, 4);
  return `${month} ${year}`;
}

function CHR(index) {
  return String.fromCharCode(65 + index);
}

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const workbook = new ExcelJS.Workbook();
  const reportName = reportConfig["name-reports"] || "Laporan Sales LPG";
  const queriesExport = reportConfig["queries-export"] || [];

  logger.info(`[custom_exporter] Mulai build custom Excel: "${reportName}"`);

  const sheetKeys = Object.keys(results || {});
  if (sheetKeys.length === 0) {
    logger.warn("[custom_exporter] Hasil WRC kosong, tidak ada sheet yang diproses.");
  }

  for (const item of queriesExport) {
    const sheetName = item.key;
    const valueToExport = results[sheetName];

    if (!valueToExport || valueToExport.length === 0) {
      continue;
    }

    const sheet = workbook.addWorksheet(sheetName);
    let baris = 1;

    // --- Judul ---
    sheet.getCell(`A${baris}`).value = "DATA TOKO JUAL DAN TIDAK JUAL PRODUK LPG";
    sheet.getRow(baris).font = { bold: true, size: 13 };
    baris++;

    const strMonthName = getMonthName(prd);
    sheet.getCell(`A${baris}`).value = strMonthName;
    sheet.getRow(baris).font = { bold: true, size: 12 };
    baris++;

    sheet.getCell(`A${baris}`).value = `Cab. ${cab || ""}`;
    sheet.getRow(baris).font = { bold: true, size: 11 };
    baris++;

    // --- Column Widths ---
    const colWidths = [4, 6, 25, 13, 7, 8, 6, 3, 13, 7, 18];
    colWidths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    // --- Header Tabel ---
    const dataKeys = valueToExport.length > 0 ? Object.keys(valueToExport[0]) : [];
    const headers = ["NO", ...dataKeys, "KET LPG"];

    const headerStyle = {
      font: { bold: true, size: 10 },
      alignment: { vertical: "middle", horizontal: "center" },
      border: {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" }
      },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }
    };

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.style = headerStyle;
    });

    baris = headerRow.number + 1;

    // --- Data ---
    let rowsNumber = 1;
    const totalArray = new Array(dataKeys.length).fill(0);
    const numericColIndices = []; // track which keys are numeric for total
    dataKeys.forEach((key, i) => {
      if (key !== "KODE_TOKO" && key !== "NAMA_TOKO") {
        numericColIndices.push(i);
      }
    });

    for (const rowObj of valueToExport) {
      const values = Object.values(rowObj);
      const sales = rowObj.SALES || 0;
      const item = rowObj.ITEM || 0;
      const ketLpg = (item !== 0 || sales !== 0) ? "JUAL" : "TIDAK JUAL";
      const rowData = [rowsNumber++, ...values, ketLpg];

      const dataRow = sheet.addRow(rowData);

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" }
        };
        cell.font = { size: 10 };

        // Number format untuk kolom SALDO_AWAL..ITEM (D-J = col 4-10)
        if (colNumber >= 4 && colNumber <= 10) {
          cell.numFmt = "#,##0";
        }

        // KET LPG coloring (kolom 11)
        if (colNumber === 11) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (ketLpg === "JUAL") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6B8B7" } };
          }
        }
      });

      // Total kalkulasi
      values.forEach((val, i) => {
        if (numericColIndices.includes(i)) {
          const num = typeof val === "number" ? val : parseInt(val || 0, 10);
          if (!isNaN(num)) {
            totalArray[i] = (totalArray[i] || 0) + num;
          }
        }
      });

      baris++;
    }

    // --- Total Row ---
    const totalRowData = ["TOTAL", "", "", ...totalArray.slice(2), ""]; // skip KODE_TOKO & NAMA_TOKO
    const totalRow = sheet.addRow(totalRowData);

    sheet.mergeCells(`A${baris}:C${baris}`);
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" }
      };
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } };

      if (colNumber <= 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber >= 4 && colNumber <= 10) {
        cell.numFmt = "#,##0";
      }
    });

    sheet.views = [{ showGridLines: false }];
  }

  // --- Response ---
  const safeName = String(reportName).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_");
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prdSuffix = prd ? `_${prd}` : "";
  const filename = `${safeName}${prdSuffix}_${dateStr}.xlsx`;

  logger.info(`[custom_exporter] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[custom_exporter] Stream selesai: "${filename}"`);
}
