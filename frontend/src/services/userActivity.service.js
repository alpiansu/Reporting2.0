import api from './api';

/**
 * Service for handling user activity related API calls
 */
const userActivityService = {
  /**
   * Get user activities with pagination and filtering
   * @param {Object} options - Options for filtering and pagination
   * @param {number} options.limit - Maximum number of activities to return
   * @param {number} options.offset - Number of activities to skip
   * @param {string} options.type - Filter by activity type
   * @param {string} options.startDate - Filter by start date (ISO string)
   * @param {string} options.endDate - Filter by end date (ISO string)
   * @returns {Promise<Object>} - Promise resolving to activities data
   */
  async getUserActivities(options = {}) {
    try {
      const response = await api.get('/user-activities', { params: options });
      return response.data;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw error;
    }
  },
  
  /**
   * Log a user activity (for testing purposes)
   * @param {Object} activityData - Activity data
   * @param {string} activityData.type - Activity type
   * @param {string} activityData.description - Activity description
   * @param {Object} activityData.metadata - Additional metadata
   * @returns {Promise<Object>} - Promise resolving to created activity
   */
  async logActivity(activityData) {
    try {
      const response = await api.post('/user-activities', activityData);
      return response.data;
    } catch (error) {
      console.error('Error logging user activity:', error);
      throw error;
    }
  },
};

export default userActivityService;