const express = require("express");
const ScreeningController = require("./screening.controller");
const { authenticateJWT, authorizeRole } = require("../../middlewares");

const screeningController = new ScreeningController();

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Screening
 *   description: Screening management
 */

/**
 * @swagger
 * /screenings:
 *   get:
 *     summary: Get all screenings
 *     tags: [Screening]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of screenings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Screening'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Screening:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         storeId:
 *           type: integer
 *         status:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @route GET /api/screenings
 * @desc Get all screenings with pagination
 * @access Private
 */
router.get("/", authenticateJWT, screeningController.getAllScreenings);

/**
 * @route GET /api/screenings/:id
 * @desc Get screening by ID
 * @access Private
 */
router.get("/:id", authenticateJWT, screeningController.getScreeningById);

/**
 * @route POST /api/screenings
 * @desc Start a new screening process
 * @access Private
 */
router.post("/", authenticateJWT, screeningController.startScreening);

/**
 * @route GET /api/screenings/:id/progress
 * @desc Get screening progress
 * @access Private
 */
router.get("/:id/progress", authenticateJWT, screeningController.getProgress);

/**
 * @route POST /api/screenings/:id/cancel
 * @desc Cancel an in-progress screening
 * @access Private
 */
router.post("/:id/cancel", authenticateJWT, screeningController.cancelScreening);

/**
 * @route GET /api/screenings/statistics
 * @desc Get screening statistics
 * @access Private (Admin/Manager only)
 */
router.get("/statistics", authenticateJWT, authorizeRole(["admin", "manager"]), screeningController.getStatistics);

module.exports = router;
