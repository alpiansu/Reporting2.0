/**
 * User module index
 */
const UserController = require('./user.controller');
const userRoutes = require('./user.routes');
const UserService = require('./user.service');

module.exports = {
  UserController,
  userRoutes,
  UserService,
  initialize: (app) => {
    // Initialize services
    const userService = new UserService();
    
    // Register routes
    app.use('/api/users', userRoutes);
    
    return {
      userService
    };
  }
};