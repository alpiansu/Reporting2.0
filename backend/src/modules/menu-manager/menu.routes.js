/**
 * Menu Routes
 * Defines API endpoints for menu management
 */
const express = require("express");
const menuController = require("./menu.controller");
const { authenticateJWT, authorizeRole } = require("../../middlewares/auth.middleware");

const router = express.Router();
const allowedRoles = ["admin", "superadmin"];

// Semua endpoint menu hanya bisa diakses oleh admin & superadmin
router.get("/", authenticateJWT, authorizeRole(allowedRoles), menuController.getAllMenus);
router.get("/:id", authenticateJWT, authorizeRole(allowedRoles), menuController.getMenuById);
router.get("/role/:role", authenticateJWT, authorizeRole(allowedRoles), menuController.getMenusByRole);
router.get("/user/current", authenticateJWT, authorizeRole(allowedRoles), menuController.getMenusForCurrentUser);
router.post("/", authenticateJWT, authorizeRole(allowedRoles), menuController.createMenu);
router.put("/:id", authenticateJWT, authorizeRole(allowedRoles), menuController.updateMenu);
router.delete("/:id", authenticateJWT, authorizeRole(allowedRoles), menuController.deleteMenu);

module.exports = router;
