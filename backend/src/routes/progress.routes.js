/**
 * Global Progress Routes
 * Universal SSE endpoints for progress tracking across all modules
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { ProgressHelper } from '../services/progress/index.js';
import logger from '../config/logger.js';

const router = express.Router();

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

/**
 * SSE endpoint for real-time progress updates
 * GET /api/progress/sse/:progressId
 * Access: Private (requires JWT token)
 */
router.get("/sse/:progressId", authenticateSSE, ProgressHelper.createSSERoute(authenticateSSE));

/**
 * Get progress data by ID
 * GET /api/progress/:progressId
 * Access: Private
 */
router.get("/:progressId", (req, res) => {
  try {
    const { progressId } = req.params;

    if (!progressId) {
      return res.status(400).json({
        success: false,
        message: "Progress ID is required",
      });
    }

    const progress = ProgressHelper.getProgress(progressId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress not found",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getProgress: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Get latest progress for a process type and identifier
 * GET /api/progress/latest/:processType/:identifier
 * Access: Private
 */
router.get("/latest/:processType/:identifier", (req, res) => {
  try {
    const { processType, identifier } = req.params;

    if (!processType || !identifier) {
      return res.status(400).json({
        success: false,
        message: "Process type and identifier are required",
      });
    }

    const progress = ProgressHelper.getLatestProgress(processType, identifier);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress not found",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getLatestProgress: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Get active process for a process type
 * GET /api/progress/active/:processType
 * GET /api/progress/active/:processType/:identifier
 * Access: Private
 */
// Separate route for processType only
router.get("/active/:processType", (req, res) => {
  try {
    const { processType } = req.params;

    if (!processType) {
      return res.status(400).json({
        success: false,
        message: "Process type is required",
      });
    }

    const progress = ProgressHelper.getActiveProcess(processType);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "No active process found",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getActiveProcess: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/active/:processType/:identifier", (req, res) => {
  try {
    const { processType, identifier } = req.params;

    if (!processType) {
      return res.status(400).json({
        success: false,
        message: "Process type is required",
      });
    }

    const progress = ProgressHelper.getActiveProcess(processType, identifier);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "No active process found",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getActiveProcess: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;