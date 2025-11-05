import express from "express";
import * as penyesuaianController from "./penyesuaian.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// Initialize routes for screening to stores by cabang (fixed cabang or all cabang)
router.get("/screening", penyesuaianController.screeningByCabang);

// Get summary statistics
router.get("/summary", penyesuaianController.getSummary);

// Get all records with pagination and filters
router.get("/", penyesuaianController.getAllRecords);

// Get all records without pagination and filters
router.get("/getData", penyesuaianController.getAll);

// Get single record
router.get("/:cabang/:kdtk/:periode/:prdcd", penyesuaianController.getRecord);

// Create new record
router.post("/", penyesuaianController.createRecord);

// Update record
router.put("/:cabang/:kdtk/:periode/:prdcd", penyesuaianController.updateRecord);

// Delete record
router.delete("/:cabang/:kdtk/:periode/:prdcd", penyesuaianController.deleteRecord);

// Update or create note for a specific record
router.put("/note/:cabang/:kdtk/:periode/:prdcd", penyesuaianController.updateNote);

export default router;
