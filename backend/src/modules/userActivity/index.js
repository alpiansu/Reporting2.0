/**
 * UserActivity module index
 */
const UserActivityController = require('./userActivity.controller');
const userActivityRoutes = require('./userActivity.routes');
const UserActivityService = require('./userActivity.service');

module.exports = {
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