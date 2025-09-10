/**
 * User module index
 */
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  cleanupTestData,
} from './user.controller.js';
import userRoutes from './user.routes.js';
import UserService from './user.service.js';

const UserController = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  cleanupTestData,
};

export default {
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