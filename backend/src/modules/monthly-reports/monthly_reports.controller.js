/**
 * Controller — Monthly Reports
 *
 * Mengkoordinasi:
 *   - config_loader  : CRUD konfigurasi laporan (JSON file)
 *   - wrc_executor   : Eksekusi query ke WRC
 *   - exporter       : Build file hasil laporan (Excel / PDF / custom)
 *   - export_job     : Queue + job state + staging file + SSE (SELF-CONTAINED,
 *                      TIDAK lagi bergantung pada modul progress/screening)
 *
 * Alur EXPORT (async job, queue dengan concurrency sendiri):
 *   1. POST /:id/export → validasi, guard duplikasi, buat job 'queued',
 *      enqueue ke antrian FIFO (max 2 paralel). Response 202 + taskId.
 *   2. Pipeline background (runner): executeReport → exporter (tulis ke file
 *      staging) → completeJob (file terdaftar, siap diunduh 24 jam).
 *   3. SSE global per-user (GET /export/stream) + per-task + REST fallback
 *      (status/list/cancel) + download file (GET /export/:taskId/file).
 *
 * Keuntungan vs desain sebelumnya:
 *   - Export TIDAK memakai pool screening (maxConcurrentTasks:1) lagi →
 *     export & screening bisa jalan BERSAMAAN.
 *   - Cancel via DELETE /export/:taskId (bukan /api/progress).
 *   - Progress tampil di FloatingProgressWidget melalui store exports
 *     (satu widget, dua sumber data).
 */
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import * as configLoader from "./services/config_loader.service.js";
import { executeReport } from "./services/wrc_executor.service.js";
import { resolveExporter } from "./services/exporter_resolver.service.js";
import * as exportJob from "./services/export_job.service.js";

// ─── Helper: ambil userId dari JWT ────────────────────────────────────────────
function getUserId(req) {
  return req.user?.pic || req.user?.username || req.user?.id || "unknown";
}

function isAdmin(req) {
  return ["admin", "superadmin"].includes(req.user?.role);
}

/** Error marker: job dibatalkan oleh user (dideteksi via exportJob.isAborted) */
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

// ─── Run Report (Async Job + Queue) ──────────────────────────────────────────

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
 * Mulai export laporan sebagai ASYNC JOB dalam antrian FIFO.
 * Body: { cab: "G001", prd: "2501" }
 * Response: 202 { success, message, taskId, queue }
 *
 * Export memakai queue MILIK SENDIRI (maxConcurrentExports) — tidak menyentuh
 * pool screening/progress, jadi keduanya bisa berjalan bersamaan.
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

    // Guard duplikasi: laporan+cab+prd yang sama tidak boleh antri/berjalan dua kali
    const activeDup = exportJob.findActiveJobByKey({ reportId: id, cab, prd });
    if (activeDup) {
      return apiResponse.error(
        res,
        `Laporan ini (cab ${cab}, prd ${prd}) sedang ${activeDup.status === "queued" ? "menunggu di antrian" : "diproses"}. Tunggu hingga selesai sebelum mencoba lagi.`,
        409
      );
    }

    const taskId = `monthly_report_${cab}_${prd}_${id}_${Date.now()}`;

    // Buat job (status 'queued') lalu masukkan ke antrian FIFO.
    // Runner dipisahkan dari state — service tidak tahu detail pipeline.
    exportJob.createJob({
      taskId,
      userId,
      startedBy: username,
      reportName: reportConfig["name-reports"] || id,
      reportId: id,
      cab,
      prd,
    });

    exportJob.enqueueJob(taskId, runExportJob);

    logger.info(
      `[monthly_reports.controller] Export diantrikan: ${taskId} | queue=${JSON.stringify(exportJob.getQueueStats())}`
    );

    return res.status(202).json({
      success: true,
      message: "Export laporan diantrikan. Progress tampil di panel kiri.",
      taskId,
      queue: exportJob.getQueueStats(),
    });
  } catch (err) {
    logger.error(`[monthly_reports.controller] startExport error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * Pipeline export di background (runner antrian).
 * Tidak boleh throw tanpa di-catch — error ditulis ke job state + staging dibersihkan.
 * Slot antrian dilepas otomatis oleh service setelah promise ini settle.
 */
async function runExportJob(job) {
  const { taskId, reportId, cab, prd, userId } = job;
  const jobStart = Date.now();
  let wrcResults = null;
  let fileResponse = null;

  // Load konfigurasi fresh (bisa saja berubah sejak diantrikan)
  const reportConfig = await configLoader.getReportById(reportId);
  if (!reportConfig) throw new Error(`Report id="${reportId}" tidak ditemukan`);

  // Ekstrak tahun/bulan dari prd (YYMM) + hitung prdPrev (bulan sebelumnya)
  const prdYear  = `20${prd.substring(0, 2)}`;
  const prdMonth = prd.substring(2, 4);
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

  const totalWrc    = preparedConfig["queries-wrc"]?.length    || 0;
  const totalExport = preparedConfig["queries-export"]?.length || 0;
  const totalCleanup = preparedConfig["queries-cleanup"]?.length || 0;
  const totalSteps = totalWrc + totalExport + totalCleanup + 1; // +1 = build file
  let step = 0;

  const updateJob = (message, extra = {}) => {
    exportJob.updateJob(taskId, {
      percentage: Math.min(100, Math.round((step / totalSteps) * 100)),
      message,
      ...extra,
    });
  };

  // Callback progress dari executor: cek pembatalan + update step
  const onProgress = ({ message }) => {
    if (exportJob.isAborted(taskId)) {
      throw new ExportCancelledError();
    }
    step++;
    updateJob(message);
  };

  try {
    await fsPromises.mkdir(stagingDir, { recursive: true });

    // ── 1. Eksekusi WRC (sequential) + query export ────────────────────────
    updateJob("Menjalankan query WRC...");
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
    logger.info(`[monthly_reports.controller] Fase WRC+export selesai dalam ${Date.now() - wrcStart}ms (id=${reportId} | cab=${cab} | prd=${prd})`);

    if (exportJob.isAborted(taskId)) throw new ExportCancelledError();

    // ── 2. Build file ke staging (bukan ke HTTP res) ───────────────────────
    step++;
    updateJob("Membangun file laporan...");
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
    if (exportJob.isAborted(taskId)) throw new ExportCancelledError();

    // ── 3. Tandai selesai + daftarkan file di registry (download 24 jam) ──
    const contentDisp = fileResponse.headers["content-disposition"] || "";
    const filenameMatch = contentDisp.match(/filename="?([^";\n]+)"?/);
    const fileName = filenameMatch
      ? decodeURIComponent(filenameMatch[1])
      : `${preparedConfig["name-reports"] || "laporan"}_${prd}.xlsx`;

    exportJob.completeJob(taskId, { fileName, filePath });
    logger.info(
      `[monthly_reports.controller] exportReport selesai: id=${reportId} | cab=${cab} | prd=${prd} | user=${userId} (total ${Date.now() - jobStart}ms) → ${fileName}`
    );
  } catch (err) {
    const isCancelled = err?.code === "EXPORT_CANCELLED";
    logger.error(`[monthly_reports.controller] Job ${taskId} ${isCancelled ? "dibatalkan" : "gagal"}: ${err.message}`);

    // State terminal (cancelled jika user cancel, failed jika error) + broadcast
    exportJob.failJob(taskId, isCancelled ? "Export dibatalkan oleh pengguna" : err.message);

    // Tutup file handle yang mungkin masih terbuka (jalur error/cancel),
    // agar folder staging bisa dihapus — terutama di Windows.
    if (fileResponse && !fileResponse.destroyed) fileResponse.destroy();

    // Bersihkan file staging + registry (emit 'remove' ke SSE)
    await exportJob.removeJobAndDir(taskId);
  } finally {
    wrcResults = null; // lepas referensi data besar
  }
}

// ─── Export: REST + SSE endpoints ────────────────────────────────────────────

/**
 * GET /api/monthly-reports/export
 * Daftar semua job export milik user + statistik antrian.
 * Dipakai panel "File Siap Diunduh" & sinkronisasi awal frontend.
 */
export const listExportJobs = async (req, res) => {
  try {
    const userId = getUserId(req);
    const jobs = exportJob.listJobsByUser(userId);
    return apiResponse.success(res, { jobs, queue: exportJob.getQueueStats() });
  } catch (err) {
    logger.error(`[monthly_reports.controller] listExportJobs error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * GET /api/monthly-reports/export/:taskId/status
 * Status satu job (fallback polling bila SSE terputus).
 */
export const getExportStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const job = exportJob.getJob(taskId);
    if (!job) return apiResponse.notFound(res, "Job tidak ditemukan atau sudah kedaluwarsa");
    return apiResponse.success(res, { job, queue: exportJob.getQueueStats() });
  } catch (err) {
    logger.error(`[monthly_reports.controller] getExportStatus error: ${err.message}`);
    return apiResponse.error(res, err.message);
  }
};

