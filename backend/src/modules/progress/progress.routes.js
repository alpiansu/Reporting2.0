import express from "express";
import {
  streamAllProgress,
  streamTaskProgress,
  streamModuleProgress,
  getAllProgress,
  getTaskProgress,
  getActiveProgress,
  getModuleProgress,
  getQueueStatus,
  cleanupProgress,
  cancelTask,
} from "./progress.controller.js";

const router = express.Router();
//SEMUA ROUTES DI LINDUNGI aUTHENTICATION JWT DI INDEX.JS, JADI DISINI LANGSUNG DEFINISIKAN ROUTE SAJA
// SSE stream routes - MULTIPLE ENDPOINTS
router.get("/stream", streamAllProgress); // All tasks
router.get("/stream/task/:taskId", streamTaskProgress); // Specific task
router.get("/stream/module/:moduleName", streamModuleProgress); // Specific module

// REST API routes for progress monitoring
router.get("/", getAllProgress); // Get all tasks
router.get("/active", getActiveProgress); // Get only active tasks
router.get("/queue", getQueueStatus); // Get queue capacity info
router.get("/:taskId", getTaskProgress); // Get specific task
router.get("/module/:moduleName", getModuleProgress); // Get tasks by module

// Admin routes
router.post("/cleanup", cleanupProgress); // Manual cleanup
router.delete("/:taskId", cancelTask); // Cancel / force-stop a specific task

export default router;
