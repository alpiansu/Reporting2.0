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

import { resolveExporter } from "./services/exporter_resolver.service.js";

/**
 * POST /api/monthly-reports/:id/export
 * Jalankan laporan: WRC → Excel → stream ke response
 * Body: { cab: "G001", prd: "2501" }
 *   - cab : kode cabang
 *   - prd : periode format YYMM (contoh: 2501 = Januari 2025)
 *
 * Setiap request ini berjalan INDEPENDEN — tidak menunggu request lain.
 * Queries-wrc di dalam 1 request dieksekusi SEQUENTIAL.
 * Placeholder yang tersedia di queries: {userId}, {cab}, {prd}, {prdYear}, {prdMonth}
 */
export const exportReport = async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  let wrcResults = null;

  try {
    const { cab, prd } = req.body;
    if (!cab) return apiResponse.badRequest(res, "cab (kode cabang) wajib diisi di body");
    if (!prd)  return apiResponse.badRequest(res, "prd (periode) wajib diisi di body");

    // Validasi format YYMM — 4 digit angka
    if (!/^\d{4}$/.test(prd)) {
      return apiResponse.badRequest(
        res,
        "Format prd tidak valid. Gunakan format YYMM (contoh: 2501 untuk Januari 2025)"
      );
    }

    // Ekstrak tahun dan bulan dari prd (YYMM)
    const prdYear  = `20${prd.substring(0, 2)}`; // "25" → "2025"
    const prdMonth = prd.substring(2, 4);          // "01"

    // ── 1. Load config laporan
    logger.info(`[monthly_reports.controller] exportReport id=${id} | cab=${cab} | prd=${prd} | user=${userId}`);
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
    wrcResults = await executeReport({ reportConfig, cab, userId, prd, prdYear, prdMonth });

    // ── 4. Resolve exporter & Export ke Excel dan stream ke response
    const exporter = await resolveExporter(reportConfig["id-reports"]);
    await exporter.exportToResponse({ reportConfig, results: wrcResults, res, prd, cab });

    logger.info(`[monthly_reports.controller] exportReport selesai: id=${id} | cab=${cab} | prd=${prd} | user=${userId}`);

  } catch (err) {
    logger.error(`[monthly_reports.controller] exportReport error: ${err.message}`);
    if (!res.headersSent) {
      return apiResponse.error(res, `Gagal menjalankan laporan: ${err.message}`);
    }
  } finally {
    // ── 5. Cleanup reference data besar setelah selesai
    if (wrcResults) {
      wrcResults = null;
      logger.debug(`[monthly_reports.controller] wrcResults reference dibersihkan (user=${userId})`);
    }
  }
};
