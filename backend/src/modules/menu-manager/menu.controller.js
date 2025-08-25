/**
 * Menu Controller
 * Handles HTTP requests for menu management
 */
const Menu = require("../../models/menu.model");
const { apiResponse } = require("../../utils");

class MenuController {
  /**
   * Get all menus
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllMenus(req, res, next) {
    try {
      const menus = await Menu.findAll();
      return apiResponse.success(res, menus);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get menu by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getMenuById(req, res, next) {
    try {
      const { id } = req.params;
      const menu = await Menu.findByPk(id);

      if (!menu) {
        return apiResponse.notFound(res, `Menu with ID ${id} not found`);
      }

      return apiResponse.success(res, menu);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get menus by user role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getMenusByRole(req, res, next) {
    try {
      const { role } = req.params;
      const menus = await Menu.findByRole(role);
      return apiResponse.success(res, menus);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get menus for current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getMenusForCurrentUser(req, res, next) {
    try {
      // Get user role from authenticated user
      const { role } = req.user;
      const menus = await Menu.findByRole(role);
      return apiResponse.success(res, menus);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new menu
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createMenu(req, res, next) {
    try {
      const menuData = req.body;
      const newMenu = await Menu.create(menuData);
      return apiResponse.created(res, newMenu);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing menu
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateMenu(req, res, next) {
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
  }

  /**
   * Delete a menu
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteMenu(req, res, next) {
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
  }
}

module.exports = new MenuController();
