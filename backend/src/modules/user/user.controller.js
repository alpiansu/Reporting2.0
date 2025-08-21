const UserService = require('./user.service');
const logger = require('../../config/logger');

const userService = new UserService();

/**
 * Controller for handling user management related requests
 */
class UserController {
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