import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import logger from "../../../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/**
 * Menyelesaikan (resolve) exporter mana yang akan digunakan.
 *
 * Urutan prioritas:
 *   1. Jika format === "pdf":
 *      a. Cek custom/{idReports}.pdf.exporter.js
 *      b. Jika tidak ada → throw error (wajib buat custom exporter)
 *   2. Cek custom/{idReports}.exporter.js (Excel custom)
 *   3. Fallback ke default excel_export.service.js
 *
 * @param {string} idReports - ID laporan dari konfigurasi
 * @param {string} format    - Format output: "pdf" | "excel" | undefined
 * @returns {Promise<Object>} Modul exporter yang memiliki fungsi exportToResponse
 */
export async function resolveExporter(idReports, format) {
  const safeId = String(idReports).replace(/[^a-zA-Z0-9_\-\.]/g, "_");

  // ── 1. Format-based resolution: PDF ──────────────────────────────────────
  if (format === "pdf") {
    // 1a. Cek custom PDF exporter dulu
    const customPdfPath = path.join(__dirname, `custom/${safeId}.pdf.exporter.js`);
    try {
      const customPdfMod = await import(pathToFileURL(customPdfPath).href);
      logger.info(`[exporter_resolver] Custom PDF exporter ditemukan untuk ID: ${idReports}`);
      return customPdfMod.default ?? customPdfMod;
    } catch (err) {
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
        throw new Error(`Tidak ada custom PDF exporter untuk ID: ${idReports}. Buat file custom/${safeId}.pdf.exporter.js terlebih dahulu.`);
      }
      logger.error(`[exporter_resolver] Gagal meload custom PDF exporter: ${err.message}`);
      throw err;
    }
  }

  // ── 2. Custom Excel exporter per report ID ───────────────────────────────
  const customPath = path.join(__dirname, `custom/${safeId}.exporter.js`);

  try {
    const mod = await import(pathToFileURL(customPath).href);
    logger.info(`[exporter_resolver] Custom Excel exporter ditemukan untuk ID: ${idReports}`);
    return mod.default ?? mod;
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
      // ── 3. Fallback: default Excel ─────────────────────────────────────
      logger.info(`[exporter_resolver] Tidak ada custom Excel exporter untuk ID: ${idReports}, menggunakan default excel.`);
      const defaultMod = await import("./excel_export.service.js");
      return defaultMod;
    }
    logger.error(`[exporter_resolver] Gagal meload custom Excel exporter: ${err.message}`);
    throw err;
  }
}
