import { Router } from "express";
import * as adjustController from "./adjust.controller.js";
import { uploadCsv, handleMulterError } from "./adjust.middleware.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = Router();

// Protected routes - require authentication
router.post("/upload", authenticateJWT, uploadCsv, handleMulterError, adjustController.uploadAdjustCsv);
router.get("/template", authenticateJWT, adjustController.downloadCsvTemplate);
router.get("/history", authenticateJWT, adjustController.getAdjustHistory);
router.get("/statistics", authenticateJWT, adjustController.getAdjustStatistics);
router.get("/history/filters", authenticateJWT, adjustController.getAdjustFilters);
router.get("/history/export", authenticateJWT, adjustController.exportAdjustHistoryCsv);
router.get("/sync-history", authenticateJWT, adjustController.syncHistory);

export default router;
