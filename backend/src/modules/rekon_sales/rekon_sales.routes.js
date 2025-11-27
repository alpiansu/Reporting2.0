import express from "express";
import * as rekonSalesController from "./rekon_sales.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// Screening routes (supports 3 levels: All cabang, 1 cabang, 1 store)
router.get("/screening", rekonSalesController.screeningByCabang);

// Get summary statistics
router.get("/summary", rekonSalesController.getSummary);

// Get resume per store (paginated)
router.get("/resumePerShop", rekonSalesController.getResumeByKdtk);

// Get detailed data for a specific store and date
router.get("/details", rekonSalesController.getStoreDetails);

// Get detail differences (mtran vs closing detail)
router.get("/differences", rekonSalesController.getDifferences);

// Get kode pesanan issues
router.get("/kodePesananIssues", rekonSalesController.getKodePesananIssues);

// Export data for Excel
router.get("/export-data", rekonSalesController.getExportData);

// Update or create note for a specific store and date
router.put("/note", rekonSalesController.updateNote);

export default router;
