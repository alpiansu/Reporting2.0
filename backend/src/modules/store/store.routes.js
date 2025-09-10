import express from 'express';
import { getAllStores,
  getStoreById,
  getStoresByBranch,
  createStore,
  updateStore,
  deleteStore,
  testConnection } from './store.controller.js';
import { authenticateJWT, authorizeRole } from '../../middlewares/index.js';

const router = express.Router();

// Get all stores with pagination
router.get("/", authenticateJWT, getAllStores);

// Get stores by branch with pagination
router.get("/branch/:branchCode", authenticateJWT, getStoresByBranch);

// Get store by ID
router.get("/:id", authenticateJWT, getStoreById);

// Create a new store (Admin/Manager only)
router.post("/", authenticateJWT, authorizeRole(["admin", "manager"]), createStore);

// Update store data (Admin/Manager only)
router.put("/:id", authenticateJWT, authorizeRole(["admin", "manager"]), updateStore);

// Delete a store (Admin only)
router.delete("/:id", authenticateJWT, authorizeRole("admin"), deleteStore);

// Test connection to a store database
router.post("/test-connection", authenticateJWT, testConnection);

export default router;
