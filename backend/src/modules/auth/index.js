/**
 * Auth module index
 */
const AuthController = require('./auth.controller');
const authRoutes = require('./auth.routes');
const AuthService = require('./auth.service');

module.exports = {
  AuthController,
  authRoutes,
  AuthService,
  initialize: (app) => {
    // Initialize services
    const authService = new AuthService();
    
    // Register routes
    app.use('/api/auth', authRoutes);
    
    return {
      authService
    };
  }
};