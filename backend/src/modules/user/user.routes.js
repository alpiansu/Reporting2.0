import express from 'express';
import { getAllUsers, searchUsers, getUserById, createUser, updateUser, deleteUser, resetPassword, cleanupTestData } from './user.controller.js';
import { authenticateJWT, authorizeRole } from '../../middlewares/index.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

router.get("/", authorizeRole(["admin", "superadmin"]), getAllUsers);
router.get("/search", authorizeRole(["admin", "superadmin"]), searchUsers); // Added search endpoint
router.get("/:id", authorizeRole(["admin", "superadmin"]), getUserById);
router.post("/", authorizeRole(["admin", "superadmin"]), createUser);
router.put("/:id", authorizeRole(["admin", "superadmin"]), updateUser);
router.delete("/:id", authorizeRole(["admin", "superadmin"]), deleteUser);
router.post("/:id/reset-password", authorizeRole(["admin", "superadmin"]), resetPassword);
router.post("/cleanup-test-data", authorizeRole(["admin", "superadmin"]), cleanupTestData);

export default router;