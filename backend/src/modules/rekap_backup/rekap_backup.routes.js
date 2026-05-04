import { Router } from "express";
import rekapBackupController from "./controllers/rekap_backup.controller.js";

const router = Router();

// Summary
router.get("/summary", rekapBackupController.getSummary);

// Resume per cabang (All years)
router.get("/harian/resume/:cabang", rekapBackupController.getResumeHarian);
router.get("/bulanan/resume/:cabang", rekapBackupController.getResumeBulanan);

// Detail specific period & criteria
router.get("/harian/detail/:cabang/:periode/:kriteria", rekapBackupController.getDetailHarian);
router.get("/bulanan/detail/:cabang/:periode/:kriteria", rekapBackupController.getDetailBulanan);

// Available years for filter
router.get("/years", rekapBackupController.getYears);

// Export Excel
router.get("/export", rekapBackupController.exportExcel);

// Sync Toko Aktif (WRC)
router.post("/sync-wrc", rekapBackupController.syncWrc);

// Admin: trigger staging sync manually
router.post("/staging/sync", rekapBackupController.triggerStagingSync);

export default router;
