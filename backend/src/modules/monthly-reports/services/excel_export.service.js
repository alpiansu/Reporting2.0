/**
 * Excel Export Service — Monthly Reports
 *
 * Menghasilkan file Excel (.xlsx) berdasarkan:
 *   - reportConfig  : konfigurasi laporan dari JSON (nama, queries-export)
 *   - results       : data rows per sheet dari wrc_executor
 *
 * Fitur:
 *   - Satu sheet per queries-export[].key
 *   - Style resolver: default → custom global → custom per-sheet
 *   - Auto-width kolom
 *   - Freeze pane pada baris header
 *   - Streaming langsung ke HTTP response (tidak simpan file sementara)
 *   - Cleanup reference besar (results) setelah stream selesai
 *
 * Library: ExcelJS (sama dengan ceklist-prep-closing)
 */

import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import logger from "../../../config/logger.js";
import defaultStyle from "../styles/default.style.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Style Resolver ───────────────────────────────────────────────────────────

/**
 * Resolve styling untuk satu sheet:
 *   1. Mulai dari defaultStyle
 *   2. Coba load custom/{idReports}.style.js → merge global-nya
 *   3. Jika ada sheets[sheetKey] di custom → merge sheet-level
 *   4. Return merged style
 *
 * @param {string} idReports  - id-reports dari config
 * @param {string} sheetKey   - Nama sheet (queries-export[].key)
 * @returns {Promise<Object>} - Style object yang sudah di-merge
 */
async function resolveStyle(idReports, sheetKey) {
  let style = { ...defaultStyle };

  // Nama file custom: ganti karakter non-aman dengan underscore
  const safeId   = String(idReports).replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  const customPath = path.join(__dirname, `../styles/custom/${safeId}.style.js`);

  try {
    // Dynamic import — tidak throw jika file tidak ada, cukup skip
    const customModule = await import(pathToFileURL(customPath).href);
    const custom = customModule.default || customModule;

    if (custom.global) {
      style = { ...style, ...custom.global };
      logger.debug(`[excel_export] Custom global style diterapkan untuk id="${idReports}"`);
    }

    if (custom.sheets && custom.sheets[sheetKey]) {
      style = { ...style, ...custom.sheets[sheetKey] };
      logger.debug(`[excel_export] Custom sheet style diterapkan untuk sheet="${sheetKey}"`);
    }
  } catch (err) {
    if (err.code !== "ERR_MODULE_NOT_FOUND" && !err.message?.includes("Cannot find module")) {
      logger.warn(`[excel_export] Gagal load custom style (${safeId}): ${err.message}`);
    }
    // File tidak ada = normal, gunakan default saja
  }

  return style;
}

// ─── Sheet Builder ────────────────────────────────────────────────────────────

/**
 * Ambil nama-nama kolom dari rows (dari key pertama row pertama)
 * Fallback ke array kosong jika rows kosong.
 */
function extractColumns(rows) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]);
}

/**
 * Hitung lebar kolom otomatis berdasarkan isi data.
 */
function autoWidth(sheet, columns, rows, style) {
  const min = style.minColWidth || 10;
  const max = style.maxColWidth || 45;

  columns.forEach((col, idx) => {
    let maxLen = Math.max(min, String(col).length);
    rows.forEach(row => {
      const val = row[col];
      const len = val !== null && val !== undefined ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    });
    sheet.getColumn(idx + 1).width = Math.min(maxLen + 2, max);
  });
}

/**
 * Build satu worksheet dari rows data.
 *
 * @param {Object}   sheet     - ExcelJS Worksheet
 * @param {Array}    rows      - Array of row objects dari WRC
 * @param {string}   sheetKey  - Nama sheet (untuk log)
 * @param {Object}   style     - Resolved style
 */
