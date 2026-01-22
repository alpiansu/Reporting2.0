/**
 * Routes for Cetak BPB module
 */
import express from "express";
import * as cetakBpbController from "./cetak_bpb.controller.js";
import authMiddleware from "../auth/auth.middleware.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/cetak-bpb/process
 * @desc Process BPB printing for one or multiple stores
 * @access Private
 */
router.post("/process", cetakBpbController.processCetakBpb);

export default router;
