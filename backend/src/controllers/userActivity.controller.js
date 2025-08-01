const { userActivityService } = require('../services');
const logger = require('../config/logger');

/**
 * Controller for handling user activity related requests
 */
class UserActivityController {
  /**
   * Get user activities
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getUserActivities(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, offset, startDate, endDate } = req.query;
      
      // Parse query parameters
      const options = {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        startDate,
        endDate,
      };
      
      const result = await userActivityService.getUserActivities(userId, options);
      
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Get user activities error: ${error.message}`);
      next(error);
    }
  }
  
  /**
   * Log a user activity (for testing purposes)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async logActivity(req, res, next) {
    try {
      const userId = req.user.id;
      const { type, description, metadata } = req.body;
      
      if (!type || !description) {
        return res.status(400).json({ message: 'Activity type and description are required' });
      }
      
      // Get IP and user agent from request
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      // Create activity data
      const activityData = {
        userId,
        type,
        description,
        ipAddress,
        userAgent,
        metadata,
      };
      
      const activity = await userActivityService.logActivity(activityData);
      
      res.status(201).json(activity);
    } catch (error) {
      logger.error(`Log activity error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new UserActivityController();