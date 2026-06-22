import express from "express";
import * as prepClosingController from "./prep_closing.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// Screening routes (supports 3 levels: All cabang, 1 cabang, 1 store)
router.get("/screening", prepClosingController.screeningByCabang);

// Sync JSON staging from database
router.post("/sync-json", prepClosingController.syncJson);

// Get summary statistics
router.get("/summary", prepClosingController.getSummary);

// Get rules summary
router.get("/rules-summary", prepClosingController.getRulesSummary);

// Get rules data
router.get("/rules", prepClosingController.getRules);

// Update rules data
router.put("/rules", prepClosingController.updateRules);

// Get resume per store (paginated)
router.get("/resumePerShop", prepClosingController.getResumeByKdtk);

// Get detailed issues for a specific store
router.get("/details", prepClosingController.getStoreDetails);

// Get issues grouped by category
router.get("/issuesByCategory", prepClosingController.getIssuesByCategory);

// Export data for Excel (4 sheets)
router.get("/export-data", prepClosingController.getExportData);

// Update or create note for a specific store and periode
router.put("/note", prepClosingController.updateNote);

// WRC Extractor - Get Rules
router.get("/wrc-extract-rules", prepClosingController.getWrcExtractRules);

// WRC Extractor - Update Rules
router.put("/wrc-extract-rules", prepClosingController.updateWrcExtractRules);

// WRC Extractor - Get Sync Status per cabang
router.get("/wrc-sync-status", prepClosingController.getWrcSyncStatus);

// WRC Extractor - Trigger Sync Data
router.post("/wrc-extract-trigger", prepClosingController.triggerWrcExtraction);

export default router;
