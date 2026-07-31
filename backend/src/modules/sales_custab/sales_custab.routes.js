import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import { downloadCustab } from "./sales_custab.controller.js";
import { uploadCsv, handleMulterError } from "./sales_custab.middleware.js";

const router = express.Router();

router.use(authenticateJWT);

router.post("/download", uploadCsv, handleMulterError, downloadCustab);

export default router;
