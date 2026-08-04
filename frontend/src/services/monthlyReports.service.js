/**
 * Service untuk Monthly Reports
 * Endpoint base: /api/monthly-reports
 */
import api from "./api";
import { EventSourcePolyfill } from "event-source-polyfill";

const BASE = "monthly-reports";

/** Helper membangun URL SSE dengan auth header (pola sama progress.service). */
function sseUrl(path) {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    api.defaults.baseURL ||
    "http://localhost:3001/api";
  const token = localStorage.getItem("token");
  return {
    url: `${apiUrl}${path}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

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

  /**
   * Daftar semua job export milik user + statistik antrian.
   * GET /api/monthly-reports/export
   */
  listExports: () => api.get(`/${BASE}/export`),

  /**
   * Status satu job export (fallback polling bila SSE terputus).
   * GET /api/monthly-reports/export/:taskId/status
   */
  getExportStatus: (taskId) => api.get(`/${BASE}/export/${taskId}/status`),

  /**
   * Batalkan job export (initiator/admin).
   * DELETE /api/monthly-reports/export/:taskId
   */
  cancelExport: (taskId) => api.delete(`/${BASE}/export/${taskId}`),

  /**
   * Pantau semua job export milik user via SSE (dipakai FloatingProgressWidget).
   * GET /api/monthly-reports/export/stream
   * Events: init ({ jobs }), update ({ job }), remove ({ taskId })
   * @param {Object} handlers - { onInit, onUpdate, onRemove }
   * @returns {EventSourcePolyfill}
   */
  monitorExports({ onInit, onUpdate, onRemove }) {
    const { url, headers } = sseUrl(`/${BASE}/export/stream`);
    const eventSource = new EventSourcePolyfill(url, { headers });

    eventSource.addEventListener("init", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onInit) onInit(data.jobs || []);
      } catch (err) {
        console.error("❌ Error parsing export SSE init:", err);
      }
    });

    eventSource.addEventListener("update", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onUpdate) onUpdate(data.job);
      } catch (err) {
        console.error("❌ Error parsing export SSE update:", err);
      }
    });

    eventSource.addEventListener("remove", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onRemove) onRemove(data);
      } catch (err) {
        console.error("❌ Error parsing export SSE remove:", err);
      }
    });

    eventSource.onerror = (err) => {
      console.error("❌ Export SSE Connection error:", err);
      eventSource.close();
    };

    return eventSource;
  },
};

export default monthlyReportsService;
