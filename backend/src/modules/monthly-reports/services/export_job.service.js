/**
 * Export Job Service — Monthly Reports
 *
 * Mengelola lifecycle file hasil export async:
 *   1. ExportFileResponse — adapter stream yang menerima output dari exporter.
 *      Meniru antarmuka minimal Express `res` yang dipakai exporter
 *      (setHeader / status / json / write / end), sehingga SEMUA exporter
 *      (default + custom) TIDAK perlu diubah.
 *   2. Job registry (in-memory) — memetakan taskId → { filePath, fileName, status }.
 *      Download endpoint membaca registry ini (bukan progressMap, karena
 *      progressMap menghapus task 2 detik setelah selesai).
 *   3. TTL cleanup — hapus file staging yang kedaluwarsa, termasuk sisa
 *      proses yang crash / server restart.
 */
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { Writable } from "stream";
import { fileURLToPath } from "url";
import { dirname } from "path";
import logger from "../../../config/logger.js";
import config from "../monthly_reports.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// __dirname = backend/src/modules/monthly-reports/services → naik 4 level = backend/
export const STAGING_ROOT = path.join(__dirname, "../../../../", config.export.stagingDir);

// ─── Registry (in-memory) ───────────────────────────────────────────────────
// taskId → { filePath, fileName, status: "processing" | "completed", createdAt }
const jobRegistry = new Map();

export function sanitizeTaskId(taskId) {
  return String(taskId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function stagingDirFor(taskId) {
  return path.join(STAGING_ROOT, sanitizeTaskId(taskId));
}

export function registerJob(taskId, meta) {
  jobRegistry.set(taskId, { ...meta, createdAt: Date.now() });
  startCleanupTimer();
  return getJob(taskId);
}

export function getJob(taskId) {
  return jobRegistry.get(taskId) || null;
}

export function removeJob(taskId) {
  const job = jobRegistry.get(taskId);
  jobRegistry.delete(taskId);
  return job;
}

export function listJobs() {
  return [...jobRegistry.entries()];
}

// ─── ExportFileResponse: adapter stream (meniru Express res minimal) ─────────
export class ExportFileResponse extends Writable {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.headers = {};
    this.statusCode = 200;
    this.jsonBody = null;
    this.headersSent = false;
    this.fileStream = fs.createWriteStream(filePath);
    // Forward error stream file ke stream utama agar promise tidak menggantung
    this.fileStream.on("error", err => this.destroy(err));
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
    this.headersSent = true;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(body) {
    this.jsonBody = body;
    this.headersSent = true;
    // Tidak menutup fileStream di sini — finalisasi stream (end) dilakukan oleh
    // pemanggil (controller) agar konsisten untuk semua jalur (json / write+end).
  }

  send(body) {
    this.jsonBody = body;
  }

  _write(chunk, enc, cb) {
    this.fileStream.write(chunk, enc, cb);
  }

  _final(cb) {
    this.fileStream.end(cb);
  }

  // Saat stream di-destroy (jalur error/cancel), pastikan file handle ikut ditutup
  // agar folder staging bisa dihapus (penting di Windows — file yang terbuka tidak
  // bisa di-rm).
  _destroy(err, cb) {
    this.fileStream.destroy();
    cb(err);
  }
}

/**
 * Tunggu sampai seluruh isi stream selesai di-flush ke disk.
 * Aman jika stream sudah error/destroy sebelum listener dipasang.
 */
export async function waitForStreamFinished(stream) {
  if (stream.errored) throw stream.errored;
  if (stream.writableFinished) return;
  await new Promise((resolve, reject) => {
    stream.once("finish", resolve);
    stream.once("error", reject);
  });
}

// ─── TTL Cleanup ─────────────────────────────────────────────────────────────
let cleanupTimer = null;

function startCleanupTimer() {
  if (cleanupTimer) return;
  const intervalMs = config.export.cleanupIntervalMinutes * 60 * 1000;
  cleanupTimer = setInterval(() => {
    cleanupStaleExports().catch(err =>
      logger.warn(`[export_job] Cleanup gagal: ${err.message}`),
    );
  }, intervalMs);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Hapus job lama: dari registry + direktori staging.
 * Juga memindai direktori staging untuk membersihkan sisa proses yang crash
 * (mis. server restart sebelum job selesai).
 */
export async function cleanupStaleExports(ttlMs = config.export.ttlHours * 60 * 60 * 1000) {
  const threshold = Date.now() - ttlMs;

  // 1. Hapus entry registry yang kedaluwarsa beserta foldernya
  for (const [taskId, job] of jobRegistry.entries()) {
    if (job.createdAt < threshold) {
      jobRegistry.delete(taskId);
      const dir = path.dirname(job.filePath);
      await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => {});
      logger.info(`[export_job] Job kedaluwarsa dihapus: ${taskId}`);
    }
  }

  // 2. Orphan directories (sisa crash / restart)
  let entries = [];
  try {
    entries = await fsPromises.readdir(STAGING_ROOT, { withFileTypes: true });
  } catch {
    return; // staging root belum ada — tidak ada yang perlu dibersihkan
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(STAGING_ROOT, entry.name);
    try {
      const st = await fsPromises.stat(dirPath);
      if (st.mtimeMs < threshold) {
        await fsPromises.rm(dirPath, { recursive: true, force: true });
        logger.info(`[export_job] File export kedaluwarsa dihapus: ${dirPath}`);
      }
    } catch {
      /* ignore — folder mungkin sudah dihapus */
    }
  }
}

/**
 * Hapus staging dir + registry entry untuk satu task (saat gagal / dibatalkan).
 */
export async function removeJobAndDir(taskId) {
  removeJob(taskId);
  const dir = stagingDirFor(taskId);
  await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => {});
  return null;
}

export default {
  STAGING_ROOT,
  sanitizeTaskId,
  stagingDirFor,
  registerJob,
  getJob,
  removeJob,
  removeJobAndDir,
  listJobs,
  cleanupStaleExports,
  ExportFileResponse,
  waitForStreamFinished,
};
