/**
 * Routes for rekap_remote endpoints
 */
import express from 'express';
import { getRekapData, getSummary, saveLogsManually, clearLogs } from './rekap_remote.controller.js';
import { authenticateJWT } from '../../middlewares/index.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Get rekap data with filters
router.get("/", getRekapData);

// Get summary statistics
router.get("/summary", getSummary);

// Manually save logs to database (for testing)
router.post("/save-logs", saveLogsManually);

// Clear logs from memory (for testing)
router.delete("/clear-logs", clearLogs);

export default router;