import { Router } from "express";
import * as adjustController from "./adjust.controller.js";
import { uploadCsv, handleMulterError } from "./adjust.middleware.js";

const router = Router();

router.post("/upload", uploadCsv, handleMulterError, adjustController.uploadAdjustCsv);
router.get("/template", adjustController.downloadCsvTemplate);

export default router;
