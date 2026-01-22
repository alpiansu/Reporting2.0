/**
 * Routes for Cetak BPB module
 */
import express from "express";
import * as cetakBpbController from "./cetak_bpb.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

/**
 * @route POST /api/cetak-bpb/process
 * @desc Process BPB printing for one or multiple stores and download merged PDF
 * @access Private
 */
router.post("/process", cetakBpbController.processCetakBpb);

/**
 * @route GET /api/cetak-bpb/download/:fileName
 * @desc Download a previously generated PDF file
 * @access Private
 */
router.get("/download/:fileName", cetakBpbController.downloadFile);

export default router;
