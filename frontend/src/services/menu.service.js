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
   * Delete a menu (admin only)
   * @param {string} id - Menu ID
   * @returns {Promise} - Response with success message
   */
  deleteMenu: async (id) => {
    const response = await api.delete(`/menu-manager/${id}`);
    return response.data;
  }
};

export default menuService;