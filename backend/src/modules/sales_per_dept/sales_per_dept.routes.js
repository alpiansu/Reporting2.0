/**
 * Routes for sales per department
 */
const express = require("express");
const SalesPerDeptController = require("./sales_per_dept.controller");
const SalesPerDeptService = require("./sales_per_dept.service");
const { authenticateJWT } = require("../../middlewares");

// Create service instance
const salesPerDeptService = new SalesPerDeptService();
// Create controller with service dependency
const salesPerDeptController = new SalesPerDeptController(salesPerDeptService);
const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: SalesPerDept
 *   description: Sales per department data management
 */

/**
 * @swagger
 * /sales-per-dept/sync:
 *   post:
 *     summary: Synchronize sales per department data
 *     description: Trigger synchronization of sales per department data from external database
 *     tags: [SalesPerDept]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cab
 *               - periode
 *             properties:
 *               cab:
 *                 type: string
 *                 description: Branch code
 *               periode:
 *                 type: string
 *                 description: Period in YYMM format
 *     responses:
 *       200:
 *         description: Synchronization completed successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/sync", salesPerDeptController.syncSalesPerDept.bind(salesPerDeptController));

/**
 * @swagger
 * /sales-per-dept:
 *   get:
 *     summary: Get sales per department data
 *     description: Retrieve sales per department data based on filters
 *     tags: [SalesPerDept]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cab
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch code
 *       - in: query
 *         name: periode
 *         required: true
 *         schema:
 *           type: string
 *         description: Period in YYMM format
 *       - in: query
 *         name: tipestore
 *         schema:
 *           type: string
 *           enum: [ALL, REG, FRC]
 *         description: Store type (default is ALL)
 *     responses:
 *       200:
 *         description: Sales per department data retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", salesPerDeptController.getSalesPerDept.bind(salesPerDeptController));

/**
 * @swagger
 * /sales-per-dept/compare:
 *   get:
 *     summary: Compare sales per department data
 *     description: Compare sales per department data between two periods
 *     tags: [SalesPerDept]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cab
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch code
 *       - in: query
 *         name: periode1
 *         required: true
 *         schema:
 *           type: string
 *         description: First period in YYMM format
 *       - in: query
 *         name: periode2
 *         required: true
 *         schema:
 *           type: string
 *         description: Second period in YYMM format
 *       - in: query
 *         name: tipestore
 *         schema:
 *           type: string
 *           enum: [ALL, REG, FRC]
 *         description: Store type (default is ALL)
 *     responses:
 *       200:
 *         description: Comparison data retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/compare", salesPerDeptController.compareSalesPerDept.bind(salesPerDeptController));

module.exports = router;
