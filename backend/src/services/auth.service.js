const { User } = require('../models');
const { jwt } = require('../config');
const logger = require('../config/logger');
const userActivityService = require('./userActivity.service');

/**
 * Service for handling authentication related operations
 */
class AuthService {
  /**
   * Logout user
   * @param {number} userId - User ID
   * @param {Object} requestInfo - Request information for activity logging
   * @param {string} requestInfo.ipAddress - IP address
   * @param {string} requestInfo.userAgent - User agent
   * @returns {boolean} - True if logout successful
   */
  async logout(userId, requestInfo = {}) {
    try {
      // Log logout activity
      if (userId) {
        await userActivityService.logActivity({
          userId,
          type: 'logout',
          description: 'Logged out from the system',
          ipAddress: requestInfo.ipAddress || null,
          userAgent: requestInfo.userAgent || null,
          location: null,
        });
      }
      
      // In a stateless JWT auth system, logout is handled client-side
      // by removing the token from storage
      return true;
    } catch (error) {
      logger.error(`Error logging logout activity: ${error.message}`);
      // Still return true since the actual logout is client-side
      return true;
    }
  }
  
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
      
      // Log login activity
      await userActivityService.logActivity({
        userId: user.id,
        type: 'login',
        description: 'Logged in to the system',
        ipAddress: null, // In a real app, this would come from the request
        userAgent: null, // In a real app, this would come from the request
        location: null, // In a real app, this would be determined from IP
      });
      
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
      
      // Log registration activity
      await userActivityService.logActivity({
        userId: user.id,
        type: 'register',
        description: 'Created new account',
        ipAddress: null, // In a real app, this would come from the request
        userAgent: null, // In a real app, this would come from the request
        location: null, // In a real app, this would be determined from IP
      });
      
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
      
      // Log password change activity
      await userActivityService.logActivity({
        userId: user.id,
        type: 'password',
        description: 'Changed account password',
        ipAddress: null, // In a real app, this would come from the request
        userAgent: null, // In a real app, this would come from the request
        location: null, // In a real app, this would be determined from IP
      });
      
      logger.info(`Password changed for user ${user.username}`);
      
      return true;
    } catch (error) {
      logger.error(`Change password failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {Object} profileData - Profile data to update
   * @param {string} [profileData.fullName] - User's full name
   * @param {string} [profileData.email] - User's email
   * @param {string} [profileData.profileImage] - User's profile image path
   * @returns {Object} Updated user data
   */
  async updateProfile(userId, profileData) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update allowed fields
      const allowedFields = ['fullName', 'email', 'profileImage'];
      let updated = false;
      
      for (const field of allowedFields) {
        if (profileData[field] !== undefined && user[field] !== profileData[field]) {
          user[field] = profileData[field];
          updated = true;
        }
      }
      
      if (updated) {
        await user.save();
        
        // Log profile update activity
        await userActivityService.logActivity({
          userId: user.id,
          type: 'profile',
          description: 'Updated profile information',
          ipAddress: null, // In a real app, this would come from the request
          userAgent: null, // In a real app, this would come from the request
          location: null, // In a real app, this would be determined from IP
        });
        
        logger.info(`Profile updated for user ${user.username}`);
      }
      
      // Return user data without password
      const userData = user.toJSON();
      delete userData.password;
      
      return userData;
    } catch (error) {
      logger.error(`Update profile failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthService();