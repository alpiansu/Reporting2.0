const express = require("express");
const StoreController = require("./store.controller");
const { authenticateJWT, authorizeRole } = require("../../middlewares");

const storeController = new StoreController();

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Store
 *   description: Store management
 */

/**
 * @swagger
 * /stores:
 *   get:
 *     summary: Get all stores
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Store'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Store:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         address:
 *           type: string
 *         isActive:
 *           type: boolean
 */

/**
 * @route GET /api/stores
 * @desc Get all stores with pagination
 * @access Private
 */
router.get("/", authenticateJWT, storeController.getAllStores);

/**
 * @route GET /api/stores/:id
 * @desc Get store by ID
 * @access Private
 */
router.get("/:id", authenticateJWT, storeController.getStoreById);

/**
 * @route POST /api/stores
 * @desc Create a new store
 * @access Private (Admin/Manager only)
 */
router.post("/", authenticateJWT, authorizeRole(["admin", "manager"]), storeController.createStore);

/**
 * @route PUT /api/stores/:id
 * @desc Update store data
 * @access Private (Admin/Manager only)
 */
router.put("/:id", authenticateJWT, authorizeRole(["admin", "manager"]), storeController.updateStore);

/**
 * @route DELETE /api/stores/:id
 * @desc Delete a store
 * @access Private (Admin only)
 */
router.delete("/:id", authenticateJWT, authorizeRole("admin"), storeController.deleteStore);

/**
 * @route POST /api/stores/test-connection
 * @desc Test connection to a store database
 * @access Private
 */
router.post("/test-connection", authenticateJWT, storeController.testConnection);

module.exports = router;
