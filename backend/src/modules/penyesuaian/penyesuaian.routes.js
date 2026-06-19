import express from "express";
import * as penyesuaianController from "./penyesuaian.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// Screening routes (supports 3 levels: All cabang, 1 cabang, 1 store)
router.get("/screening", penyesuaianController.screeningByCabang);

// Sync JSON staging from database
router.post("/sync-json", penyesuaianController.syncJson);

// Get summary statistics (RECID='*' only)
router.get("/summary", penyesuaianController.getSummary);

// Get all records with pagination and filters (RECID='*' only)
router.get("/", penyesuaianController.getAllRecords);

// Get all records without pagination and filters (RECID='*' only)
router.get("/getData", penyesuaianController.getAll);

// Get data resume per store (RECID='*' only) by periode and cabang
router.get("/resumePerShop", penyesuaianController.getResumeByKdtk);

// Get data resume per store (RECID='*' only) by kdtk
router.get("/singleResumeShop", penyesuaianController.getSingleResumeKdtk);

// Get single record by primary key
router.get("/:cabang/:kdtk/:periode/:prdcd", penyesuaianController.getRecord);

// Update or create note for a specific store and periode
router.put("/note/", penyesuaianController.updateNote);

export default router;
