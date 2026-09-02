/**
 * Custom Exporter — Rekap Penjualan Bulanan Toko
 *
 * Menghasilkan file Excel (.xlsx) dengan 2 sheet:
 *   1. Sheet {prd} : Rekap penjualan bulanan per toko
 *      - Subtotal per kategori toko (CRM, Franchise, Reguler, All) di ATAS header
 *      - Detail data per toko di BAWAH header
 *   2. Sheet PER DAY : Rekap penjualan harian
 *      - Data per tanggal
 *      - TOTAL di baris terakhir
 *
 * Layout mengikuti referensi PHP report_ic_xls_b.php
 */

import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";
import MCabang from "../../../../models/m_cabang.model.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format nama bulan dari kode PRD (YYMM)
 * Contoh: "2608" → "AGUSTUS 2026"
 */
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

/**
 * Format angka dengan pemisah ribuan (seperti PHP number_format)
 * Contoh: 1234567 → "1.234.567"
 */
function formatNumber(val, decimals = 0) {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Style border thin (konsisten di semua sel)
 */
const BORDER_THIN = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

/**
 * Style untuk header kolom (biru #0099FF)
 */
const HEADER_STYLE = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0099FF" } },
  alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  border: BORDER_THIN,
};

/**
 * Style untuk baris subtotal (kuning muda #FFFFCC)
 */
const SUBTOTAL_STYLE = {
  font: { bold: true, size: 10, name: "Calibri" },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFCC" } },
  alignment: { vertical: "middle", horizontal: "left" },
  border: BORDER_THIN,
};

/**
 * Style untuk baris total (biru muda #B8CCE4)
 */
const TOTAL_STYLE = {
  font: { bold: true, size: 10, name: "Calibri" },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } },
  alignment: { vertical: "middle", horizontal: "left" },
  border: BORDER_THIN,
};

/**
 * Style untuk baris data (zebra stripe)
 */
