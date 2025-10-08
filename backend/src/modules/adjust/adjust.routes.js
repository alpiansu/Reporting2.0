import { Router } from "express";
import * as adjustController from "./adjust.controller.js";
import { uploadCsv, handleMulterError } from "./adjust.middleware.js";

const router = Router();

router.post("/upload", uploadCsv, handleMulterError, adjustController.uploadAdjustCsv);

export default router;