function buildSheet(sheet, rows, sheetKey, style) {
  const columns = extractColumns(rows);

  if (columns.length === 0) {
    logger.warn(`[excel_export] Sheet "${sheetKey}" tidak memiliki data`);
    sheet.addRow(["Tidak ada data"]);
    return;
  }

  // ─── Title Row ────────────────────────────────────────────────────────────
  sheet.addRow([]);
  const titleRow = sheet.addRow([sheetKey]);
  titleRow.font   = style.titleFont;
  titleRow.height = (style.titleFont?.size || 13) * 2;
  sheet.addRow([]);

  // ─── Header Row ───────────────────────────────────────────────────────────
  const headerRow = sheet.addRow(columns);
  headerRow.eachCell(cell => {
    cell.fill      = style.headerFill;
    cell.font      = style.headerFont;
    cell.border    = style.borderThin;
    cell.alignment = style.headerAlignment;
  });
  headerRow.height = style.headerRowHeight || 28;

  // ─── Data Rows ────────────────────────────────────────────────────────────
  rows.forEach((rowObj, idx) => {
    const values  = columns.map(col => {
      const v = rowObj[col];
      return (v !== null && v !== undefined) ? v : "";
    });
    const dataRow = sheet.addRow(values);
    dataRow.height = style.dataRowHeight || 18;

    dataRow.eachCell({ includeEmpty: true }, cell => {
      if (idx % 2 === 1) cell.fill = style.altFill;
      cell.border    = style.borderThin;
      cell.font      = style.dataFont;
      cell.alignment = style.dataAlignment;
    });
  });

  // ─── Auto Width ───────────────────────────────────────────────────────────
  autoWidth(sheet, columns, rows, style);

  // ─── Freeze Pane ──────────────────────────────────────────────────────────
  // Baris freeze = title(1) + spacer(1) + header(1) = baris ke-4 (1-indexed)
  // Setelah title row (2 baris) + spacer + header = row 4 di sheet
  const freezeAt = (style.freezeRow || 1) + 3; // +3 karena ada spacer + title + spacer
  sheet.views = [{ state: "frozen", ySplit: freezeAt - 1 }];

  logger.debug(`[excel_export] Sheet "${sheetKey}" built: ${columns.length} kolom, ${rows.length} baris`);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generate Excel workbook dan stream ke HTTP response.
 *
 * @param {Object} options
 * @param {Object} options.reportConfig  - Config laporan dari JSON
 * @param {Object} options.results       - { [sheetKey]: rows[] } dari wrc_executor
 * @param {import('express').Response} options.res
 * @param {string} [options.prd]         - Periode YYMM (contoh: "2501") — disertakan ke nama file
 */
export async function exportToResponse({ reportConfig, results, res, prd = "" }) {
  const reportId   = reportConfig["id-reports"];
  const reportName = reportConfig["name-reports"];
  const queriesExport = reportConfig["queries-export"] || [];

  logger.info(`[excel_export] Mulai build Excel untuk laporan: "${reportName}" (${queriesExport.length} sheet)`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator  = "Reporting2.0 — monthly-reports";
  workbook.created  = new Date();
  workbook.modified = new Date();

  // ─── Build setiap sheet ──────────────────────────────────────────────────
  for (const item of queriesExport) {
    const sheetKey = item.key;
    const rows     = results[sheetKey] || [];

    logger.info(`[excel_export] Building sheet: "${sheetKey}" (${rows.length} baris)`);

    const style = await resolveStyle(reportId, sheetKey);
    const sheet = workbook.addWorksheet(sheetKey);
    buildSheet(sheet, rows, sheetKey, style);
  }

  // ─── Nama file output ──────────────────────────────────────────────
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
  const safeName = String(reportName).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_");
  // Format: {NamaLaporan}_{prd}_{tanggalGenerate}.xlsx
  // Contoh: Laporan_Penjualan_Bulanan_2501_20260502.xlsx
  const prdSuffix = prd ? `_${prd}` : "";
  const filename = `${safeName}${prdSuffix}_${dateStr}.xlsx`;

  logger.info(`[excel_export] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[excel_export] Stream selesai: "${filename}"`);
}
