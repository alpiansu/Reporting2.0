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
import userService from './user.service.js';

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
  userService,
  initialize: (app) => {
    // Register routes
    app.use('/api/users', userRoutes);
    
    return {
      userService
    };
  }
};