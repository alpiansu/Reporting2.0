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

// ===== CATEGORY ROUTES =====
router.post("/categories", authenticateJWT, menuController.createCategory);
router.put("/categories/:id", authenticateJWT, menuController.updateCategory);
router.delete("/categories/:id", authenticateJWT, menuController.deleteCategory);

// ===== MENU ITEM ROUTES =====
router.post("/categories/:categoryId/items", authenticateJWT, menuController.addMenuItem);
router.put("/categories/:categoryId/items/:itemId", authenticateJWT, menuController.updateMenuItem);
router.delete("/categories/:categoryId/items/:itemId", authenticateJWT, menuController.deleteMenuItem);
router.post("/categories/:fromCategoryId/items/:itemId/move/:toCategoryId", authenticateJWT, menuController.moveMenuItem);

module.exports = router;
