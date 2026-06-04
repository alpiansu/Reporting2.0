import express from "express";
import buatRmbController from "./buat_rmb.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";
import multer from "multer";

const router = express.Router();

// Configure multer for CSV upload (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// Require authentication for all routes
router.use(authenticateJWT);

// API Endpoints
router.post("/upload", upload.single("file"), buatRmbController.uploadCsv);
router.get("/history", buatRmbController.getHistory);
router.get("/history/export", buatRmbController.exportHistory);
router.get("/filters", buatRmbController.getFilters);
router.get("/template/download", buatRmbController.downloadTemplate);

// Manual input routes
router.get("/check-connection", buatRmbController.checkConnection);
router.get("/store-products", buatRmbController.searchStoreProducts);
router.post("/manual", buatRmbController.insertManual);

export default router;
