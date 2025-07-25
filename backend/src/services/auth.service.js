const { User } = require('../models');
const { jwt } = require('../config');
const logger = require('../config/logger');

/**
 * Service for handling authentication related operations
 */
class AuthService {
  /**
   * Login a user with username/email and password
   * @param {string} login - Username or email
   * @param {string} password - User password
   * @returns {Object} User data and token
   */
  async login(login, password) {
    try {
      // Find user by username or email
      const user = await User.findByCredentials(login);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if password is correct
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }
      
      // Update last login timestamp
      user.lastLogin = new Date();
      await user.save();
      
      // Generate JWT token
      const token = jwt.generateToken(user);
      
      // Return user data (excluding password) and token
      const userData = user.toJSON();
      delete userData.password;
      
      logger.info(`User ${user.username} logged in successfully`);
      
      return {
        user: userData,
        token,
      };
    } catch (error) {
      logger.error(`Login failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Register a new user
   * @param {Object} userData - User data
   * @returns {Object} Created user data and token
   */
  async register(userData) {
    try {
      // Create new user
      const user = await User.create(userData);
      
      // Generate JWT token
      const token = jwt.generateToken(user);
      
      // Return user data (excluding password) and token
      const createdUser = user.toJSON();
      delete createdUser.password;
      
      logger.info(`New user registered: ${user.username}`);
      
      return {
        user: createdUser,
        token,
      };
    } catch (error) {
      logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get current user profile
   * @param {number} userId - User ID
   * @returns {Object} User data
   */
  async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error(`Get profile failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Update password
      user.password = newPassword;
      await user.save();
      
      logger.info(`Password changed for user ${user.username}`);
      
      return true;
    } catch (error) {
      logger.error(`Change password failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthService();