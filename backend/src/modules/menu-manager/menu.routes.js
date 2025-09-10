/**
 * Menu Routes
 * Defines API endpoints for menu management
 */
import express from 'express';
import { getAllMenus,
  getMenuById,
  getMenusByRole,
  getMenusForCurrentUser,
  createMenu,
  updateMenu,
  deleteMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  moveMenuItem } from './menu.controller.js';
import { authenticateJWT } from '../../middlewares/index.js';

const router = express.Router();

// Semua endpoint menu hanya bisa diakses oleh admin & superadmin
router.get("/", authenticateJWT, getAllMenus);
router.get("/:id", authenticateJWT, getMenuById);
router.get("/role/:role", authenticateJWT, getMenusByRole);
router.get("/user/current", authenticateJWT, getMenusForCurrentUser);
router.post("/", authenticateJWT, createMenu);
router.put("/:id", authenticateJWT, updateMenu);
router.delete("/:id", authenticateJWT, deleteMenu);

// ===== CATEGORY ROUTES =====
router.post("/categories", authenticateJWT, createCategory);
router.put("/categories/:id", authenticateJWT, updateCategory);
router.delete("/categories/:id", authenticateJWT, deleteCategory);

// ===== MENU ITEM ROUTES =====
router.post("/categories/:categoryId/items", authenticateJWT, addMenuItem);
router.put("/categories/:categoryId/items/:itemId", authenticateJWT, updateMenuItem);
router.delete("/categories/:categoryId/items/:itemId", authenticateJWT, deleteMenuItem);
router.post("/categories/:fromCategoryId/items/:itemId/move/:toCategoryId", authenticateJWT, moveMenuItem);

export default router;
