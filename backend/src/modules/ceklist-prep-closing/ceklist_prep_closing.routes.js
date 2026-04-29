import express from "express";
import * as ceklistController from "./ceklist_prep_closing.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";
import captureUpload from "./ceklist_capture.middleware.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

// ─── Space HDD Bulanan ────────────────────────────────────────────────────────
router.get("/space-hdd",         ceklistController.getSpaceHdd);
router.post("/space-hdd",        ceklistController.upsertSpaceHdd);
router.put("/space-hdd",         ceklistController.upsertSpaceHdd);
router.delete("/space-hdd",      ceklistController.deleteSpaceHdd);
router.post("/space-hdd/init",   ceklistController.initSpaceHdd);

// ─── Space HDD Tampung ────────────────────────────────────────────────────────
router.get("/space-tampung",         ceklistController.getSpaceTampung);
router.post("/space-tampung",        ceklistController.upsertSpaceTampung);
router.put("/space-tampung",         ceklistController.upsertSpaceTampung);
router.delete("/space-tampung",      ceklistController.deleteSpaceTampung);
router.post("/space-tampung/init",   ceklistController.initSpaceTampung);

// ─── Import IDT ───────────────────────────────────────────────────────────────
router.get("/import-idt",           ceklistController.getImportIdt);
router.post("/import-idt",          ceklistController.upsertImportIdt);
router.put("/import-idt",           ceklistController.upsertImportIdt);
router.delete("/import-idt",        ceklistController.deleteImportIdt);
// Upload capture image — must be before /init to avoid conflict
router.post("/import-idt/upload",   captureUpload.single("capture"), ceklistController.uploadCaptureIdt);
router.post("/import-idt/init",     ceklistController.initImportIdt);

// ─── Rekap Screening (read-only, from prep_closing) ───────────────────────────
router.get("/rekap-screening", ceklistController.getRekapScreening);

// ─── Export Excel ─────────────────────────────────────────────────────────────
router.get("/export-excel", ceklistController.exportExcel);

// ─── Summary ─────────────────────────────────────────────────────────────────
router.get("/summary", ceklistController.getSummary);

export default router;
