/**
 * Menu model - JSON file based implementation
 *
 * This model provides an interface similar to Sequelize models
 * but uses a JSON file as the data source instead of a database.
 *
 * The actual data operations are handled by the MenuService.
 */
import MenuService from '../modules/menu-manager/menu.service.js';

// Create a singleton instance of the service
const menuService = new MenuService();

// Define the Menu model schema for documentation and validation
const MenuSchema = {
  id: { type: "string", primaryKey: true },
  name: { type: "string", required: true },
  items: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string", required: true },
        text: { type: "string", required: true },
        icon: { type: "string", required: true },
        path: { type: "string", required: true },
        roles: { type: "array", items: { type: "string" }, default: [] },
        keywords: { type: "array", items: { type: "string" } },
      },
    },
  },
  order: { type: "number", default: 0 },
  createdAt: { type: "date" },
  updatedAt: { type: "date" },
};

/**
 * Menu model with methods similar to Sequelize models
 * but using the MenuService for actual data operations
 */
const Menu = {
  // Schema definition for documentation
  schema: MenuSchema,

  /**
   * Find all menus
   * @returns {Promise<Array>} Array of menu objects
   */
  findAll: async () => {
    return menuService.getAllMenus();
  },

  /**
   * Find a menu by primary key
   * @param {string} id - Menu ID
   * @returns {Promise<Object|null>} Menu object or null if not found
   */
  findByPk: async (id) => {
    await menuService.init();
    return menuService.getMenuById(id);
  },

  /**
   * Find menus by role
   * @param {string} role - User role
   * @returns {Promise<Array>} Array of menu objects filtered by role
   */
  findByRole: async (role) => {
    await menuService.init();
    return menuService.getMenusByRole(role);
  },

  /**
   * Create a new menu
   * @param {Object} menuData - Menu data
   * @returns {Promise<Object>} Created menu object
   */
  create: async (menuData) => {
    await menuService.init();
    return menuService.createMenu(menuData);
  },

  /**
   * Update a menu
   * @param {Object} menuData - Menu data with ID
   * @returns {Promise<Object>} Updated menu object
   */
  update: async (menuData) => {
    await menuService.init();
    return menuService.updateMenu(menuData);
  },

  /**
   * Delete a menu
   * @param {string} id - Menu ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  delete: async (id) => {
    await menuService.init();
    return menuService.deleteMenu(id);
  },

  // ===== CATEGORY OPERATIONS =====

  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @returns {Promise<Object>} Created category object
   */
  createCategory: async (categoryData) => {
    return menuService.createCategory(categoryData);
  },

  /**
   * Update a category
   * @param {string} id - Category ID
   * @param {Object} categoryData - Category data
   * @returns {Promise<Object>} Updated category object
   */
  updateCategory: async (id, categoryData) => {
    return menuService.updateCategory(id, categoryData);
  },

  /**
   * Delete a category
   * @param {string} id - Category ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  deleteCategory: async (id) => {
    return menuService.deleteCategory(id);
  },

  // ===== MENU ITEM OPERATIONS =====

  /**
   * Add a menu item to a category
   * @param {string} categoryId - Category ID
   * @param {Object} itemData - Menu item data
   * @returns {Promise<Object>} Created menu item object
   */
  addMenuItem: async (categoryId, itemData) => {
    return menuService.addMenuItem(categoryId, itemData);
  },

  /**
   * Update a menu item
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Menu item ID
   * @param {Object} itemData - Menu item data
   * @returns {Promise<Object>} Updated menu item object
   */
  updateMenuItem: async (categoryId, itemId, itemData) => {
    return menuService.updateMenuItem(categoryId, itemId, itemData);
  },

  /**
   * Delete a menu item
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Menu item ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  deleteMenuItem: async (categoryId, itemId) => {
    return menuService.deleteMenuItem(categoryId, itemId);
  },

  /**
   * Move a menu item to a different category
   * @param {string} fromCategoryId - Source category ID
   * @param {string} toCategoryId - Target category ID
   * @param {string} itemId - Menu item ID
   * @returns {Promise<Object>} Moved menu item object
   */
  moveMenuItem: async (fromCategoryId, toCategoryId, itemId) => {
    return menuService.moveMenuItem(fromCategoryId, toCategoryId, itemId);
  },
};

export default Menu;