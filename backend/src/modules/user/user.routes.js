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
 * @route POST /api/users/cleanup-test-data
 * @desc Clean up test data, keeping only the admin user
 * @access Private (Admin only)
 */
router.post("/cleanup-test-data", authorizeRole(["admin", "superadmin"]), userController.cleanupTestData);

module.exports = router;
