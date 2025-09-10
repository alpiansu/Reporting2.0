/**
 * Menu Controller
 * Handles HTTP requests for menu management
 */
import Menu from '../../models/menu.model.js';
import { apiResponse } from '../../utils/index.js';

/**
 * Get all menus
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllMenus = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    const menus = await Menu.findAll();
    // Filter menu items by user role
    const filteredMenus = Array.isArray(menus)
      ? menus.filter(menu => {
          // menu.items bisa array, filter juga per item
          if (Array.isArray(menu.items)) {
            menu.items = menu.items.filter(item =>
              Array.isArray(item.roles) ? item.roles.includes(userRole) : true
            );
            return menu;
          }
          return true;
        })
      : [];
    return apiResponse.success(res, filteredMenus, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get menu by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getMenuById = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    const { id } = req.params;
    const menu = await Menu.findByPk(id);
    if (!menu) {
      return apiResponse.notFound(res, `Menu with ID ${id} not found`);
    }
    // Filter items by user role
    if (Array.isArray(menu.items)) {
      menu.items = menu.items.filter(item => (Array.isArray(item.roles) ? item.roles.includes(userRole) : true));
    }
    // Jika items kosong, jangan tampilkan menu
    if (Array.isArray(menu.items) && menu.items.length === 0) {
      return apiResponse.notFound(res, `Menu with ID ${id} not found for your role`);
    }
    return apiResponse.success(res, menu);
  } catch (error) {
    next(error);
  }
};

/**
 * Get menus by user role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getMenusByRole = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    // Gunakan role dari req.user, abaikan param
    const menus = await Menu.findByRole(userRole);
    // Filter items by user role
    const filteredMenus = Array.isArray(menus)
      ? menus.filter(menu => {
          if (Array.isArray(menu.items)) {
            menu.items = menu.items.filter(item =>
              Array.isArray(item.roles) ? item.roles.includes(userRole) : true
            );
            return menu.items.length > 0;
          }
          return true;
        })
      : [];
    return apiResponse.success(res, filteredMenus);
  } catch (error) {
    next(error);
  }
};

/**
 * Get menus for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getMenusForCurrentUser = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    const menus = await Menu.findByRole(userRole);
    // Filter items by user role
    const filteredMenus = Array.isArray(menus)
      ? menus.filter(menu => {
          if (Array.isArray(menu.items)) {
            menu.items = menu.items.filter(item =>
              Array.isArray(item.roles) ? item.roles.includes(userRole) : true
            );
            return menu.items.length > 0;
          }
          return true;
        })
      : [];
    return apiResponse.success(res, filteredMenus);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new menu
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createMenu = async (req, res, next) => {
  try {
    const menuData = req.body;
    const newMenu = await Menu.create(menuData);
    return apiResponse.created(res, newMenu);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing menu
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateMenu = async (req, res, next) => {
  try {
    const { id } = req.params;
    const menuData = { ...req.body, id };

    // Check if menu exists
    const existingMenu = await Menu.findByPk(id);
    if (!existingMenu) {
      return apiResponse.notFound(res, `Menu with ID ${id} not found`);
    }

    const updatedMenu = await Menu.update(menuData);
    return apiResponse.success(res, updatedMenu);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a menu
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteMenu = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if menu exists
    const existingMenu = await Menu.findByPk(id);
    if (!existingMenu) {
      return apiResponse.notFound(res, `Menu with ID ${id} not found`);
    }

    const deleted = await Menu.delete(id);

    if (deleted) {
      return apiResponse.success(res, true);
    } else {
      return apiResponse.notFound(res, `Menu with ID ${id} not found`);
    }
  } catch (error) {
    next(error);
  }
};

// ===== CATEGORY OPERATIONS =====

/**
 * Create a new category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createCategory = async (req, res, next) => {
  try {
    const categoryData = req.body;
    const newCategory = await Menu.createCategory(categoryData);
    return apiResponse.created(res, newCategory);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const categoryData = req.body;
    const updatedCategory = await Menu.updateCategory(id, categoryData);
    return apiResponse.success(res, updatedCategory);
  } catch (error) {
    if (error.message.includes("not found")) {
      return apiResponse.notFound(res, error.message);
    }
    next(error);
  }
};

/**
 * Delete a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Menu.deleteCategory(id);

    if (deleted) {
      return apiResponse.success(res, true);
    } else {
      return apiResponse.notFound(res, `Category with ID ${id} not found`);
    }
  } catch (error) {
    next(error);
  }
};

// ===== MENU ITEM OPERATIONS =====

/**
 * Add a menu item to a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const addMenuItem = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const itemData = req.body;
    const newItem = await Menu.addMenuItem(categoryId, itemData);
    return apiResponse.created(res, newItem);
  } catch (error) {
    if (error.message.includes("not found")) {
      return apiResponse.notFound(res, error.message);
    }
    next(error);
  }
};

/**
 * Update a menu item
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateMenuItem = async (req, res, next) => {
  try {
    const { categoryId, itemId } = req.params;
    const itemData = req.body;
    const updatedItem = await Menu.updateMenuItem(categoryId, itemId, itemData);
    return apiResponse.success(res, updatedItem);
  } catch (error) {
    if (error.message.includes("not found")) {
      return apiResponse.notFound(res, error.message);
    }
    next(error);
  }
};

/**
 * Delete a menu item
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteMenuItem = async (req, res, next) => {
  try {
    const { categoryId, itemId } = req.params;
    const deleted = await Menu.deleteMenuItem(categoryId, itemId);

    if (deleted) {
      return apiResponse.success(res, true);
    } else {
      return apiResponse.notFound(res, `Menu item with ID ${itemId} not found in category ${categoryId}`);
    }
  } catch (error) {
    if (error.message.includes("not found")) {
      return apiResponse.notFound(res, error.message);
    }
    next(error);
  }
};

/**
 * Move a menu item to a different category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const moveMenuItem = async (req, res, next) => {
  try {
    const { fromCategoryId, toCategoryId, itemId } = req.params;
    const movedItem = await Menu.moveMenuItem(fromCategoryId, toCategoryId, itemId);
    return apiResponse.success(res, movedItem);
  } catch (error) {
    if (error.message.includes("not found")) {
      return apiResponse.notFound(res, error.message);
    }
    next(error);
  }
};
