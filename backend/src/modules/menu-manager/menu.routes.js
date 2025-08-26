/**
 * Menu Routes
 * Defines API endpoints for menu management
 */
const express = require("express");
const menuController = require("./menu.controller");
const { authenticateJWT } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Semua endpoint menu hanya bisa diakses oleh admin & superadmin
router.get("/", authenticateJWT, menuController.getAllMenus);
router.get("/:id", authenticateJWT, menuController.getMenuById);
router.get("/role/:role", authenticateJWT, menuController.getMenusByRole);
router.get("/user/current", authenticateJWT, menuController.getMenusForCurrentUser);
router.post("/", authenticateJWT, menuController.createMenu);
router.put("/:id", authenticateJWT, menuController.updateMenu);
router.delete("/:id", authenticateJWT, menuController.deleteMenu);

module.exports = router;
