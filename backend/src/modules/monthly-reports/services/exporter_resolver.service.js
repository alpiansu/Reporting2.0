import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import logger from "../../../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/**
 * Menyelesaikan (resolve) exporter mana yang akan digunakan.
 * Jika file custom/{idReports}.exporter.js ditemukan, gunakan itu.
 * Jika tidak, fallback ke default excel_export.service.js.
 * 
 * @param {string} idReports - ID laporan dari konfigurasi
 * @returns {Promise<Object>} Modul exporter yang memiliki fungsi exportToResponse
 */
export async function resolveExporter(idReports) {
  // Pastikan ID aman digunakan sebagai nama file
  const safeId = String(idReports).replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  const customPath = path.join(__dirname, `custom/${safeId}.exporter.js`);

  try {
    const mod = await import(pathToFileURL(customPath).href);
    logger.info(`[exporter_resolver] Custom exporter ditemukan untuk ID: ${idReports}`);
    return mod.default ?? mod; // Pastikan bisa akses { exportToResponse }
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
      logger.info(`[exporter_resolver] Tidak ada custom exporter untuk ID: ${idReports}, menggunakan default.`);
      // Tidak ada custom -> fallback pakai default
      const defaultMod = await import("./excel_export.service.js");
      return defaultMod;
    }
    logger.error(`[exporter_resolver] Gagal meload custom exporter: ${err.message}`);
    throw err;
  }
}
