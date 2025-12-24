import api from "./api";

class UserService {
  /**
   * Get all users
   * @returns {Promise<Object>} API response with users data
   */
  async getAllUsers() {
    try {
      const response = await api.get("/users");
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Search users by username
   * @param {string} query - Search query
   * @returns {Promise<Object>} API response with filtered users data
   */
  async searchUsers(query) {
    try {
      const response = await api.get(`/users/search?q=${query}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search users: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object>} API response with user data
   */
  async getUserById(id) {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data to create
   * @returns {Promise<Object>} API response with created user data
   */
  async createUser(userData) {
    try {
      const response = await api.post("/users", userData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Update an existing user
   * @param {number} id - User ID
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} API response with updated user data
   */
  async updateUser(id, userData) {
    try {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete a user
   * @param {number} id - User ID
   * @returns {Promise<Object>} API response
   */
  async deleteUser(id) {
    try {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Reset user password
   * @param {number} id - User ID
   * @returns {Promise<Object>} API response with new password
   */
  async resetPassword(id) {
    try {
      const response = await api.post(`/users/${id}/reset-password`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to reset password: ${error.response?.data?.message || error.message}`);
    }
  }
}

export default new UserService();