/**
 * GET /api/monthly-reports/export/:taskId/file
 * Stream file hasil export dari staging.
 * - 200 : file siap & di-stream
 * - 409 : job masih diproses/diantri
 * - 404 : job/file tidak ditemukan (gagal, dibatalkan, atau sudah kedaluwarsa)
 */
export const downloadExport = async (req, res) => {
  try {
    const { taskId } = req.params;
    const job = exportJob.getJob(taskId);

    if (!job) {
      return apiResponse.notFound(res, "File export tidak ditemukan atau sudah kedaluwarsa");
    }
    if (job.status !== "completed") {
      const hint =
        job.status === "queued"
          ? `Export masih menunggu di antrian (posisi #${job.queuePosition}).`
          : job.status === "processing"
            ? "Export masih diproses. Tunggu hingga selesai."
            : `Export berstatus "${job.status}".`;
      return apiResponse.error(res, hint, 409);
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

/**
 * DELETE /api/monthly-reports/export/:taskId
 * Batalkan job (otorisasi initiator/admin dicek di exportJob.cancelJob).
 * - queued     → langsung dibatalkan & dilepas dari antrian
 * - processing → request abort; berhenti di checkpoint pipeline berikutnya
 */
export const cancelExport = async (req, res) => {
  try {
    const { taskId } = req.params;
    const job = exportJob.cancelJob(taskId, req.user);
    return apiResponse.success(res, {
      job,
      message: `Export '${taskId}' ${job.status === "cancelled" ? "dibatalkan" : "sedang dibatalkan"}`,
    });
  } catch (err) {
    logger.error(`[monthly_reports.controller] cancelExport error: ${err.message}`);
    return apiResponse.error(res, err.message, err.status || 500);
  }
};

/**
 * GET /api/monthly-reports/export/stream
 * SSE global per-user — dipakai FloatingProgressWidget (store exports).
 */
export const streamExports = async (req, res) => {
  const userId = getUserId(req);
  exportJob.setupSSEHeaders(res);
  exportJob.subscribeUser(userId, res);
};

/**
 * GET /api/monthly-reports/export/:taskId/stream
 * SSE per-task (opsional — fallback halaman laporan).
 */
export const streamTaskExports = async (req, res) => {
  const { taskId } = req.params;
  const job = exportJob.getJob(taskId);
  if (!job) return apiResponse.notFound(res, "Job tidak ditemukan");
  if (job.userId !== getUserId(req) && !isAdmin(req)) {
    return apiResponse.error(res, "Tidak memiliki izin melihat job ini", 403);
  }
  exportJob.setupSSEHeaders(res);
  exportJob.subscribeTask(taskId, res);
};
