import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import { dispatch, getLogs, batchStatus, dispatchSummary, dispatchUnsent } from "./dthr_ftp.controller.js";

const router = express.Router();
router.use(authenticateJWT);

router.post("/dispatch", dispatch);
router.get("/logs", getLogs);
router.post("/batch-status", batchStatus);
router.get("/dispatch-summary", dispatchSummary);
router.post("/dispatch-unsent", dispatchUnsent);

export default router;
