/**
 * Routes for WT reconciliation
 */
import express from "express";
const router = express.Router();
import {
  cleanupTempFiles,
  startReconciliation,
  refreshShopReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
  invalidateCache,
  getDailyShopSummary,
  updateNote,
} from "./rekon_wt_harian.controller.js";
import { authenticateJWT, authorizeRole } from "../../middlewares/index.js";

const rekonWtHarianController = {
  cleanupTempFiles,
  startReconciliation,
  refreshShopReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
  invalidateCache,
  getDailyShopSummary,
  updateNote,
};

// Start reconciliation process
// POST /api/rekon-wt-harian
// Access: Private (Admin/Manager only)
router.post(
  "/",
  authenticateJWT,
  authorizeRole(["admin", "manager", "superadmin"]),
  rekonWtHarianController.startReconciliation,
);

// Start reconciliation process for specific shop
// POST /api/rekon-wt-harian/refresh-shop/:periode/:cab/:toko
// Access: Private (Admin/Manager only)
router.post(
  "/refresh-shop/:periode/:cab/:toko",
  authenticateJWT,
  authorizeRole(["admin", "manager", "superadmin"]),
  rekonWtHarianController.refreshShopReconciliation,
);

// Update or create note for a store
// PUT /api/rekon-wt-harian/note
// Access: Private (Admin/Manager only)
router.put(
  "/note",
  authenticateJWT,
  authorizeRole(["admin", "manager", "superadmin"]),
  rekonWtHarianController.updateNote,
);

// Get reconciliation progress
// GET /api/rekon-wt-harian/progress/:taskId
// Access: Private
router.get("/progress/:taskId", authenticateJWT, rekonWtHarianController.getProgress);

// Get latest reconciliation progress for a branch and period
// GET /api/rekon-wt-harian/latest-progress/:cab/:periode
// Access: Private
router.get("/latest-progress/:cab/:periode", authenticateJWT, rekonWtHarianController.getLatestProgress);

// Get summary of reconciliation results
// GET /api/rekon-wt-harian/summary/:cab/:periode
// Access: Private
router.get("/summary/:cab/:periode", authenticateJWT, rekonWtHarianController.getSummary);

// Get daily shop summary - rekap data per toko per tanggal
// GET /api/rekon-wt-harian/daily-summary/:periode/:cab
// Access: Private
router.get("/daily-summary/:periode/:cab", authenticateJWT, rekonWtHarianController.getDailyShopSummary);

// Get reconciliation results
// GET /api/rekon-wt-harian/:periode/:cab/:toko
// Access: Private
router.get("/get-result-detail/:periode/:cab/:toko", authenticateJWT, rekonWtHarianController.getResults);

// Delete reconciliation results
// DELETE /api/rekon-wt-harian/:cab/:periode
// Access: Private (Admin/Superadmin only)
router.delete(
  "/:cab/:periode",
  authenticateJWT,
  authorizeRole(["admin", "superadmin"]),
  rekonWtHarianController.deleteResults,
);

// Clean up temporary difference files
// POST /api/rekon-wt-harian/cleanup-temp-files
// Access: Private (Admin/Superadmin only)
router.post(
  "/cleanup-temp-files",
  authenticateJWT,
  authorizeRole(["admin", "superadmin"]),
  rekonWtHarianController.cleanupTempFiles,
);

// Invalidate cache manually
// POST /api/rekon-wt-harian/invalidate-cache
// Access: Private (Admin/Superadmin only)
router.post(
  "/invalidate-cache",
  authenticateJWT,
  authorizeRole(["admin", "superadmin"]),
  rekonWtHarianController.invalidateCache,
);

// SSE endpoint has been moved to /api/progress/sse/:progressId
// Use the global progress routes instead of module-specific SSE

export default router;
