import express from "express";
import * as cetakNrbController from "./cetak_nrb.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();
router.use(authenticateJWT);

router.post("/process", cetakNrbController.processCetakNrb);
router.get("/download/:fileName", cetakNrbController.downloadFile);

export default router;
