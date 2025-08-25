/**
 * Menu Routes
 * Defines API endpoints for menu management
 */
const express = require('express');
const menuController = require('./menu.controller');
const { authMiddleware } = require('../../middlewares');

const router = express.Router();

// Get all menus - Admin only
router.get('/', authMiddleware.isAdmin, menuController.getAllMenus);

// Get menu by ID - Admin only
router.get('/:id', authMiddleware.isAdmin, menuController.getMenuById);

// Get menus by role - Admin only
router.get('/role/:role', authMiddleware.isAdmin, menuController.getMenusByRole);

// Get menus for current user - Any authenticated user
router.get('/user/current', authMiddleware.authenticate, menuController.getMenusForCurrentUser);

// Create a new menu - Admin only
router.post('/', authMiddleware.isAdmin, menuController.createMenu);

// Update an existing menu - Admin only
router.put('/:id', authMiddleware.isAdmin, menuController.updateMenu);

// Delete a menu - Admin only
router.delete('/:id', authMiddleware.isAdmin, menuController.deleteMenu);

module.exports = router;