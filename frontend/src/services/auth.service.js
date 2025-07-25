import api from './api';

/**
 * Authentication service for handling user auth operations
 */
const authService = {
  /**
   * Login user
   * @param {Object} credentials - User credentials
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @returns {Promise} - Response with user data and tokens
   */
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    // Backend mengembalikan data langsung tanpa wrapper success dan data
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    // Simpan refreshToken jika ada
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  },

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise} - Response with user data and tokens
   */
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    // Backend mengembalikan data langsung tanpa wrapper success dan data
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    // Simpan refreshToken jika ada
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  },

  /**
   * Logout user
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  /**
   * Get current user profile
   * @returns {Promise} - Response with user profile data
   */
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  /**
   * Change user password
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise} - Response with success message
   */
  changePassword: async (passwordData) => {
    const response = await api.put('/auth/change-password', passwordData);
    return response.data;
  },

  /**
   * Refresh authentication token
   * @returns {Promise} - Response with new token
   */
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh-token', { refreshToken });
    // Backend mengembalikan data langsung tanpa wrapper success dan data
    const { token } = response.data;
    localStorage.setItem('token', token);
    return response.data;
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} - True if authenticated
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  /**
   * Get current user data
   * @returns {Object|null} - User data or null
   */
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
};

export default authService;