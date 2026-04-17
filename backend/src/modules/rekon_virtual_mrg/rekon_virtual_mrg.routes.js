import express from "express";
import * as rekonVirtualController from "./rekon_virtual_mrg.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// Initialize routes for screening to stores by cabang (fixed cabang or all cabang)
router.get("/screening", rekonVirtualController.screeningByCabang);

// Get summary statistics
router.get("/summary", rekonVirtualController.getSummary);

// Get all records with pagination and filters
router.get("/", rekonVirtualController.getAllRecords);

// Get all records without pagination and filters
router.get("/getData", rekonVirtualController.getAll);

// Get single record
router.get("/:cabang/:shop/:tanggal/:prdcd", rekonVirtualController.getRecord);

// Create new record
router.post("/", rekonVirtualController.createRecord);

// Update record
router.put("/:cabang/:shop/:tanggal/:prdcd", rekonVirtualController.updateRecord);

// Update RECID field specifically
router.put("/recid", rekonVirtualController.updateRecid);

// Delete record
router.delete("/:cabang/:shop/:tanggal/:prdcd", rekonVirtualController.deleteRecord);

// Insert records from store
router.post("/insert-from-store", rekonVirtualController.insertFromStore);

// Sync all data (Migration)
router.post("/sync-all", rekonVirtualController.syncAllData);

// Update or create note for a specific record
router.put("/note/:cabang/:shop/:tanggal/:prdcd", rekonVirtualController.updateNote);

export default router;
