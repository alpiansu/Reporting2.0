import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  runReport,
} from "./monthly_reports.controller.js";

const router = express.Router();

// Semua endpoint memerlukan autentikasi JWT
router.use(authenticateJWT);

// ─── JSON File Management (CRUD Konfigurasi Laporan) ─────────────────────────
// Endpoint ini digunakan langsung dari aplikasi — tidak perlu akses dev mode

router.get("/",    listReports);   // List semua konfigurasi
router.get("/:id", getReportById); // Detail satu konfigurasi

router.post("/",    createReport); // Tambah laporan baru ke JSON
router.put("/:id",  updateReport); // Update query/nama/sheet laporan tertentu

router.delete("/:id", deleteReport); // Hapus laporan dari JSON

// ─── Eksekusi Laporan ─────────────────────────────────────────────────────────
// POST body: { cab: "G001" }
// Response : stream file .xlsx

router.post("/:id/run", runReport);

export default router;
