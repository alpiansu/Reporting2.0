/**
 * Controller — Monthly Reports
 *
 * Mengkoordinasi 3 service:
 *   - config_loader  : CRUD konfigurasi laporan (JSON file)
 *   - wrc_executor   : Eksekusi query ke WRC
 *   - excel_export   : Stream hasil ke Excel
 *
 * Setiap request runReport berjalan independen — tidak ada locking global.
 * Banyak user dapat menjalankan laporan secara bersamaan (paralel antar report).
 */

import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import * as configLoader from "./services/config_loader.service.js";
import { executeReport }  from "./services/wrc_executor.service.js";
import { exportToResponse } from "./services/excel_export.service.js";

// ─── Helper: ambil userId dari JWT ────────────────────────────────────────────
function getUserId(req) {
  return req.user?.pic || req.user?.username || req.user?.id || "unknown";
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
    return apiResponse.success(res, { data, total: data.length });
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

    const { "name-reports": name, "queries-wrc": qWrc, "queries-export": qExp } = req.body;
    if (!name) return apiResponse.badRequest(res, "name-reports wajib diisi");
    if (!Array.isArray(qWrc))    return apiResponse.badRequest(res, "queries-wrc harus berupa array");
    if (!Array.isArray(qExp))    return apiResponse.badRequest(res, "queries-export harus berupa array");

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

// ─── Run Report ───────────────────────────────────────────────────────────────

/**
 * POST /api/monthly-reports/:id/run
 * Jalankan laporan: WRC → Excel → stream ke response
 * Body: { cab: "G001" }
 *
 * Setiap request ini berjalan INDEPENDEN — tidak menunggu request lain.
 * Queries-wrc di dalam 1 request dieksekusi SEQUENTIAL.
 */
export const runReport = async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  let wrcResults = null;

  try {
    const { cab } = req.body;
    if (!cab) return apiResponse.badRequest(res, "cab (kode cabang) wajib diisi di body");

    // ── 1. Load config laporan
    logger.info(`[monthly_reports.controller] runReport id=${id} | cab=${cab} | user=${userId}`);
    const reportConfig = await configLoader.getReportById(id);
    if (!reportConfig) {
      return apiResponse.notFound(res, `Report id="${id}" tidak ditemukan`);
    }
    logger.info(`[monthly_reports.controller] Laporan ditemukan: "${reportConfig["name-reports"]}"`);

    // ── 2. Validasi ada isinya
    if (!reportConfig["queries-wrc"]?.length && !reportConfig["queries-export"]?.length) {
      return apiResponse.badRequest(res, "Laporan tidak memiliki query yang dikonfigurasi");
    }

    // ── 3. Eksekusi WRC (sequential per-report, paralel antar-report)
    wrcResults = await executeReport({ reportConfig, cab, userId });

    // ── 4. Export ke Excel dan stream ke response
    await exportToResponse({ reportConfig, results: wrcResults, res });

    logger.info(`[monthly_reports.controller] runReport selesai: id=${id} | cab=${cab} | user=${userId}`);

  } catch (err) {
    logger.error(`[monthly_reports.controller] runReport error: ${err.message}`);
    if (!res.headersSent) {
      return apiResponse.error(res, `Gagal menjalankan laporan: ${err.message}`);
    }
  } finally {
    // ── 5. Cleanup reference data besar setelah selesai
    if (wrcResults) {
      wrcResults = null; // lepas reference, bantu GC
      logger.debug(`[monthly_reports.controller] wrcResults reference dibersihkan (user=${userId})`);
    }
  }
};
