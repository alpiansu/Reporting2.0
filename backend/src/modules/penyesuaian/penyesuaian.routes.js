import express from "express";
import * as penyesuaianController from "./penyesuaian.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// Screening routes (supports 3 levels: All cabang, 1 cabang, 1 store)
router.get("/screening", penyesuaianController.screeningByCabang);

// Get summary statistics (RECID='*' only)
router.get("/summary", penyesuaianController.getSummary);

// Get all records with pagination and filters (RECID='*' only)
router.get("/", penyesuaianController.getAllRecords);

// Get all records without pagination and filters (RECID='*' only)
router.get("/getData", penyesuaianController.getAll);

// Get single record by primary key
router.get("/:cabang/:kdtk/:periode/:prdcd", penyesuaianController.getRecord);

export default router;
