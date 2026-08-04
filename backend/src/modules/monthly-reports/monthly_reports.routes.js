import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  startExport,
  downloadExport,
} from "./monthly_reports.controller.js";

const router = express.Router();

// Semua endpoint memerlukan autentikasi JWT
router.use(authenticateJWT);

// ─── JSON File Management (CRUD Konfigurasi Laporan) ─────────────────────────
// Endpoint ini digunakan langsung dari aplikasi — tidak perlu akses dev mode

router.get("/", listReports); // List semua konfigurasi
router.get("/:id", getReportById); // Detail satu konfigurasi

router.post("/", createReport); // Tambah laporan baru ke JSON
router.put("/:id", updateReport); // Update query/nama/sheet laporan tertentu

router.delete("/:id", deleteReport); // Hapus laporan dari JSON

// ─── Eksekusi Laporan (Async Job) ────────────────────────────────────────────
// POST /:id/export  → 202 { taskId } (proses berjalan di background, progress via /api/progress)
// GET  /export/:taskId/file → stream file hasil export (harus setelah POST selesai)
// Cancel: DELETE /api/progress/:taskId (endpoint progress module)

router.post("/:id/export", startExport);
router.get("/export/:taskId/file", downloadExport);

export default router;
