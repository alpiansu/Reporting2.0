/**
 * Combined Screening Routes
 */
import express from "express";
import { trigger, getStatus, getConfig, toggleModule } from "./combined_screening.controller.js";
import { authenticateJWT, authorizeRole } from "../../middlewares/index.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateJWT);

// Trigger combined screening
router.post("/trigger", trigger);

// Get status of current combined screening task
router.get("/status", getStatus);

// Get config (superadmin only)
router.get("/config", authorizeRole(["superadmin"]), getConfig);

// Toggle module enabled/disabled (superadmin only)
router.patch("/config/:moduleName", authorizeRole(["superadmin"]), toggleModule);

export default router;
