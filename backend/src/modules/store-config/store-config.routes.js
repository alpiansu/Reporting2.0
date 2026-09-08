/**
 * Routes untuk store-config API
 * Hanya bisa diakses oleh superadmin
 */
import express from "express";
import {
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
} from "./store-config.controller.js";
import { authenticateJWT, authorizeRole } from "../../middlewares/index.js";

const router = express.Router();

// Protect all routes dengan authentication
router.use(authenticateJWT);

// Hanya superadmin yang bisa mengakses
router.use(authorizeRole(["superadmin"]));

router.get("/", getAllConfigs);
router.get("/:id", getConfigById);
router.post("/", createConfig);
router.put("/:id", updateConfig);
router.delete("/:id", deleteConfig);

export default router;
