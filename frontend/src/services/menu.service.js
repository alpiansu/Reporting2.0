import api from './api';

/**
 * Menu service for handling menu operations
 */
const menuService = {
  /**
   * Get menus for current user
   * @returns {Promise} - Response with menu data
   */
  getMenusForCurrentUser: async () => {
    const response = await api.get('/menu-manager/user/current');
    return response.data;
  },

  /**
   * Get all menus (admin only)
   * @returns {Promise} - Response with all menu data
   */
  getAllMenus: async () => {
    const response = await api.get('/menu-manager');
    return response.data;
  },

  /**
   * Get menu by ID (admin only)
   * @param {string} id - Menu ID
   * @returns {Promise} - Response with menu data
   */
  getMenuById: async (id) => {
    const response = await api.get(`/menu-manager/${id}`);
    return response.data;
  },

  /**
   * Get menus by role (admin only)
   * @param {string} role - User role
   * @returns {Promise} - Response with menu data
   */
  getMenusByRole: async (role) => {
    const response = await api.get(`/menu-manager/role/${role}`);
    return response.data;
  },

  /**
   * Create a new menu (admin only)
   * @param {Object} menuData - Menu data
   * @returns {Promise} - Response with created menu
   */
  createMenu: async (menuData) => {
    const response = await api.post('/menu-manager', menuData);
    return response.data;
  },

  /**
   * Update an existing menu (admin only)
   * @param {string} id - Menu ID
   * @param {Object} menuData - Menu data
   * @returns {Promise} - Response with updated menu
   */
  updateMenu: async (id, menuData) => {
    const response = await api.put(`/menu-manager/${id}`, menuData);
    return response.data;
  },

  /**
   * Delete an existing menu (admin only)
   * @param {string} id - Menu ID
   * @returns {Promise} - Response with deletion status
   */
  deleteMenu: async (id) => {
    const response = await api.delete(`/menu-manager/${id}`);
    return response.data;
  },

  // ===== CATEGORY OPERATIONS =====

  /**
   * Create a new category (admin only)
   * @param {Object} categoryData - Category data
   * @returns {Promise} - Response with created category
   */
  createCategory: async (categoryData) => {
    const response = await api.post('/menu-manager/categories', categoryData);
    return response.data;
  },

  /**
   * Update an existing category (admin only)
   * @param {string} id - Category ID
   * @param {Object} categoryData - Category data
   * @returns {Promise} - Response with updated category
   */
  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/menu-manager/categories/${id}`, categoryData);
    return response.data;
  },

  /**
   * Delete a category (admin only)
   * @param {string} id - Category ID
   * @returns {Promise} - Response with deletion status
   */
  deleteCategory: async (id) => {
    const response = await api.delete(`/menu-manager/categories/${id}`);
    return response.data;
  },

  // ===== MENU ITEM OPERATIONS =====

  /**
   * Add a menu item to a category (admin only)
   * @param {string} categoryId - Category ID
   * @param {Object} itemData - Menu item data
   * @returns {Promise} - Response with created menu item
   */
  addMenuItem: async (categoryId, itemData) => {
    const response = await api.post(`/menu-manager/categories/${categoryId}/items`, itemData);
    return response.data;
  },

  /**
   * Update a menu item (admin only)
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Menu item ID
   * @param {Object} itemData - Menu item data
   * @returns {Promise} - Response with updated menu item
   */
  updateMenuItem: async (categoryId, itemId, itemData) => {
    const response = await api.put(`/menu-manager/categories/${categoryId}/items/${itemId}`, itemData);
    return response.data;
  },

  /**
   * Delete a menu item (admin only)
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Menu item ID
   * @returns {Promise} - Response with deletion status
   */
  deleteMenuItem: async (categoryId, itemId) => {
    const response = await api.delete(`/menu-manager/categories/${categoryId}/items/${itemId}`);
    return response.data;
  },

  /**
   * Move a menu item to a different category (admin only)
   * @param {string} fromCategoryId - Source category ID
   * @param {string} toCategoryId - Target category ID
   * @param {string} itemId - Menu item ID
   * @returns {Promise} - Response with moved menu item
   */
  moveMenuItem: async (fromCategoryId, toCategoryId, itemId) => {
    const response = await api.post(`/menu-manager/categories/${fromCategoryId}/items/${itemId}/move/${toCategoryId}`);
    return response.data;
  },
};

export default menuService;