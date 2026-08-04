/**
 * Controller — Monthly Reports
 *
 * Mengkoordinasi:
 *   - config_loader  : CRUD konfigurasi laporan (JSON file)
 *   - wrc_executor   : Eksekusi query ke WRC
 *   - exporter       : Build file hasil laporan (Excel / PDF / custom)
 *   - export_job     : Registry + staging file hasil export async
 *   - progress       : Tracking progress real-time (SSE) + cancel
 *
 * Alur EXPORT (async job, tidak lagi synchronous):
 *   1. POST /:id/export  → validasi, guard duplikasi, buat task progress, lalu
 *      jalankan pipeline di BACKGROUND. Response langsung 202 + taskId.
 *   2. Pipeline background: executeReport → exporter (tulis ke file staging)
 *      → update progress → complete/fail.
 *   3. GET /export/:taskId/file → stream file hasil dari staging.
 *
 * Keuntungan: proses >10 menit tidak lagi diputus oleh timeout HTTP; user
 * mendapat progress real-time via widget (modul progress) dan bisa membatalkan.
 */
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import progressService from "../progress/progress.service.js";
import * as configLoader from "./services/config_loader.service.js";
import { executeReport } from "./services/wrc_executor.service.js";
import { resolveExporter } from "./services/exporter_resolver.service.js";
import * as exportJob from "./services/export_job.service.js";

// ─── Helper: ambil userId dari JWT ────────────────────────────────────────────
function getUserId(req) {
  return req.user?.pic || req.user?.username || req.user?.id || "unknown";
}

/** Error marker: job dibatalkan oleh user (dideteksi via progressService.isAborted) */
class ExportCancelledError extends Error {
  constructor() {
    super("Export dibatalkan oleh pengguna");
    this.code = "EXPORT_CANCELLED";
  }
}

// ─── CRUD Config (JSON Management) ───────────────────────────────────────────

/**
 * GET /api/monthly-reports
 * List semua konfigurasi laporan dari JSON
 */
