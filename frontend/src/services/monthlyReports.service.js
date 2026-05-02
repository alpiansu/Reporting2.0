/**
 * Service untuk Monthly Reports
 * Endpoint base: /api/monthly-reports
 */
import api from "./api";

const BASE = "monthly-reports";

const monthlyReportsService = {
  /**
   * List semua konfigurasi laporan dari JSON
   * GET /api/monthly-reports
   */
  listReports: () => api.get(`/${BASE}`),

  /**
   * Buat konfigurasi laporan baru
   * POST /api/monthly-reports
   * @param {Object} data - { "name-reports", "queries-wrc", "queries-export" }
   */
  createReport: (data) => api.post(`/${BASE}`, data),

  /**
   * Update konfigurasi laporan
   * PUT /api/monthly-reports/:id
   * @param {string} id
   * @param {Object} data
   */
  updateReport: (id, data) => api.put(`/${BASE}/${id}`, data),

  /**
   * Hapus konfigurasi laporan
   * DELETE /api/monthly-reports/:id
   * @param {string} id
   */
  deleteReport: (id) => api.delete(`/${BASE}/${id}`),

  /**
   * Export laporan ke Excel
   * POST /api/monthly-reports/:id/export
   * Response diterima sebagai Blob untuk auto-download
   * @param {string} id   - id-reports
   * @param {string} cab  - Kode cabang
   * @param {string} prd  - Periode format YYMM (contoh: "2501")
   */
  exportReport: (id, { cab, prd }) =>
    api.post(
      `/${BASE}/${id}/export`,
      { cab, prd },
      { responseType: "blob" }
    ),
};

export default monthlyReportsService;
