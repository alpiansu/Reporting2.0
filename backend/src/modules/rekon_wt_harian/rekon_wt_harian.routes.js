/**
 * Routes for WT reconciliation
 */
const express = require("express");
const router = express.Router();
const rekonWtHarianController = require("./rekon_wt_harian.controller");
const { authenticateJWT, authorizeRole } = require("../../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: RekonWtHarian
 *   description: Rekonsiliasi WT Harian API
 */

/**
 * @swagger
 * /rekon-wt-harian:
 *   post:
 *     summary: Start reconciliation process
 *     description: Start the reconciliation process for a specific branch and period. This will compare data from WRC and store databases and save differences.
 *     tags: [RekonWtHarian]
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
 *                 example: G001
 *               periode:
 *                 type: string
 *                 description: Period in YYMM format
 *                 example: 2507
 *     responses:
 *       200:
 *         description: Reconciliation started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the operation was successful
 *                 totalStores:
 *                   type: integer
 *                   description: Total number of stores processed
 *                 processedStores:
 *                   type: integer
 *                   description: Number of stores successfully processed
 *                 storesWithDifferences:
 *                   type: integer
 *                   description: Number of stores with differences
 *                 totalDifferences:
 *                   type: integer
 *                   description: Total number of differences found
 *                 details:
 *                   type: array
 *                   description: Details of stores with differences
 *                   items:
 *                     type: object
 *                     properties:
 *                       store:
 *                         type: string
 *                         description: Store code
 *                       differences:
 *                         type: integer
 *                         description: Number of differences found
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User does not have required role
 *       500:
 *         description: Server error
 */

/**
 * @route POST /api/rekon-wt-harian
 * @desc Start reconciliation process
 * @access Private (Admin/Manager only)
 */
router.post("/", authenticateJWT, authorizeRole(["admin", "manager"]), rekonWtHarianController.startReconciliation);

/**
 * @route GET /api/rekon-wt-harian/progress/:progressId
 * @desc Get reconciliation progress
 * @access Private
 */
router.get("/progress/:progressId", authenticateJWT, rekonWtHarianController.getProgress);

/**
 * @route GET /api/rekon-wt-harian/latest-progress/:cab/:periode
 * @desc Get latest reconciliation progress for a branch and period
 * @access Private
 */
router.get("/latest-progress/:cab/:periode", authenticateJWT, rekonWtHarianController.getLatestProgress);

/**
 * @swagger
 * /rekon-wt-harian/{cab}/{periode}:
 *   get:
 *     summary: Get reconciliation results
 *     tags: [RekonWtHarian]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cab
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch code
 *       - in: path
 *         name: periode
 *         required: true
 *         schema:
 *           type: string
 *         description: Period in YYMM format
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Number of items per page (max 100)
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [WRC, STORE, BOTH]
 *         description: Data source filter
 *       - in: query
 *         name: tipe
 *         schema:
 *           type: string
 *         description: Transaction type filter (NKL, BRK, PCAFE, etc.)
 *       - in: query
 *         name: toko
 *         schema:
 *           type: string
 *         description: Store code filter
 *       - in: query
 *         name: tgl1
 *         schema:
 *           type: string
 *           format: date
 *         description: Date filter (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of reconciliation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of records
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 limit:
 *                   type: integer
 *                   description: Number of items per page
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RekonWtHarian'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 * @route GET /api/rekon-wt-harian/:cab/:periode
 * @desc Get reconciliation results
 * @access Private
 */
router.get("/:periode/:cab", authenticateJWT, rekonWtHarianController.getResults);

/**
 * @swagger
 * /rekon-wt-harian/{cab}/{periode}/summary:
 *   get:
 *     summary: Get summary of reconciliation results
 *     description: Get a summary of reconciliation results grouped by source (WRC, STORE, BOTH)
 *     tags: [RekonWtHarian]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cab
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch code
 *         example: G001
 *       - in: path
 *         name: periode
 *         required: true
 *         schema:
 *           type: string
 *         description: Period in YYMM format
 *         example: 2507
 *     responses:
 *       200:
 *         description: Summary of reconciliation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the operation was successful
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       source:
 *                         type: string
 *                         enum: [WRC, STORE, BOTH]
 *                         description: Data source
 *                       total_records:
 *                         type: integer
 *                         description: Total number of records
 *                       total_selisih_gross:
 *                         type: number
 *                         description: Total difference in gross value
 *                       total_selisih_ppn:
 *                         type: number
 *                         description: Total difference in PPN value
 *                       total_selisih_gross_idm:
 *                         type: number
 *                         description: Total difference in gross IDM value
 *                       total_selisih_ppn_idm:
 *                         type: number
 *                         description: Total difference in PPN IDM value
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 * @route GET /api/rekon-wt-harian/:cab/:periode/summary
 * @desc Get summary of reconciliation results
 * @access Private
 */
router.get("/:cab/:periode/summary", authenticateJWT, rekonWtHarianController.getSummary);

/**
 * @swagger
 * /rekon-wt-harian/{cab}/{periode}:
 *   delete:
 *     summary: Delete reconciliation results
 *     description: Delete all reconciliation results for a specific branch and period
 *     tags: [RekonWtHarian]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cab
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch code
 *         example: G001
 *       - in: path
 *         name: periode
 *         required: true
 *         schema:
 *           type: string
 *         description: Period in YYMM format
 *         example: 2507
 *     responses:
 *       200:
 *         description: Reconciliation results deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the operation was successful
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: 42 data berhasil dihapus
 *                 deletedCount:
 *                   type: integer
 *                   description: Number of deleted records
 *                   example: 42
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User does not have required role
 *       500:
 *         description: Server error
 *
 * @route DELETE /api/rekon-wt-harian/:cab/:periode
 * @desc Delete reconciliation results
 * @access Private (Admin/Manager only)
 */
router.delete(
  "/:cab/:periode",
  authenticateJWT,
  authorizeRole(["admin", "manager"]),
  rekonWtHarianController.deleteResults
);

/**
 * @swagger
 * /rekon-wt-harian/progress-updates/{progressId}:
 *   get:
 *     summary: Get real-time progress updates via SSE
 *     description: Establishes a Server-Sent Events connection to receive real-time updates on reconciliation progress
 *     tags: [RekonWtHarian]
 *     parameters:
 *       - in: path
 *         name: progressId
 *         required: true
 *         schema:
 *           type: string
 *         description: Progress ID to subscribe to
 *     responses:
 *       200:
 *         description: SSE connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Progress ID not found
 *       500:
 *         description: Server error
 */
// This endpoint is handled by rekonWebSocketService in server.js

module.exports = router;
