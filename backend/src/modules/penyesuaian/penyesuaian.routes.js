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

// Delete note for a specific store and periode
router.delete("/note/", penyesuaianController.deleteNote);

// Get branch extremes: max positive & max negative item per cabang
router.get("/branch-extremes", penyesuaianController.getBranchExtremes);

// Get branch top items: top 10 items by ABS(SESUAI) per cabang
router.get("/branch-top-items/:cabang/:periode", penyesuaianController.getBranchTopItems);

// Get store-level insight (top items contributing to total SESUAI)
router.get("/insight/:kdtk/:periode", penyesuaianController.getStoreInsight);

// Get store item details (prodmast, mstran, mtran, protect) from store DB
router.get("/store-item/:kdtk/:prdcd", penyesuaianController.getStoreItem);

// Auto-generate note for a specific store based on item analysis
router.post("/auto-note/", penyesuaianController.autoNote);

export default router;
