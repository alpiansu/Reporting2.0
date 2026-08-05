/**
 * Export Job Service — Monthly Reports
 *
 * Mengelola SELURUH lifecycle export async secara self-contained,
 * TERLEPAS dari modul progress/screening:
 *
 *   1. ExportFileResponse — adapter stream yang menerima output dari exporter.
 *      Meniru antarmuka minimal Express `res` yang dipakai exporter
 *      (setHeader / status / json / write / end), sehingga SEMUA exporter
 *      (default + custom) TIDAK perlu diubah.
 *   2. Job state machine — setiap export punya status lengkap:
 *      queued → processing → completed | failed | cancelled.
 *   3. FIFO queue dengan concurrency terbatas (config.export.maxConcurrentExports).
 *      Semua user berbagi antrian (tidak ada penolakan 409 — job menunggu slot).
 *   4. SSE broadcast — per-user global stream (dipakai widget frontend) +
 *      per-task stream (fallback polling tetap tersedia via REST).
 *   5. Abort — cancel tidak lagi lewat /api/progress; cukup requestAbort(taskId)
 *      yang dicek pipeline antar-query.
 *   6. TTL cleanup — hapus file staging yang kedaluwarsa, termasuk sisa
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

// ─── State (in-memory) ───────────────────────────────────────────────────────
// taskId → job object penuh (lihat createJob)
const jobMap = new Map();
// taskId → runner (async pipeline dari controller); hanya ada saat antri → dijalankan
const runnerMap = new Map();
// taskId yang diminta dibatalkan (cancel saat processing)
const abortSet = new Set();
// Antrian FIFO (taskId). Semua user berbagi antrian.
const queue = [];
let runningCount = 0;

const ACTIVE_STATUSES = ["queued", "processing"];

// ─── SSE clients ─────────────────────────────────────────────────────────────
// userId → Set<res> (stream global per user); taskId → Set<res> (stream per task)
const userClients = new Map();
const taskClients = new Map();

function sendSSE(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcastJob(job) {
  if (!job) return;
  const payload = { job };
  const userSet = userClients.get(job.userId);
  if (userSet) for (const res of userSet) sendSSE(res, "update", payload);
  const taskSet = taskClients.get(job.taskId);
  if (taskSet) for (const res of taskSet) sendSSE(res, "update", payload);
}

function emitRemove(taskId) {
  const job = jobMap.get(taskId);
  const userId = job?.userId;
  if (userId) {
    const userSet = userClients.get(userId);
    if (userSet) for (const res of userSet) sendSSE(res, "remove", { taskId });
  }
  const taskSet = taskClients.get(taskId);
  if (taskSet) for (const res of taskSet) sendSSE(res, "remove", { taskId });
  taskClients.delete(taskId);
}

/** Header HTTP untuk koneksi SSE (pola sama dengan modul progress). */
export function setupSSEHeaders(res) {
  res.set({
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
}

/**
 * Daftarkan koneksi SSE global milik satu user.
 * Langsung mengirim snapshot (init) semua job user, lalu heartbeat + broadcast.
 * @returns {Function} cleanup — panggil saat koneksi ditutup
 */
export function subscribeUser(userId, res) {
  let set = userClients.get(userId);
  if (!set) {
    set = new Set();
    userClients.set(userId, set);
  }
  set.add(res);

  sendSSE(res, "init", { jobs: listJobsByUser(userId) });

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(": heartbeat\n\n");
  }, config.export.sseKeepAliveMs);
  if (heartbeat.unref) heartbeat.unref();

  const cleanup = () => {
    clearInterval(heartbeat);
    set.delete(res);
    if (set.size === 0) userClients.delete(userId);
  };
  res.on("close", cleanup);
  res.on("error", cleanup);
  return cleanup;
}

/**
 * Daftarkan koneksi SSE untuk satu task (fallback / halaman laporan).
 * @returns {Function} cleanup
 */
