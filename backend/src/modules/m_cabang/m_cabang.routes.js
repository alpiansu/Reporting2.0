/**
 * Routes for m_cabang
 */
const express = require("express");
const MCabangController = require("./m_cabang.controller");
const MCabangService = require("./m_cabang.service");
const { authenticateJWT } = require("../../middlewares");

// Create service instance
const mCabangService = new MCabangService();
// Create controller with service dependency
const mCabangController = new MCabangController(mCabangService);
const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: MCabang
 *   description: Cabang data management
 */

/**
 * @swagger
 * /m-cabang:
 *   get:
 *     summary: Get all cabang
 *     description: Retrieve a list of all cabang
 *     tags: [MCabang]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of cabang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Cabang list retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       kdcab:
 *                         type: string
 *                         example: G033
 *                       namacab:
 *                         type: string
 *                         example: TANGERANG 2
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", mCabangController.getAllCabang.bind(mCabangController));

/**
 * @swagger
 * /m-cabang/{kdcab}:
 *   get:
 *     summary: Get cabang by code
 *     description: Retrieve a cabang by its code
 *     tags: [MCabang]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kdcab
 *         required: true
 *         schema:
 *           type: string
 *         description: Cabang code
 *     responses:
 *       200:
 *         description: Cabang data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Cabang retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     kdcab:
 *                       type: string
 *                       example: G033
 *                     namacab:
 *                       type: string
 *                       example: TANGERANG 2
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cabang not found
 *       500:
 *         description: Server error
 */
router.get("/:kdcab", mCabangController.getCabangByCode.bind(mCabangController));

/**
 * @swagger
 * /m-cabang:
 *   post:
 *     summary: Create a new cabang
 *     description: Create a new cabang record
 *     tags: [MCabang]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kdcab
 *               - namacab
 *             properties:
 *               kdcab:
 *                 type: string
 *                 example: G033
 *               namacab:
 *                 type: string
 *                 example: TANGERANG 2
 *     responses:
 *       201:
 *         description: Cabang created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", mCabangController.createCabang.bind(mCabangController));

/**
 * @swagger
 * /m-cabang/{kdcab}:
 *   put:
 *     summary: Update a cabang
 *     description: Update an existing cabang record
 *     tags: [MCabang]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kdcab
 *         required: true
 *         schema:
 *           type: string
 *         description: Cabang code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - namacab
 *             properties:
 *               namacab:
 *                 type: string
 *                 example: TANGERANG 2
 *     responses:
 *       200:
 *         description: Cabang updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cabang not found
 *       500:
 *         description: Server error
 */
router.put("/:kdcab", mCabangController.updateCabang.bind(mCabangController));

/**
 * @swagger
 * /m-cabang/{kdcab}:
 *   delete:
 *     summary: Delete a cabang
 *     description: Delete a cabang record
 *     tags: [MCabang]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kdcab
 *         required: true
 *         schema:
 *           type: string
 *         description: Cabang code
 *     responses:
 *       200:
 *         description: Cabang deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cabang not found
 *       500:
 *         description: Server error
 */
router.delete("/:kdcab", mCabangController.deleteCabang.bind(mCabangController));

module.exports = router;