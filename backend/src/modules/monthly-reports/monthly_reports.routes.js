import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  startExport,
  listExportJobs,
  getExportStatus,
  downloadExport,
  cancelExport,
  streamExports,
  streamTaskExports,
} from "./monthly_reports.controller.js";

const router = express.Router();

// Semua endpoint memerlukan autentikasi JWT
router.use(authenticateJWT);

// ─── Export Jobs (Async) ──────────────────────────────────────────────────────
// PENTING: grup /export* DIDAFTARKAN SEBELUM GET /:id agar literal "/export"
// tidak tertangkap oleh route param dinamis.
//
// POST /:id/export          → 202 { taskId, queue } (job masuk antrian FIFO)
// GET  /export              → daftar job milik user (panel "File Siap Diunduh")
// GET  /export/stream       → SSE global per-user (widget frontend)
// GET  /export/:taskId/stream → SSE per task (fallback)
// GET  /export/:taskId/status → status single job (fallback polling)
// DELETE /export/:taskId    → cancel job (initiator/admin)
// GET  /export/:taskId/file → stream file hasil export

router.get("/export", listExportJobs);
router.get("/export/stream", streamExports);
router.get("/export/:taskId/status", getExportStatus);
router.get("/export/:taskId/stream", streamTaskExports);
router.delete("/export/:taskId", cancelExport);
router.get("/export/:taskId/file", downloadExport);

// ─── JSON File Management (CRUD Konfigurasi Laporan) ─────────────────────────
// Endpoint ini digunakan langsung dari aplikasi — tidak perlu akses dev mode

router.get("/", listReports); // List semua konfigurasi
router.get("/:id", getReportById); // Detail satu konfigurasi

router.post("/", createReport); // Tambah laporan baru ke JSON
router.put("/:id", updateReport); // Update query/nama/sheet laporan tertentu

router.delete("/:id", deleteReport); // Hapus laporan dari JSON

// ─── Eksekusi Laporan ────────────────────────────────────────────────────────
router.post("/:id/export", startExport);

export default router;
