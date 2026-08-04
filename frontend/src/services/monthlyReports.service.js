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
   * Mulai export laporan sebagai ASYNC JOB (tidak lagi synchronous).
   * POST /api/monthly-reports/:id/export → 202 { taskId }
   * Proses berjalan di background; progress tampil di FloatingProgressWidget
   * (modul progress) dan dapat dibatalkan via progressStore.cancelTask(taskId).
   * @param {string} id   - id-reports
   * @param {string} cab  - Kode cabang
   * @param {string} prd  - Periode format YYMM (contoh: "2501")
   */
  startExport: (id, { cab, prd }) => api.post(`/${BASE}/${id}/export`, { cab, prd }),

  /**
   * Unduh file hasil export setelah job selesai.
   * GET /api/monthly-reports/export/:taskId/file → Blob
   * @param {string} taskId - taskId dari startExport
   */
  downloadExportFile: (taskId) =>
    api.get(`/${BASE}/export/${taskId}/file`, {
      responseType: "blob",
      timeout: 600000, // download file besar: beri waktu hingga 10 menit
    }),
};

export default monthlyReportsService;