export const listReports = async (req, res) => {
  try {
    logger.info("[monthly_reports.controller] listReports");
    const data = await configLoader.listReports();
    // Kirim array langsung → frontend akses via res.data.data (array)
    return apiResponse.success(res, data);
  } catch (err) {
    logger.error(`[monthly_reports.controller] listReports error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * GET /api/monthly-reports/:id
 * Detail satu konfigurasi laporan
 */
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[monthly_reports.controller] getReportById id=${id}`);
    const data = await configLoader.getReportById(id);
    if (!data) return apiResponse.notFound(res, `Report id="${id}" tidak ditemukan`);
    return apiResponse.success(res, { data });
  } catch (err) {
    logger.error(`[monthly_reports.controller] getReportById error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * POST /api/monthly-reports
 * Buat konfigurasi laporan baru
 * Body: { "name-reports", "queries-wrc", "queries-export", "id-reports"(opsional) }
 */
export const createReport = async (req, res) => {
  try {
    const userId = getUserId(req);
    logger.info(`[monthly_reports.controller] createReport oleh user=${userId}`);

    const { "name-reports": name, "queries-wrc": qWrc, "queries-export": qExp, "queries-cleanup": qClean } = req.body;
    if (!name) return apiResponse.badRequest(res, "name-reports wajib diisi");
    if (!Array.isArray(qWrc))    return apiResponse.badRequest(res, "queries-wrc harus berupa array");
    if (!Array.isArray(qExp))    return apiResponse.badRequest(res, "queries-export harus berupa array");
    if (qClean && !Array.isArray(qClean)) return apiResponse.badRequest(res, "queries-cleanup harus berupa array");

    const data = await configLoader.createReport(req.body, userId);
    return apiResponse.success(res, { data, message: "Laporan berhasil dibuat" });
  } catch (err) {
    logger.error(`[monthly_reports.controller] createReport error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * PUT /api/monthly-reports/:id
 * Update konfigurasi laporan
 * Body: field yang ingin diubah (name-reports, queries-wrc, queries-export)
 */
export const updateReport = async (req, res) => {
  try {
    const { id }  = req.params;
    const userId  = getUserId(req);
    logger.info(`[monthly_reports.controller] updateReport id=${id} oleh user=${userId}`);

    if (!req.body || Object.keys(req.body).length === 0) {
      return apiResponse.badRequest(res, "Body tidak boleh kosong");
    }

    const data = await configLoader.updateReport(id, req.body, userId);
    return apiResponse.success(res, { data, message: "Laporan berhasil diupdate" });
  } catch (err) {
    logger.error(`[monthly_reports.controller] updateReport error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * DELETE /api/monthly-reports/:id
 * Hapus konfigurasi laporan dari JSON
 */
export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[monthly_reports.controller] deleteReport id=${id}`);
    await configLoader.deleteReport(id);
    return apiResponse.success(res, { message: `Report id="${id}" berhasil dihapus` });
  } catch (err) {
    logger.error(`[monthly_reports.controller] deleteReport error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

// ─── Run Report (Async Job) ──────────────────────────────────────────────────

/**
 * Substitusi placeholder pada string template.
 * @param {string} str
 * @param {Object} params - { userId, cab, prd, prdPrev, prdYear, prdMonth }
 */
function replacePlaceholders(str, params) {
  if (!str) return str;
  let result = str;
  for (const [k, v] of Object.entries(params)) {
    result = result.replaceAll(`{${k}}`, v || "");
  }
  return result;
}

/**
 * Siapkan reportConfig untuk eksekusi: substitusi placeholder pada nama laporan
 * dan key/caption sheet (tanpa sanitize — hanya untuk judul/nama sheet).
 */
function prepareReportConfig(reportConfig, templateParams) {
  const prepared = { ...reportConfig };
  if (prepared["name-reports"]) {
    prepared["name-reports"] = replacePlaceholders(prepared["name-reports"], templateParams);
  }
  if (Array.isArray(prepared["queries-export"])) {
    prepared["queries-export"] = prepared["queries-export"].map(item => ({
      ...item,
      key: replacePlaceholders(item.key, templateParams),
      caption: replacePlaceholders(item.caption, templateParams),
    }));
  }
  return prepared;
}

/**
 * POST /api/monthly-reports/:id/export
 * Mulai export laporan sebagai ASYNC JOB.
 * Body: { cab: "G001", prd: "2501" }
 * Response: 202 { success, message, taskId }
 *
 * Pipeline dieksekusi di background (tidak memblokir response), progress
 * ditracking via modul progress → tampil di widget frontend + bisa dibatalkan
 * via DELETE /api/progress/:taskId.
 */
export const startExport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId   = getUserId(req);
    const username = req.user?.username || userId;
    const { cab, prd } = req.body;

    if (!cab) return apiResponse.badRequest(res, "cab (kode cabang) wajib diisi di body");
    if (!prd)  return apiResponse.badRequest(res, "prd (periode) wajib diisi di body");
    if (!/^\d{4}$/.test(prd)) {
      return apiResponse.badRequest(
        res,
        "Format prd tidak valid. Gunakan format YYMM (contoh: 2501 untuk Januari 2025)"
      );
    }

    // Fail-fast: pastikan laporan ada & punya query
    logger.info(`[monthly_reports.controller] startExport id=${id} | cab=${cab} | prd=${prd} | user=${userId}`);
    const reportConfig = await configLoader.getReportById(id);
    if (!reportConfig) {
      return apiResponse.notFound(res, `Report id="${id}" tidak ditemukan`);
    }
    if (!reportConfig["queries-wrc"]?.length && !reportConfig["queries-export"]?.length) {
      return apiResponse.badRequest(res, "Laporan tidak memiliki query yang dikonfigurasi");
    }

    // Guard duplikasi: jangan jalankan export untuk laporan+cab+prd yang sama secara paralel
    const activeDup = progressService.getActiveTasks().find(
      t => t.module === "monthly_report" &&
           t.info?.reportId === id &&
           t.info?.cab === cab &&
           t.info?.prd === prd
    );
    if (activeDup) {
      return apiResponse.error(
        res,
        `Laporan ini (cab ${cab}, prd ${prd}) sedang diproses. Tunggu hingga selesai sebelum mencoba lagi.`,
        409
      );
    }

    const totalWrc = reportConfig["queries-wrc"]?.length || 0;
    const totalExport = reportConfig["queries-export"]?.length || 0;
    const totalCleanup = reportConfig["queries-cleanup"]?.length || 0;
    const totalSteps = totalWrc + totalExport + totalCleanup + 1; // +1 = build file

    const taskId = `monthly_report_${cab}_${prd}_${id}_${Date.now()}`;

    try {
      await progressService.startProgress(taskId, totalSteps, {
        module: "monthly_report",
        title: reportConfig["name-reports"],
        description: "Menyiapkan export laporan...",
        startedBy: username,
        cab,
        prd,
        reportId: id,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      // TASK_BUSY (maxConcurrentTasks tercapai) → beri tahu user apa yang sedang berjalan
      const activeTasks = err.activeTasks?.length
        ? ` Proses aktif: ${err.activeTasks.map(t => t.title || t.id).join(", ")}.`
        : "";
      return apiResponse.error(res, `${err.message}${activeTasks}`, 409);
    }

    // Fire-and-forget: pipeline berjalan di background
    runExportJob({ taskId, id, cab, prd, reportConfig, userId, username, totalSteps })
      .catch(err => {
        logger.error(`[monthly_reports.controller] Background job ${taskId} crash: ${err.message}`);
      });

    return res.status(202).json({
      success: true,
      message: "Export laporan dimulai. Progress tampil di panel kiri.",
      taskId,
    });
  } catch (err) {
    logger.error(`[monthly_reports.controller] startExport error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * Pipeline export di background.
 * Tidak boleh throw tanpa di-catch — error ditulis ke progress + staging dibersihkan.
 */
async function runExportJob({ taskId, id, cab, prd, reportConfig, userId, username, totalSteps }) {
  const jobStart = Date.now();
  let wrcResults = null;
  let fileResponse = null;

  // Ekstrak tahun/bulan dari prd (YYMM)
  const prdYear  = `20${prd.substring(0, 2)}`;
  const prdMonth = prd.substring(2, 4);

  // Hitung prdPrev (bulan sebelumnya)
  let prdPrev = "";
  if (prd && /^\d{4}$/.test(prd)) {
    const yy  = parseInt(prd.substring(0, 2), 10);
    const mm  = parseInt(prd.substring(2, 4), 10);
    let prevYY = yy;
    let prevMM = mm - 1;
    if (prevMM === 0) {
      prevMM = 12;
      prevYY = yy - 1;
    }
    prdPrev = `${String(prevYY).padStart(2, "0")}${String(prevMM).padStart(2, "0")}`;
  }

  const templateParams = { userId, cab, prd, prdPrev, prdYear, prdMonth };
  const preparedConfig = prepareReportConfig(reportConfig, templateParams);

  const stagingDir = exportJob.stagingDirFor(taskId);
  const filePath   = path.join(stagingDir, "output.tmp");
  let step = 0;

  const baseInfo = {
    module: "monthly_report",
    title: preparedConfig["name-reports"],
    startedBy: username,
    cab,
    prd,
    reportId: id,
  };

  const updateProgress = (message, extra = {}) => {
    progressService
      .updateProgress(taskId, Math.min(step, totalSteps), {
        ...baseInfo,
        ...extra,
        description: message,
        status: "running",
      })
      .catch(() => { /* task mungkin sudah dibatalkan/dihapus */ });
  };

  // Callback progress dari executor: cek pembatalan + update step
  const onProgress = ({ message }) => {
    if (progressService.isAborted(taskId)) {
      throw new ExportCancelledError();
    }
    step++;
    updateProgress(message);
  };

  try {
    await fsPromises.mkdir(stagingDir, { recursive: true });

    // ── 1. Eksekusi WRC (sequential) + query export ────────────────────────
    const wrcStart = Date.now();
    wrcResults = await executeReport({
      reportConfig: preparedConfig,
      cab,
      userId,
      prd,
      prdYear,
      prdMonth,
      onProgress,
    });
    logger.info(`[monthly_reports.controller] Fase WRC+export selesai dalam ${Date.now() - wrcStart}ms (id=${id} | cab=${cab} | prd=${prd})`);

    if (progressService.isAborted(taskId)) throw new ExportCancelledError();

    // ── 2. Build file ke staging (bukan ke HTTP res) ───────────────────────
    step++;
    updateProgress("Membangun file laporan...");
    const exporter = await resolveExporter(preparedConfig["id-reports"], preparedConfig["format"]);
    fileResponse = new exportJob.ExportFileResponse(filePath);
    await exporter.exportToResponse({
      reportConfig: preparedConfig,
      results: wrcResults,
      res: fileResponse,
      prd,
      cab,
    });

    // Pastikan seluruh isi stream sudah ter-flush ke disk
    if (!fileResponse.writableEnded) fileResponse.end();
    await exportJob.waitForStreamFinished(fileResponse);

    // Exporter bisa memutuskan "tidak ada data" → mengembalikan JSON error (status >= 400)
    if (fileResponse.statusCode >= 400) {
      throw new Error(fileResponse.jsonBody?.message || `Export gagal (status ${fileResponse.statusCode})`);
    }

    // Cek pembatalan sebelum file didaftarkan — user bisa cancel saat build Excel
    // berlangsung (fase ini tidak memeriksa abort per-tahap)
    if (progressService.isAborted(taskId)) throw new ExportCancelledError();

    // ── 3. Catat file di registry (untuk endpoint download) ────────────────
    const contentDisp = fileResponse.headers["content-disposition"] || "";
    const filenameMatch = contentDisp.match(/filename="?([^";\n]+)"?/);
    const fileName = filenameMatch
      ? decodeURIComponent(filenameMatch[1])
      : `${preparedConfig["name-reports"] || "laporan"}_${prd}.xlsx`;

    exportJob.registerJob(taskId, { filePath, fileName, status: "completed" });

    step = totalSteps;
    updateProgress("Export selesai", { fileName });

    await progressService.completeProgress(taskId);
    logger.info(
      `[monthly_reports.controller] exportReport selesai: id=${id} | cab=${cab} | prd=${prd} | user=${userId} (total ${Date.now() - jobStart}ms) → ${fileName}`
    );
  } catch (err) {
    const isCancelled = err?.code === "EXPORT_CANCELLED";
    logger.error(`[monthly_reports.controller] Job ${taskId} ${isCancelled ? "dibatalkan" : "gagal"}: ${err.message}`);

    await progressService.failProgress(taskId, isCancelled ? "Export dibatalkan oleh pengguna" : err.message)
      .catch(() => { /* task mungkin sudah dihapus oleh cancelTask */ });

    // Tutup file handle yang mungkin masih terbuka (jalur error/cancel),
    // agar folder staging bisa dihapus — terutama di Windows.
    if (fileResponse && !fileResponse.destroyed) fileResponse.destroy();

    // Bersihkan file staging + registry
    await exportJob.removeJobAndDir(taskId);
  } finally {
    wrcResults = null; // lepas referensi data besar
  }
}

/**
 * GET /api/monthly-reports/export/:taskId/file
 * Stream file hasil export dari staging.
 * - 200 : file siap & di-stream
 * - 409 : job masih diproses
 * - 404 : job/file tidak ditemukan (gagal, dibatalkan, atau sudah kedaluwarsa)
 */
export const downloadExport = async (req, res) => {
  try {
    const { taskId } = req.params;
    const job = exportJob.getJob(taskId);

    if (!job || job.status !== "completed") {
      // Cek status progress untuk pesan yang lebih jelas
      const task = progressService.getProgress(taskId);
      if (task && ["in-progress", "pending"].includes(task.status)) {
        return apiResponse.error(res, "Export masih diproses. Tunggu hingga selesai.", 409);
      }
      return apiResponse.notFound(res, "File export tidak ditemukan atau sudah kedaluwarsa");
    }

    if (!fs.existsSync(job.filePath)) {
      return apiResponse.notFound(res, "File export tidak ditemukan di server");
    }

    const ext = path.extname(job.fileName || "");
    let mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext.toLowerCase() === ".pdf") mime = "application/pdf";
    else if (ext.toLowerCase() === ".csv") mime = "text/csv; charset=utf-8";

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(job.fileName || "laporan.xlsx")}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Error handler wajib — stream read error tanpa listener = uncaughtException → crash server
    const readStream = fs.createReadStream(job.filePath);
    readStream.on("error", err => {
      logger.error(`[monthly_reports.controller] Gagal membaca file export: ${err.message}`);
      if (!res.headersSent) {
        apiResponse.error(res, "Gagal membaca file export");
      } else {
        res.destroy(err);
      }
    });
    readStream.pipe(res);
  } catch (err) {
    logger.error(`[monthly_reports.controller] downloadExport error: ${err.message}`);
    if (!res.headersSent) return apiResponse.error(res, err.message);
  }
};