function getDataStyle(isOdd) {
  return {
    font: { size: 10, name: "Calibri" },
    fill: isOdd
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } }
      : undefined,
    alignment: { vertical: "middle", horizontal: "left" },
    border: BORDER_THIN,
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const workbook = new ExcelJS.Workbook();
  const reportName = reportConfig["name-reports"] || "Rekap Penjualan Bulanan Toko";
  const queriesExport = reportConfig["queries-export"] || [];

  // Ambil info cabang
  const cabang = cab ? await MCabang.findByPk(cab) : null;
  const branchName = cabang ? cabang.namacab : cab;

  logger.info(`[custom_exporter] Mulai build custom Excel: "${reportName}" | prd=${prd} | cab=${cab}`);

  // Helper untuk mendapatkan nama bulan
  const strMonthName = getMonthName(prd);

  // ─── Sheet 1: Rekap Bulanan ({prd}) ──────────────────────────────────────
  const sheet1Key = queriesExport[0]?.key || prd;
  const sheet1Data = results[sheet1Key] || [];

  if (sheet1Data.length > 0) {
    const sheet = workbook.addWorksheet(prd);
    let baris = 1;

    // --- Judul ---
    sheet.getCell(`A${baris}`).value = "REKAP PENJUALAN BULANAN TOKO";
    sheet.getRow(baris).font = { bold: true, size: 14, name: "Calibri" };
    sheet.getRow(baris).height = 28;
    baris++;

    // --- Periode ---
    sheet.getCell(`A${baris}`).value = `PERIODE : ${strMonthName}`;
    sheet.getRow(baris).font = { bold: true, size: 12, name: "Calibri" };
    sheet.getRow(baris).height = 22;
    baris++;

    // --- Spacer ---
    baris++;

    // --- Kolom: TOKO, NAMA, PENJUALAN, RETUR, PENJ_BERSIH_PPN, PPN, PENJ_BERSIH, THPP, MARGIN, MARGIN_PCT, HARI, SPD, STRUK, APC ---
    const columns = ["TOKO", "NAMA", "PENJUALAN", "RETUR", "PENJ_BERSIH_PPN", "PPN", "PENJ_BERSIH", "THPP", "MARGIN", "MARGIN_PCT", "HARI", "SPD", "STRUK", "APC"];

    // --- Subtotal Rows (4 baris pertama: CRM, Franchise, Reguler, All) ---
    const subtotalRows = sheet1Data.filter(row =>
      row.TOKO && (
        row.TOKO.includes("TOTAL TOKO CERIAMART") ||
        row.TOKO.includes("TOTAL TOKO FRANCHISE") ||
        row.TOKO.includes("TOTAL TOKO REGULER") ||
        row.TOKO.includes("TOTAL ALL TOKO")
      )
    );

    const detailRows = sheet1Data.filter(row =>
      row.TOKO && !row.TOKO.includes("TOTAL")
    );

    // Tulis subtotal rows
    for (const row of subtotalRows) {
      const values = columns.map(col => {
        const val = row[col];
        if (col === "TOKO" || col === "NAMA") return val || "";
        return val !== null && val !== undefined ? val : "";
      });

      const dataRow = sheet.addRow(values);
      dataRow.height = 20;

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.style = SUBTOTAL_STYLE;
        // Format angka untuk kolom numerik
        if (colNumber >= 3 && colNumber <= 14 && colNumber !== 11) {
          cell.numFmt = "#,##0";
        }
        // Format persentase untuk MARGIN_PCT
        if (colNumber === 10) {
          cell.numFmt = "#,##0.00";
        }
      });

      // Merge kolom TOKO dan NAMA untuk subtotal
      sheet.mergeCells(`A${dataRow.number}:B${dataRow.number}`);
    }

    // --- Spacer sebelum header ---
    baris = sheet.lastRow.number + 1;

    // --- Header Row ---
    const headerValues = ["TOKO", "NAMA", "PENJUALAN", "RETUR", "PENJ. BERSIH (-PPN)", "PPN", "PENJ. BERSIH", "THPP", "MARGIN", "%MGR", "HARI", "SPD", "STRUK", "APC"];
    const headerRow = sheet.addRow(headerValues);
    headerRow.height = 28;
    headerRow.eachCell({ includeEmpty: true }, cell => {
      cell.style = HEADER_STYLE;
    });

    // --- Data Rows (detail per toko) ---
    let rowNumber = 1;
    for (const row of detailRows) {
      const values = columns.map(col => {
        const val = row[col];
        if (col === "TOKO" || col === "NAMA") return val || "";
        return val !== null && val !== undefined ? val : "";
      });

      const dataRow = sheet.addRow(values);
      dataRow.height = 18;
      const isOdd = rowNumber % 2 === 1;

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.style = getDataStyle(isOdd);
        // Format angka untuk kolom numerik
        if (colNumber >= 3 && colNumber <= 14 && colNumber !== 11) {
          cell.numFmt = "#,##0";
        }
        // Format persentase untuk MARGIN_PCT
        if (colNumber === 10) {
          cell.numFmt = "#,##0.00";
        }
      });

      rowNumber++;
    }

    // --- Column Widths ---
    const colWidths = [10, 25, 15, 15, 18, 15, 15, 15, 15, 10, 8, 15, 10, 15];
    colWidths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    // --- Freeze Pane ---
    const subtotalCount = subtotalRows.length;
    const freezeRow = 3 + subtotalCount + 1 + 1; // title(1) + periode(1) + spacer(1) + subtotals(N) + header(1)
    sheet.views = [{ state: "frozen", ySplit: freezeRow }];

    sheet.views = [{ showGridLines: false }];

    logger.info(`[custom_exporter] Sheet "${prd}" built: ${detailRows.length} detail, ${subtotalRows.length} subtotal`);
  }

  // ─── Sheet 2: PER DAY ─────────────────────────────────────────────────────
  const sheet2Key = queriesExport[1]?.key || "PER DAY";
  const sheet2Data = results[sheet2Key] || [];

  if (sheet2Data.length > 0) {
    const sheet = workbook.addWorksheet("PER DAY");
    let baris = 1;

    // --- Judul ---
    sheet.getCell(`A${baris}`).value = "REKAP SALES PER HARI";
    sheet.getRow(baris).font = { bold: true, size: 14, name: "Calibri" };
    sheet.getRow(baris).height = 28;
    baris++;

    // --- Periode ---
    sheet.getCell(`A${baris}`).value = `PERIODE : ${strMonthName}`;
    sheet.getRow(baris).font = { bold: true, size: 12, name: "Calibri" };
    sheet.getRow(baris).height = 22;
    baris++;

    // --- Spacer ---
    baris++;

    // --- Header Row ---
    const headers = ["TANGGAL", "TOKO", "GROSS", "TRETUR", "TBERSIH", "TPPN", "THPP", "TMARGIN", "STRUK", "SPD", "STD", "APC"];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell({ includeEmpty: true }, cell => {
      cell.style = HEADER_STYLE;
    });

    // --- Data Rows ---
    const dataKeys = ["TANGGAL", "TOKO", "GROSS", "TRETUR", "TBERSIH", "TPPN", "THPP", "TMARGIN", "STRUK", "SPD", "STD", "APC"];

    // Pisahkan data biasa dan total
    const totalRow = sheet2Data.find(row => row.TANGGAL === "TOTAL");
    const dailyRows = sheet2Data.filter(row => row.TANGGAL !== "TOTAL");

    let rowNumber = 1;
    for (const row of dailyRows) {
      const values = dataKeys.map(col => {
        const val = row[col];
        return val !== null && val !== undefined ? val : "";
      });

      const dataRow = sheet.addRow(values);
      dataRow.height = 18;
      const isOdd = rowNumber % 2 === 1;

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.style = getDataStyle(isOdd);
        // Format angka untuk kolom numerik (kecuali TANGGAL)
        if (colNumber >= 3 && colNumber <= 12) {
          cell.numFmt = "#,##0";
        }
      });

      rowNumber++;
    }

    // --- Total Row ---
    if (totalRow) {
      const totalValues = dataKeys.map(col => {
        const val = totalRow[col];
        return val !== null && val !== undefined ? val : "";
      });

      const totalRowExcel = sheet.addRow(totalValues);
      totalRowExcel.height = 20;
      totalRowExcel.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.style = TOTAL_STYLE;
        if (colNumber >= 3 && colNumber <= 12) {
          cell.numFmt = "#,##0";
        }
      });
    }

    // --- Column Widths ---
    const colWidths = [12, 8, 15, 15, 15, 12, 15, 15, 10, 12, 8, 12];
    colWidths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    // --- Freeze Pane ---
    const freezeRow = 4; // title(1) + periode(1) + spacer(1) = 3, header di row 4
    sheet.views = [{ state: "frozen", ySplit: freezeRow }];
    sheet.views = [{ showGridLines: false }];

    logger.info(`[custom_exporter] Sheet "PER DAY" built: ${dailyRows.length} daily rows + total`);
  }

  // ─── Response ─────────────────────────────────────────────────────────────
  const filename = `${reportName} Cabang ${cab || ""} ${prd || ""}.xlsx`;

  logger.info(`[custom_exporter] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[custom_exporter] Stream selesai: "${filename}"`);
}
