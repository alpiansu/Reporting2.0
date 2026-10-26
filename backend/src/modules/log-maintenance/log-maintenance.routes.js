import express from "express";
import { authenticateJWT, authorizeRole } from "../../middlewares/index.js";
import {
  bulkDeleteFiles,
  createDownloadTicket,
  deleteFile,
  downloadByTicket,
  getFileContent,
  getFileHours,
  listFiles,
  searchFile,
} from "./log-maintenance.controller.js";

const router = express.Router();

router.get("/download", downloadByTicket);

router.use(authenticateJWT, authorizeRole(["superadmin"]));

router.get("/files", listFiles);
router.get("/files/:filename/content", getFileContent);
router.get("/files/:filename/hours", getFileHours);
router.get("/files/:filename/search", searchFile);
router.post("/files/:filename/download-ticket", createDownloadTicket);
router.delete("/files/:filename", deleteFile);
router.post("/files/bulk-delete", bulkDeleteFiles);

export default router;
