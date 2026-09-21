import express from 'express';
import { getAllStores,
  getStoreById,
  getStoresByBranch,
  createStore,
  updateStore,
  deleteStore,
  testConnection,
  uploadTokomain,
  uploadMasterCsv,
  getSyncStatus,
  syncMaster,
  syncMasterCsv } from './store.controller.js';
import { uploadIni, uploadCsv, handleMulterError } from './store.middleware.js';
import { authenticateJWT, authorizeRole } from '../../middlewares/index.js';

const router = express.Router();

// Get all stores with pagination
router.get("/", authenticateJWT, getAllStores);

// Get stores by branch with pagination
router.get("/branch/:branchCode", authenticateJWT, getStoresByBranch);

// Get master store sync status (snapshot + last sync info)
router.get("/sync-status", authenticateJWT, getSyncStatus);

// Get store by ID
router.get("/:id", authenticateJWT, getStoreById);

// Create a new store (Superadmin only)
router.post("/", authenticateJWT, authorizeRole("superadmin"), createStore);

// Upload TOKOMAIN.ini snapshot (any authenticated user - store PC client)
router.post("/upload-tokomain", authenticateJWT, uploadIni, handleMulterError, uploadTokomain);

// Upload master-tokomain.csv snapshot (Admin/Superadmin)
router.post("/upload-master-csv", authenticateJWT, authorizeRole(["admin", "superadmin"]), uploadCsv, handleMulterError, uploadMasterCsv);

// Execute master store sync from TOKOMAIN.ini (Admin/Superadmin)
router.post("/sync-master", authenticateJWT, authorizeRole(["admin", "superadmin"]), syncMaster);

// Execute master store sync from master-tokomain.csv (Admin/Superadmin)
router.post("/sync-master-csv", authenticateJWT, authorizeRole(["admin", "superadmin"]), syncMasterCsv);

// Update store data (Admin/Superadmin)
router.put("/:id", authenticateJWT, authorizeRole(["admin", "superadmin"]), updateStore);

// Delete a store (Superadmin only)
router.delete("/:id", authenticateJWT, authorizeRole("superadmin"), deleteStore);

// Test connection to a store database
router.post("/test-connection", authenticateJWT, testConnection);

export default router;
