import { Router } from "express";
import rekapBackupController from "./controllers/rekap_backup.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Summary
router.get("/summary", rekapBackupController.getSummary);

// Resume per cabang (All years)
router.get("/harian/resume/:cabang", rekapBackupController.getResumeHarian);
router.get("/bulanan/resume/:cabang", rekapBackupController.getResumeBulanan);

// Detail specific period & criteria
router.get("/harian/detail/:cabang/:periode", rekapBackupController.getDetailHarian);
router.get("/bulanan/detail/:cabang/:periode", rekapBackupController.getDetailBulanan);

// Update note on detail record
router.patch("/harian/detail/note", rekapBackupController.updateNoteHarian);
router.patch("/bulanan/detail/note", rekapBackupController.updateNoteBulanan);

// Update note on resume record
router.patch("/harian/resume/note", rekapBackupController.updateResumeNoteHarian);
router.patch("/bulanan/resume/note", rekapBackupController.updateResumeNoteBulanan);

// Available years for filter
router.get("/years", rekapBackupController.getYears);

// Export Excel
router.get("/export", rekapBackupController.exportExcel);

// Admin: trigger staging sync manually
router.post("/staging/sync", rekapBackupController.triggerStagingSync);

export default router;
