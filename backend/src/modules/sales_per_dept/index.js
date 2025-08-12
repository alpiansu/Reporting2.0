/**
 * SalesPerDept module index
 */
const SalesPerDeptController = require("./sales_per_dept.controller");
const salesPerDeptRoutes = require("./sales_per_dept.routes");
const SalesPerDeptService = require("./sales_per_dept.service");
const ExternalDbService = require("./external-db.service");

module.exports = {
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
