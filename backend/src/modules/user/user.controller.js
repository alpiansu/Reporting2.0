const UserService = require('./user.service');
const logger = require('../../config/logger');

const userService = new UserService();

/**
 * Controller for handling user management related requests
 */
class UserController {
  /**
   * Get all users
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error(`Get all users error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get user by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getUserById(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      const user = await userService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna tidak ditemukan'
        });
      }
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error(`Get user by ID error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Create a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createUser(req, res, next) {
    try {
      const userData = req.body;
      
      // Validate required fields
      if (!userData.username || !userData.password || !userData.email) {
        return res.status(400).json({
          success: false,
          message: 'Username, password, dan email diperlukan'
        });
      }
      
      const newUser = await userService.createUser(userData);
      
      res.status(201).json({
        success: true,
        message: 'Pengguna berhasil dibuat',
        data: newUser
      });
    } catch (error) {
      logger.error(`Create user error: ${error.message}`);
      
      if (error.message === 'Username already exists') {
        return res.status(409).json({
          success: false,
          message: 'Username sudah digunakan'
        });
      }
      
      next(error);
    }
  }

  /**
   * Update an existing user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateUser(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      const userData = req.body;
      
      const updatedUser = await userService.updateUser(userId, userData);
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna tidak ditemukan'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Pengguna berhasil diperbarui',
        data: updatedUser
      });
    } catch (error) {
      logger.error(`Update user error: ${error.message}`);
      
      if (error.message === 'Username already exists') {
        return res.status(409).json({
          success: false,
          message: 'Username sudah digunakan'
        });
      }
      
      next(error);
    }
  }

  /**
   * Delete a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteUser(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // Prevent deleting own account
      if (req.user.id === userId) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak dapat menghapus akun Anda sendiri'
        });
      }
      
      const result = await userService.deleteUser(userId);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna tidak ditemukan'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Pengguna berhasil dihapus'
      });
    } catch (error) {
      logger.error(`Delete user error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Reset user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async resetPassword(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // Generate a random password or use a default one
      const newPassword = Math.random().toString(36).slice(-8);
      
      const result = await userService.updateUser(userId, { password: newPassword });
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Pengguna tidak ditemukan'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Password berhasil direset',
        data: { newPassword }
      });
    } catch (error) {
      logger.error(`Reset password error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Clean up test data, keeping only the admin user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async cleanupTestData(req, res, next) {
    try {
      // Only allow admin to perform this action
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'Hanya admin yang dapat membersihkan data pengujian' 
        });
      }

      const result = await userService.cleanupTestData();
      
      res.status(200).json({ 
        success: true, 
        message: 'Data pengujian berhasil dibersihkan', 
        data: { usersRemoved: result.usersRemoved } 
      });
    } catch (error) {
      logger.error(`Cleanup test data error: ${error.message}`);
      next(error);
    }
  }
}

// Export the class
module.exports = UserController;