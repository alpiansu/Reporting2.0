/**
 * Auth module index
 */
import AuthController from './auth.controller.js';
import authRoutes from './auth.routes.js';
import AuthService from './auth.service.js';

export default {
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