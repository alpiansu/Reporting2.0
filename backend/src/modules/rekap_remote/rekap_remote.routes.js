/**
 * Routes for rekap_remote endpoints
 */
const express = require("express");
const rekapRemoteController = require("./rekap_remote.controller");
const { authenticateJWT } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: RekapRemote
 *   description: Remote connection recap management
 */

// Get rekap data with filters
router.get("/", rekapRemoteController.getRekapData);

// Get summary statistics
router.get("/summary", rekapRemoteController.getSummary);

// Manually save logs to database (for testing)
router.post("/save-logs", rekapRemoteController.saveLogsManually);



// Clear logs from memory (for testing)
router.delete("/clear-logs", rekapRemoteController.clearLogs);

module.exports = router;