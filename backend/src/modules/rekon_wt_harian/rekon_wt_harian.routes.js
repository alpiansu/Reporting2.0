/**
 * Routes for WT reconciliation
 */
import express from 'express';
import jwt from 'jsonwebtoken';
const router = express.Router();
import {
  cleanupTempFiles,
  startReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
} from './rekon_wt_harian.controller.js';
import { authenticateJWT, authorizeRole } from '../../middlewares/index.js';

const rekonWtHarianController = {
  cleanupTempFiles,
  startReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
};

// Start reconciliation process
// POST /api/rekon-wt-harian
// Access: Private (Admin/Manager only)
router.post("/", authenticateJWT, authorizeRole(["admin", "manager"]), rekonWtHarianController.startReconciliation);

// Get reconciliation progress
// GET /api/rekon-wt-harian/progress/:progressId
// Access: Private
router.get("/progress/:progressId", authenticateJWT, rekonWtHarianController.getProgress);

// Get latest reconciliation progress for a branch and period
// GET /api/rekon-wt-harian/latest-progress/:cab/:periode
// Access: Private
router.get("/latest-progress/:cab/:periode", authenticateJWT, rekonWtHarianController.getLatestProgress);

// Get reconciliation results
// GET /api/rekon-wt-harian/:periode/:cab
// Access: Private
router.get("/:periode/:cab", authenticateJWT, rekonWtHarianController.getResults);

// Get summary of reconciliation results
// GET /api/rekon-wt-harian/:cab/:periode/summary
// Access: Private
router.get("/:cab/:periode/summary", authenticateJWT, rekonWtHarianController.getSummary);

// Delete reconciliation results
// DELETE /api/rekon-wt-harian/:cab/:periode
// Access: Private (Admin/Superadmin only)
router.delete(
  "/:cab/:periode",
  authenticateJWT,
  authorizeRole(["admin", "superadmin"]),
  rekonWtHarianController.deleteResults
);

// Clean up temporary difference files
// GET /api/rekon-wt-harian/cleanup-temp-files
// Access: Private (Admin/Superadmin only)
router.get(
  "/cleanup-temp-files",
  authenticateJWT,
  authorizeRole(["admin", "superadmin"]),
  rekonWtHarianController.cleanupTempFiles
);

// SSE endpoint for progress updates
// GET /api/rekon-wt-harian/sse/progress-updates/:progressId
// Access: Private
import progressService from './progress.service.js';

// Custom authentication middleware for SSE
const authenticateSSE = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401);
    res.write(`data: ${JSON.stringify({ error: "Access token required" })}\n\n`);
    return res.end();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401);
    res.write(`data: ${JSON.stringify({ error: "Invalid or expired token" })}\n\n`);
    return res.end();
  }
};

// SSE endpoint for real-time progress updates
router.get("/sse/progress-updates/:progressId", authenticateSSE, (req, res) => {
  const progressId = req.params.progressId;

  // Set headers untuk SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Kirim event awal
  res.write(`data: ${JSON.stringify({ type: "connected", progressId })}\n\n`);
  
  // Implement heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 30000); // Send heartbeat every 30 seconds

  // Simpan connection
  const clientId = `client-${Date.now()}`;
  progressService.clients.set(clientId, {
    id: clientId,
    response: res,
    subscriptions: new Set([progressId]),
    connectedAt: Date.now(),
    heartbeatInterval: heartbeatInterval
  });

  // Subscribe ke progress events
  progressService.subscribeToProgress(clientId, progressId);

  // Handle client disconnect
  req.on("close", () => {
    // Clear heartbeat interval when client disconnects
    if (progressService.clients.get(clientId)?.heartbeatInterval) {
      clearInterval(progressService.clients.get(clientId).heartbeatInterval);
    }
    progressService.clients.delete(clientId);
  });
});

export default router;