export function subscribeTask(taskId, res) {
  let set = taskClients.get(taskId);
  if (!set) {
    set = new Set();
    taskClients.set(taskId, set);
  }
  set.add(res);

  sendSSE(res, "init", { job: getJob(taskId) });

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(": heartbeat\n\n");
  }, config.export.sseKeepAliveMs);
  if (heartbeat.unref) heartbeat.unref();

  const cleanup = () => {
    clearInterval(heartbeat);
    set.delete(res);
    if (set.size === 0) taskClients.delete(taskId);
  };
  res.on("close", cleanup);
  res.on("error", cleanup);
  return cleanup;
}

// ─── Abort (pengganti progressService.isAborted) ─────────────────────────────
export function requestAbort(taskId) {
  abortSet.add(taskId);
  logger.info(`[export_job] Abort requested untuk job: ${taskId}`);
}

export function isAborted(taskId) {
  return abortSet.has(taskId);
}

export function clearAbort(taskId) {
  if (abortSet.has(taskId)) {
    abortSet.delete(taskId);
    logger.info(`[export_job] Abort flag dihapus untuk job: ${taskId}`);
  }
}

// ─── Job state machine ───────────────────────────────────────────────────────
export function sanitizeTaskId(taskId) {
  return String(taskId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function stagingDirFor(taskId) {
  return path.join(STAGING_ROOT, sanitizeTaskId(taskId));
}

/**
 * Buat job baru dengan status 'queued' + broadcast.
 * @param {Object} meta - { taskId, userId, startedBy, reportName, reportId, cab, prd }
 */
export function createJob(meta) {
  const now = new Date().toISOString();
  const job = {
    taskId: meta.taskId,
    status: "queued",
    percentage: 0,
    message: "Menunggu giliran proses...",
    queuePosition: 0,
    reportName: meta.reportName || "Laporan",
    reportId: meta.reportId,
    cab: meta.cab,
    prd: meta.prd,
    userId: meta.userId,
    startedBy: meta.startedBy,
    fileName: null,
    filePath: null,
    error: null,
    cancelRequested: false,
    createdAt: now,
    updatedAt: now,
  };
  jobMap.set(meta.taskId, job);
  broadcastJob(job);
  return job;
}

/**
 * Masukkan job ke antrian FIFO + jalankan slot yang tersedia.
 * Runner dipanggil dengan argumen job; runner wajib menutup lifecycle via
 * completeJob / failJob. Slot dilepas otomatis setelah runner selesai.
 */
export function enqueueJob(taskId, runner) {
  if (!jobMap.has(taskId)) throw new Error(`Job '${taskId}' tidak ditemukan`);
  runnerMap.set(taskId, runner);
  queue.push(taskId);
  refreshQueuePositions();
  pump();
}

function pump() {
  while (runningCount < config.export.maxConcurrentExports && queue.length > 0) {
    const taskId = queue.shift();
    const job = jobMap.get(taskId);
    const runner = runnerMap.get(taskId);
    if (!job || !runner) continue; // sudah dibatalkan/dihapus saat antri

    runningCount++;
    runnerMap.delete(taskId);
    job.status = "processing";
    job.queuePosition = 0;
    job.message = "Memulai export...";
    job.updatedAt = new Date().toISOString();
    broadcastJob(job);
    refreshQueuePositions(); // posisi sisa antrian bergeser

    runner(job)
      .catch(err => {
        // Runner tidak boleh throw; kalau terjadi, pastikan job di-fail-kan
        logger.error(`[export_job] Runner ${taskId} crash: ${err.message}`);
        return failJob(taskId, err.message);
      })
      .finally(() => releaseSlot());
  }
}

function releaseSlot() {
  runningCount = Math.max(0, runningCount - 1);
  pump();
}

/** Perbarui posisi antrian (indeks FIFO 1-based) + broadcast untuk job yang berubah. */
function refreshQueuePositions() {
  queue.forEach((taskId, idx) => {
    const job = jobMap.get(taskId);
    if (job && job.queuePosition !== idx + 1) {
      job.queuePosition = idx + 1;
      job.updatedAt = new Date().toISOString();
      broadcastJob(job);
    }
  });
}

/**
 * Update sebagian state job + broadcast.
 * Return null jika job sudah dihapus (mis. dibatalkan saat antri).
 */
export function updateJob(taskId, patch) {
  const job = jobMap.get(taskId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  broadcastJob(job);
  return job;
}

/**
 * Tandai job selesai + daftarkan file di registry (untuk endpoint download).
 */
export function completeJob(taskId, { fileName, filePath }) {
  const job = jobMap.get(taskId);
  if (!job) return null;
  job.status = "completed";
  job.percentage = 100;
  job.message = "Export selesai. File siap diunduh.";
  job.fileName = fileName;
  job.filePath = filePath;
  job.fileCreatedAt = new Date().toISOString();
  job.error = null;
  job.updatedAt = new Date().toISOString();
  clearAbort(taskId);
  broadcastJob(job);
  startCleanupTimer();
  return job;
}

/**
 * Tandai job gagal / dibatalkan (status mengikuti flag cancelRequested).
 * Broadcast dilakukan di sini; pemanggil (controller) yang membersihkan
 * staging dir via removeJobAndDir.
 */
export function failJob(taskId, errorMessage) {
  const job = jobMap.get(taskId);
  if (!job) return null;
  const cancelled = !!job.cancelRequested;
  job.status = cancelled ? "cancelled" : "failed";
  job.error = errorMessage;
  job.message = cancelled ? "Export dibatalkan oleh pengguna" : "Export gagal";
  job.updatedAt = new Date().toISOString();
  clearAbort(taskId);
  broadcastJob(job);
  return job;
}

/**
 * Batalkan job. Otorisasi (initiator/admin) dicek DI SINI agar satu pintu.
 * - status 'queued'   → langsung dihapus dari antrian + state 'cancelled'.
 * - status 'processing' → requestAbort; pipeline berhenti di checkpoint
 *   berikutnya lalu failJob menghasilkan status 'cancelled'.
 * @throws Error dengan properti .status (403/404/409)
 */
export function cancelJob(taskId, requester = {}) {
  const job = jobMap.get(taskId);
  if (!job) {
    const err = new Error(`Job '${taskId}' tidak ditemukan`);
    err.status = 404;
    throw err;
  }
  if (!["queued", "processing"].includes(job.status)) {
    const err = new Error("Job sudah selesai / dibatalkan sebelumnya");
    err.status = 409;
    throw err;
  }

  const username = requester?.username;
  const isAdmin = ["admin", "superadmin"].includes(requester?.role);
  const isInitiator =
    job.startedBy && username &&
    String(job.startedBy).toLowerCase() === String(username).toLowerCase();
  if (!isInitiator && !isAdmin) {
    const err = new Error(
      `Hanya initiator (${job.startedBy}) atau admin yang dapat membatalkan export ini. Anda (${username}) tidak memiliki izin.`,
    );
    err.status = 403;
    throw err;
  }

  if (job.status === "queued") {
    const idx = queue.indexOf(taskId);
    if (idx !== -1) queue.splice(idx, 1);
    job.status = "cancelled";
    job.error = "Export dibatalkan oleh pengguna";
    job.message = "Export dibatalkan oleh pengguna";
    job.percentage = 0;
    job.updatedAt = new Date().toISOString();
    broadcastJob(job);
    emitRemove(taskId);
    // bersihkan registry + staging (belum ada file — aman)
    removeJobAndDir(taskId).catch(() => {});
    refreshQueuePositions();
    return job;
  }

  // processing: minta berhenti, pipeline akan menyelesaikan di checkpoint
  job.cancelRequested = true;
  job.message = "Membatalkan export...";
  job.updatedAt = new Date().toISOString();
  requestAbort(taskId);
  broadcastJob(job);
  return job;
}

export function getJob(taskId) {
  return jobMap.get(taskId) || null;
}

export function removeJob(taskId) {
  const job = jobMap.get(taskId);
  jobMap.delete(taskId);
  runnerMap.delete(taskId);
  clearAbort(taskId);
  return job;
}

/** Hapus registry entry + staging dir (dipakai saat gagal/batal/TTL). */
export async function removeJobAndDir(taskId) {
  // emitRemove HARUS sebelum removeJob — emitRemove membaca userId dari jobMap
  // untuk mengarahkan event 'remove' ke stream SSE user yang tepat.
  emitRemove(taskId);
  const job = removeJob(taskId);
  const dir = stagingDirFor(taskId);
  await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => {});
  return job;
}

/** Semua job (untuk testing/cleanup). */
export function listJobs() {
  return [...jobMap.values()];
}

/** Job milik satu user, terbaru dulu. */
export function listJobsByUser(userId) {
  return [...jobMap.values()]
    .filter(j => j.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Statistik antrian (untuk response startExport / status). */
export function getQueueStats() {
  return {
    maxConcurrentExports: config.export.maxConcurrentExports,
    running: runningCount,
    queued: queue.length,
  };
}

/** Guard duplikasi: job aktif (antri/proses) untuk laporan+cab+prd yang sama. */
export function findActiveJobByKey({ reportId, cab, prd }) {
  for (const job of jobMap.values()) {
    if (
      ACTIVE_STATUSES.includes(job.status) &&
      job.reportId === reportId &&
      job.cab === cab &&
      job.prd === prd
    ) {
      return job;
    }
  }
  return null;
}

/** Cari job completed untuk laporan+cab+prd yang sama. */
export function findCompletedJobByKey({ reportId, cab, prd }) {
  for (const job of jobMap.values()) {
    if (
      job.status === "completed" &&
      job.reportId === reportId &&
      job.cab === cab &&
      job.prd === prd
    ) {
      return job;
    }
  }
  return null;
}

/**
 * Hapus job completed lama untuk kombinasi reportId+cab+prd.
 * Membersihkan registry entry + direktori staging + broadcast SSE remove.
 * Return daftar taskId yang dihapus.
 */
export async function removeCompletedJobByKey({ reportId, cab, prd }) {
  const removed = [];
  for (const [taskId, job] of jobMap.entries()) {
    if (
      job.status === "completed" &&
      job.reportId === reportId &&
      job.cab === cab &&
      job.prd === prd
    ) {
      await removeJobAndDir(taskId);
      removed.push(taskId);
    }
  }
  return removed;
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
  for (const [taskId, job] of jobMap.entries()) {
    const createdAt = new Date(job.createdAt).getTime();
    if (createdAt < threshold) {
      emitRemove(taskId); // sebelum hapus dari map — emitRemove butuh userId dari job
      jobMap.delete(taskId);
      const dir = job.filePath ? path.dirname(job.filePath) : stagingDirFor(taskId);
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

// Startup: bersihkan sisa staging dari proses/server sebelumnya.
// Ditunda agar tidak bersaing dengan bootstrapping server.
setTimeout(() => {
  cleanupStaleExports().catch(() => {});
}, 5000);

export default {
  STAGING_ROOT,
  setupSSEHeaders,
  subscribeUser,
  subscribeTask,
  sanitizeTaskId,
  stagingDirFor,
  createJob,
  enqueueJob,
  updateJob,
  completeJob,
  failJob,
  cancelJob,
  requestAbort,
  isAborted,
  clearAbort,
  getJob,
  removeJob,
  removeJobAndDir,
  listJobs,
  listJobsByUser,
  getQueueStats,
  findActiveJobByKey,
  findCompletedJobByKey,
  removeCompletedJobByKey,
  cleanupStaleExports,
  ExportFileResponse,
  waitForStreamFinished,
};
