/**
 * Routes for sales per department
 */
import express from 'express';
import { syncSalesPerDept,
  getSalesPerDept,
  compareSalesPerDept } from './sales_per_dept.controller.js';
import { authenticateJWT } from '../../middlewares/index.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

// Synchronize sales per department data
router.post("/sync", syncSalesPerDept);

// Get sales per department data
router.get("/", getSalesPerDept);

// Compare sales per department data between two periods
router.get("/compare", compareSalesPerDept);

export default router;
