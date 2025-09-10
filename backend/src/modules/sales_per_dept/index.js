/**
 * SalesPerDept module index
 */
import {
  syncSalesPerDept,
  getSalesPerDept,
  compareSalesPerDept,
} from './sales_per_dept.controller.js';
import salesPerDeptRoutes from './sales_per_dept.routes.js';
import SalesPerDeptService from './sales_per_dept.service.js';
import ExternalDbService from './external-db.service.js';

const SalesPerDeptController = {
  syncSalesPerDept,
  getSalesPerDept,
  compareSalesPerDept,
};

export default {
  SalesPerDeptController,
  salesPerDeptRoutes,
  SalesPerDeptService,
  ExternalDbService,
  // Export a function to initialize the module
  init: async () => {
    // Any initialization that needs to happen at startup
    return true;
  },
  // Initialize function for use with app.js
  initialize: (app) => {
    // Initialize services
    const salesPerDeptService = new SalesPerDeptService();
    const externalDbService = new ExternalDbService();
    
    // Register routes
    app.use("/api/sales-per-dept", salesPerDeptRoutes);

    return {
      salesPerDeptService,
      externalDbService
    };
  }
};
