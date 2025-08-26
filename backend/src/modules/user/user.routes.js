/**
 * Routes for user management
 */
const express = require("express");
const UserController = require("./user.controller");
const { authenticateJWT, authorizeRole } = require("../../middlewares");

const userController = new UserController();

const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private (Admin only)
 */
router.get("/", authorizeRole(["admin", "superadmin"]), userController.getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (Admin only)
 */
router.get("/:id", authorizeRole(["admin", "superadmin"]), userController.getUserById);

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Private (Admin only)
 */
router.post("/", authorizeRole(["admin", "superadmin"]), userController.createUser);

/**
 * @route PUT /api/users/:id
 * @desc Update an existing user
 * @access Private (Admin only)
 */
router.put("/:id", authorizeRole(["admin", "superadmin"]), userController.updateUser);

/**
 * @route DELETE /api/users/:id
 * @desc Delete a user
 * @access Private (Admin only)
 */
router.delete("/:id", authorizeRole(["admin", "superadmin"]), userController.deleteUser);

/**
 * @route POST /api/users/:id/reset-password
 * @desc Reset user password
 * @access Private (Admin only)
 */
router.post("/:id/reset-password", authorizeRole(["admin", "superadmin"]), userController.resetPassword);

/**
 * @route POST /api/users/cleanup-test-data
 * @desc Clean up test data, keeping only the admin user
 * @access Private (Admin only)
 */
router.post("/cleanup-test-data", authorizeRole(["admin", "superadmin"]), userController.cleanupTestData);

module.exports = router;
