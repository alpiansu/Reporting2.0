/**
 * RekapRemote module index
 */
const RekapRemoteController = require("./rekap_remote.controller");
const rekapRemoteRoutes = require("./rekap_remote.routes");
const rekapRemoteService = require("./rekap_remote.service");

module.exports = {
  RekapRemoteController,
  rekapRemoteRoutes,
  rekapRemoteService,
  // Export a function to initialize the module
  init: async () => {
    // Any initialization that needs to happen at startup
    return true;
  },
  // Initialize function for use with app.js
  initialize: (app) => {
    // Register routes
    app.use("/api/rekap-remote", rekapRemoteRoutes);
    return {
      routes: rekapRemoteRoutes,
      service: rekapRemoteService,
    };
  },
};