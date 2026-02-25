import { Router } from "express";
import * as controller from "./rekon_persediaan.controller.js";
import { authenticateJWT, authorizeRole } from "../../middlewares/index.js";

const router = Router();

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * @route   GET /api/rekon-persediaan/screening
 * @desc    Start reconciliation process
 */
router.get("/screening", authorizeRole(["admin", "user", "superuser"]), controller.startScreening);

/**
 * @route   GET /api/rekon-persediaan/summary
 * @desc    Get reconciliation summary stats
 */
router.get("/summary", authorizeRole(["admin", "user", "superuser"]), controller.getSummary);

/**
 * @route   GET /api/rekon-persediaan/records
 * @desc    Get paginated reconciliation records
 */
router.get("/records", authorizeRole(["admin", "user", "superuser"]), controller.getAllRecords);

export default router;
