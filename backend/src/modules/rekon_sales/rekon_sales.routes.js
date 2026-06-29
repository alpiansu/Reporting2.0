import express from "express";
import * as rekonSalesController from "./rekon_sales.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";
import { body } from "express-validator";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateJWT);

//validasi route harus ada periode dengan format YYYY-MM, dan kdtk jika cabang tidak ALL satu per satu pakai express-validator di controller, karena route ini akan dipakai untuk semua level screening (ALL cabang, 1 cabang, 1 store) jadi validasi dilakukan di controller saja untuk fleksibilitas
const validatePeriod = [
  body(["periode"]).not().isEmpty().trim().escape().withMessage("tidak boleh kosong"),
  body(["periode"]).isDate({ format: "YYYY-MM-DD" }).withMessage("format tanggal periode harus YYYY-MM-DD"),
];

const validateCabangKdtk = [
  body(["cabang"]).not().isEmpty().trim().escape().withMessage("tidak boleh kosong"),
  body(["cabang"]).isString().withMessage("cabang harus berupa string"),
  body(["kdtk"])
    .if(body(["cabang"]).not().equals("ALL"))
    .not()
    .isEmpty()
    .withMessage("kdtk harus diisi jika cabang tidak ALL"),
];

// Screening routes (supports 3 levels: All cabang, 1 cabang, 1 store)
router.get("/screening", validatePeriod, validateCabangKdtk, rekonSalesController.screeningByCabang);

// Get summary statistics
router.get("/summary", validatePeriod, validateCabangKdtk, rekonSalesController.getSummary);

// Get resume per store (paginated)
router.get("/resumePerShop", validatePeriod, validateCabangKdtk, rekonSalesController.getResumeByKdtk);

// Get detailed data for a specific store and date
router.get("/details", validatePeriod, validateCabangKdtk, rekonSalesController.getStoreDetails);

// Get detail differences (mtran vs closing detail)
router.get("/differences", validatePeriod, validateCabangKdtk, rekonSalesController.getDifferences);

// Get kode pesanan issues
router.get("/kodePesananIssues", validatePeriod, validateCabangKdtk, rekonSalesController.getKodePesananIssues);

// Export data for Excel
router.get("/export-data", validatePeriod, validateCabangKdtk, rekonSalesController.getExportData);

// Get comprehensive rekon sales data (path params — gaya reference)
router.get("/data/:cab/:month/:year", rekonSalesController.getRekonSalesData);

// Get comprehensive rekon sales data (query params — gaya project saat ini)
router.get("/data", rekonSalesController.getRekonSalesData);

// Get detail mtran vs cd for a specific store and date (path params)
router.get("/detil/:tgl/:kdtk", rekonSalesController.getDetailRekonSales);

// Get detail mtran vs cd for a specific store and date (query params)
router.get("/detil", rekonSalesController.getDetailRekonSales);

// Update or create note for a specific store and date
router.put("/note", validatePeriod, validateCabangKdtk, rekonSalesController.updateNote);

export default router;
