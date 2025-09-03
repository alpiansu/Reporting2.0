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
              // Jika setelah filter items kosong, jangan tampilkan menu
              return menu.items.length > 0;
            }
            return true;
          })
        : [];
      return apiResponse.success(res, filteredMenus, 200);
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
  }

  /**
   * Get menus by user role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getMenusByRole(req, res, next) {
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
  }

  /**
   * Get menus for current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getMenusForCurrentUser(req, res, next) {
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
