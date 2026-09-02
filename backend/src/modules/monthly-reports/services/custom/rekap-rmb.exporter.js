/**
 * Custom Exporter — REKAP RMB
 *
 * Menghasilkan file Excel (.xlsx) dengan 1 sheet:
 *   - Sheet {prd} : Rekap RMB per toko dengan nama toko
 *
 * Layout mengikuti referensi REKAPRMB_G{cab}_{prd}.xlsx
 * - Header frozen (xSplit=1, ySplit=1)
 * - Format angka: #,##0
 * - Tambah kolom NAMA_TOKO dari mstr_toko_all
 */

import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
 * Style untuk header kolom
 */
const HEADER_STYLE = {
  font: { bold: true, size: 11, name: "Aptos Narrow", color: { theme: 1 } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } },
  alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  border: BORDER_THIN,
};

/**
 * Style untuk baris data
 */
const DATA_STYLE = {
  font: { size: 11, name: "Aptos Narrow", color: { theme: 1 } },
  alignment: { vertical: "middle", horizontal: "left" },
  border: BORDER_THIN,
};

/**
 * Format angka dengan pemisah ribuan
 */
const NUM_FMT = "#,##0";

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const workbook = new ExcelJS.Workbook();
  const reportName = reportConfig["name-reports"] || "REKAP RMB";
  const queriesExport = reportConfig["queries-export"] || [];

  logger.info(`[custom_exporter_rmb] Mulai build custom Excel: "${reportName}" | prd=${prd} | cab=${cab}`);

  // Ambil data dari query pertama
  const dataKey = queriesExport[0]?.key || "Data";
  const data = results[dataKey] || [];

  if (data.length === 0) {
    logger.warn(`[custom_exporter_rmb] Tidak ada data untuk laporan REKAP RMB`);
    res.status(404).json({ message: "Tidak ada data untuk periode ini" });
    return;
  }

  // ─── Sheet: {prd} ─────────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet(prd);

  // Header kolom (sesuai referensi: KDTK, NAMA_TOKO, SALES_RMB, HPP_RMB, PPN_RMB, SALES_NON_RMB, HPP_NON_RMB, PPN_NON_RMB)
  const headers = ["KDTK", "NAMA_TOKO", "SALES_RMB", "HPP_RMB", "PPN_RMB", "SALES_NON_RMB", "HPP_NON_RMB", "PPN_NON_RMB"];
  
  // Tulis header row
  const headerRow = sheet.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.style = HEADER_STYLE;
  });

  // Data rows
  let rowNumber = 1;
  for (const row of data) {
    const values = [
      row.KDTK || "",
      row.NAMA_TOKO || "",
      row.SALES_RMB || 0,
      row.HPP_RMB || 0,
      row.PPN_RMB || 0,
      row.SALES_NON_RMB || 0,
      row.HPP_NON_RMB || 0,
      row.PPN_NON_RMB || 0,
    ];

    const dataRow = sheet.addRow(values);
    dataRow.height = 18;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.style = DATA_STYLE;
      // Format angka untuk kolom numerik (kolom 3-8)
      if (colNumber >= 3 && colNumber <= 8) {
        cell.numFmt = NUM_FMT;
      }
    });

    rowNumber++;
  }

  // Column widths (sesuai referensi + tambah untuk NAMA_TOKO)
  const colWidths = [8, 25, 14, 14, 12, 16, 14, 14];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // Freeze pane: freeze baris 1 (header) dan kolom 1 (KDTK)
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  // Hide gridlines untuk tampilan bersih
  sheet.views = [{ showGridLines: false }];

  logger.info(`[custom_exporter_rmb] Sheet "${prd}" built: ${data.length} rows`);

  // ─── Response ─────────────────────────────────────────────────────────────
  // Format filename sesuai referensi: REKAPRMB_G{cab}_{prd}.xlsx
  const cabCode = cab || "G000";
  const filename = `REKAPRMB_G${cabCode}_${prd}.xlsx`;

  logger.info(`[custom_exporter_rmb] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[custom_exporter_rmb] Stream selesai: "${filename}"`);
}
