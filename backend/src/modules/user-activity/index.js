/**
 * UserActivity module index
 */
import UserActivityController from './userActivity.controller.js';
import userActivityRoutes from './userActivity.routes.js';
import UserActivityService from './userActivity.service.js';

export default {
  UserActivityController,
  userActivityRoutes,
  UserActivityService,
  initialize: (app) => {
    // Initialize services
    const userActivityService = new UserActivityService();
    
    // Register routes
    app.use('/api/user-activities', userActivityRoutes);
    
    return {
      userActivityService
    };
  }
};