/**
 * Config Loader Service — Monthly Reports
 *
 * Mengelola operasi CRUD terhadap file monthly_reports_config.json
 * Setiap operasi tulis menggunakan atomic write (tmp → rename) agar
 * file tidak korup jika proses terhenti di tengah jalan.
 *
 * Semua field audit (addtime, addid, updtime, updid) diatur di sini.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import crypto from "crypto";
import logger from "../../../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path ke file JSON config, relatif dari root project
const CONFIG_PATH = path.join(
  __dirname,
  "../../../../../data/monthly-reports/monthly_reports_config.json"
);

// Helper: format waktu lokal server → "YYYY-MM-DD HH:mm:ss"
function getLocalDatetime() {
  const now = new Date();
  const y   = now.getFullYear();
  const mo  = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  const h   = String(now.getHours()).padStart(2, "0");
  const mi  = String(now.getMinutes()).padStart(2, "0");
  const s   = String(now.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

// Helper: baca file JSON config
async function readConfig() {
  try {
    logger.debug("[config_loader] Membaca file config JSON...");
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      logger.warn("[config_loader] Format JSON tidak valid (bukan array), reset ke []");
      return [];
    }
    logger.debug(`[config_loader] Config terbaca: ${data.length} item`);
    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      logger.warn("[config_loader] File config belum ada, return [] kosong");
      return [];
    }
    logger.error(`[config_loader] Gagal membaca config: ${err.message}`);
    throw err;
  }
}

// Helper: tulis file JSON config secara atomic (tmp → rename)
async function writeConfig(data) {
  const tmpPath = CONFIG_PATH + ".tmp";
  try {
    logger.debug(`[config_loader] Menulis config (${data.length} item) secara atomic...`);
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmpPath, CONFIG_PATH);
    logger.debug("[config_loader] Config berhasil ditulis (atomic)");
  } catch (err) {
    logger.error(`[config_loader] Gagal menulis config: ${err.message}`);
    // Bersihkan tmp jika ada
    try { await fs.unlink(tmpPath); } catch (_) { /* ignore */ }
    throw err;
  }
}

// ─── CRUD Functions ───────────────────────────────────────────────────────────

/**
 * List semua report
 * @returns {Promise<Array>}
 */
export async function listReports() {
  logger.info("[config_loader] listReports()");
  return await readConfig();
}

/**
 * Ambil satu report berdasarkan id-reports
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getReportById(id) {
  logger.info(`[config_loader] getReportById(${id})`);
  const config = await readConfig();
  const found = config.find(r => r["id-reports"] === id);
  if (!found) {
    logger.warn(`[config_loader] Report id=${id} tidak ditemukan`);
  }
  return found || null;
}

/**
 * Buat report baru
 * @param {Object} data  - Data report (tanpa audit fields)
 * @param {string} userId - Username / PIC user aktif
 * @returns {Promise<Object>} Report yang baru dibuat
 */
export async function createReport(data, userId) {
  logger.info(`[config_loader] createReport() oleh userId=${userId}`);
  const config = await readConfig();

  // Generate id jika tidak disertakan, atau validasi keunikan
  const newId = data["id-reports"] || crypto.randomUUID();
  if (config.find(r => r["id-reports"] === newId)) {
    throw new Error(`id-reports "${newId}" sudah digunakan, pilih id yang lain`);
  }

  const now = getLocalDatetime();
  const newReport = {
    "id-reports":     newId,
    "name-reports":   data["name-reports"] || "Laporan Baru",
    "queries-wrc":    Array.isArray(data["queries-wrc"])    ? data["queries-wrc"]    : [],
    "queries-export": Array.isArray(data["queries-export"]) ? data["queries-export"] : [],
    "addtime": now,
    "addid":   userId,
    "updtime": now,
    "updid":   userId,
  };

  config.push(newReport);
  await writeConfig(config);

  logger.info(`[config_loader] Report baru dibuat: id=${newId}, name="${newReport["name-reports"]}"`);
  return newReport;
}

/**
 * Update report yang sudah ada
 * @param {string} id
 * @param {Object} data  - Field yang ingin diupdate
 * @param {string} userId - Username / PIC user aktif
 * @returns {Promise<Object>} Report setelah diupdate
 */
export async function updateReport(id, data, userId) {
  logger.info(`[config_loader] updateReport(${id}) oleh userId=${userId}`);
  const config = await readConfig();
  const idx = config.findIndex(r => r["id-reports"] === id);

  if (idx === -1) {
    throw new Error(`Report id="${id}" tidak ditemukan`);
  }

  const existing = config[idx];

  // Merge field yang boleh diubah (addtime/addid TIDAK boleh berubah)
  const updated = {
    ...existing,
    "name-reports":   data["name-reports"]   !== undefined ? data["name-reports"]   : existing["name-reports"],
    "queries-wrc":    data["queries-wrc"]    !== undefined ? data["queries-wrc"]    : existing["queries-wrc"],
    "queries-export": data["queries-export"] !== undefined ? data["queries-export"] : existing["queries-export"],
    // Audit: addtime & addid TIDAK diubah
    "addtime": existing["addtime"],
    "addid":   existing["addid"],
    // updtime & updid selalu diperbarui
    "updtime": getLocalDatetime(),
    "updid":   userId,
  };

  config[idx] = updated;
  await writeConfig(config);

  logger.info(`[config_loader] Report id=${id} berhasil diupdate oleh ${userId}`);
  return updated;
}

/**
 * Hapus report
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteReport(id) {
  logger.info(`[config_loader] deleteReport(${id})`);
  const config = await readConfig();
  const idx = config.findIndex(r => r["id-reports"] === id);

  if (idx === -1) {
    throw new Error(`Report id="${id}" tidak ditemukan`);
  }

  const [removed] = config.splice(idx, 1);
  await writeConfig(config);

  logger.info(`[config_loader] Report id=${id} ("${removed["name-reports"]}") berhasil dihapus`);
  return true;
}
