/**
 * MDept module index
 */
import {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  uploadDepartments,
} from './m_dept.controller.js';
import mDeptRoutes from './m_dept.routes.js';
import MDeptService from './m_dept.service.js';

const MDeptController = {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  uploadDepartments,
};

export default {
  MDeptController,
  mDeptRoutes,
  MDeptService,
  // Export a function to initialize the module
  init: async () => {
    // Any initialization that needs to happen at startup
    return true;
  },
  // Initialize function for use with app.js
  initialize: (app) => {
    // Register routes
    app.use("/api/m-dept", mDeptRoutes);
    return {
      routes: mDeptRoutes,
    };
  },
};