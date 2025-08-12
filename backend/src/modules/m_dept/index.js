/**
 * MDept module index
 */
const MDeptController = require("./m_dept.controller");
const mDeptRoutes = require("./m_dept.routes");
const MDeptService = require("./m_dept.service");

module.exports = {
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