const User = require("../../models/user.model");
const logger = require("../../config/logger");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

/**
 * Service for handling user activity tracking
 */
class UserActivityService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data/user-activities.json");
    this.readFileAsync = promisify(fs.readFile);
    this.writeFileAsync = promisify(fs.writeFile);
    this.mkdirAsync = promisify(fs.mkdir);
    this.statAsync = promisify(fs.stat);
    this.readdirAsync = promisify(fs.readdir);

    // Ensure data directory exists
    this.ensureDataDirExists();
  }

  /**
   * Ensure data directory exists
   * @private
   */
  async ensureDataDirExists() {
    try {
      await this.statAsync(this.dataDir);
    } catch (error) {
      if (error.code === "ENOENT") {
        try {
          await this.mkdirAsync(this.dataDir, { recursive: true });
          logger.info(`Created user activities data directory: ${this.dataDir}`);
        } catch (mkdirError) {
          logger.error(`Failed to create data directory: ${mkdirError.message}`);
        }
      } else {
        logger.error(`Error checking data directory: ${error.message}`);
      }
    }
  }

  /**
   * Get user activity file path
   * @param {number} userId - User ID
   * @returns {string} File path
   * @private
   */
  getUserActivityFilePath(userId) {
    return path.join(this.dataDir, `user-${userId}-activities.json`);
  }
  /**
   * Read user activities from JSON file
   * @param {number} userId - User ID
   * @returns {Promise<Array>} User activities
   * @private
   */
  async readUserActivitiesFromFile(userId) {
    const filePath = this.getUserActivityFilePath(userId);
    try {
      const data = await this.readFileAsync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist yet, return empty array
        return [];
      }
      logger.error(`Failed to read user activities file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write user activities to JSON file
   * @param {number} userId - User ID
   * @param {Array} activities - User activities
   * @returns {Promise<void>}
   * @private
   */
  async writeUserActivitiesToFile(userId, activities) {
    const filePath = this.getUserActivityFilePath(userId);
    try {
      await this.writeFileAsync(filePath, JSON.stringify(activities, null, 2), "utf8");
    } catch (error) {
      logger.error(`Failed to write user activities file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log a user activity
   * @param {Object} activityData - Activity data
   * @param {number} activityData.userId - User ID
   * @param {string} activityData.type - Activity type (login, logout, profile, password, security, etc.)
   * @param {string} activityData.description - Activity description
   * @param {string} [activityData.ipAddress] - IP address
   * @param {string} [activityData.userAgent] - User agent
   * @param {string} [activityData.location] - Location
   * @param {Object} [activityData.metadata] - Additional metadata
   * @returns {Promise<Object>} Created activity
   */
  async logActivity(activityData) {
    try {
      // Validate required fields
      if (!activityData.userId || !activityData.type || !activityData.description) {
        throw new Error("Missing required fields for activity logging");
      }

      // Read existing activities
      const activities = await this.readUserActivitiesFromFile(activityData.userId);

      // Create new activity
      const newActivity = {
        id: activities.length > 0 ? Math.max(...activities.map(a => a.id)) + 1 : 1,
        userId: activityData.userId,
        type: activityData.type,
        description: activityData.description,
        ipAddress: activityData.ipAddress || null,
        userAgent: activityData.userAgent || null,
        location: activityData.location || null,
        metadata: activityData.metadata || null,
        createdAt: new Date().toISOString(),
      };

      // Add new activity to array
      activities.push(newActivity);

      // Write back to file
      await this.writeUserActivitiesToFile(activityData.userId, activities);

      logger.info(
        `Activity logged for user ${activityData.userId}: ${activityData.type} - ${activityData.description}`
      );

      return newActivity;
    } catch (error) {
      logger.error(`Failed to log activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user activities
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @param {number} [options.limit=100] - Maximum number of activities to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @param {string} [options.startDate] - Filter by start date and time (ISO string)
   * @param {string} [options.endDate] - Filter by end date and time (ISO string)
   * @returns {Promise<Object>} Activities with pagination info
   */
  async getUserActivities(userId, options = {}) {
    try {
      const { limit = 100, offset = 0, startDate, endDate } = options;

      // Get activities from JSON file
      const allActivities = await this.readUserActivitiesFromFile(userId);

      // Apply filters
      let filteredActivities = allActivities;

      if (startDate) {
        const startDateObj = new Date(startDate);
        filteredActivities = filteredActivities.filter(activity => new Date(activity.createdAt) >= startDateObj);
      }

      if (endDate) {
        const endDateObj = new Date(endDate);
        filteredActivities = filteredActivities.filter(activity => new Date(activity.createdAt) <= endDateObj);
      }

      // Sort by createdAt in descending order
      filteredActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const paginatedActivities = filteredActivities.slice(offset, offset + limit);

      // Get user data for each activity
      const user = await User.findByPk(userId);

      // Add user data to each activity
      const activitiesWithUser = paginatedActivities.map(activity => ({
        ...activity,
        user: user
          ? {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
            }
          : null,
      }));

      return {
        activities: activitiesWithUser,
        pagination: {
          total: filteredActivities.length,
          limit,
          offset,
          hasMore: offset + paginatedActivities.length < filteredActivities.length,
        },
      };
    } catch (error) {
      logger.error(`Failed to get user activities: ${error.message}`);
      throw error;
    }
  }
}

// Export the class
module.exports = UserActivityService;
