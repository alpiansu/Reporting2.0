/**
 * RekapRemote module index
 */
import { getRekapData, getSummary, saveLogsManually, clearLogs, getLastMassScan } from "./rekap_remote.controller.js";
import rekapRemoteRoutes from "./rekap_remote.routes.js";
import rekapRemoteService from "./rekap_remote.service.js";

const RekapRemoteController = {
  getRekapData,
  getSummary,
  saveLogsManually,
  clearLogs,
  getLastMassScan,
};

export default {
  RekapRemoteController,
  rekapRemoteRoutes,
  rekapRemoteService,
  // Export a function to initialize the module
  init: async () => {
    // Any initialization that needs to happen at startup
    return true;
  },
  // Initialize function for use with app.js
  initialize: app => {
    // Register routes
    app.use("/api/rekap-remote", rekapRemoteRoutes);
    return {
      routes: rekapRemoteRoutes,
      service: rekapRemoteService,
    };
  },
};
