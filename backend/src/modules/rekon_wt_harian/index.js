/**
 * Rekon WT Harian module index
 */
const RekonWtHarianController = require("./rekon_wt_harian.controller");
const rekonWtHarianRoutes = require("./rekon_wt_harian.routes");
const RekonWtHarianService = require("./rekon_wt_harian.service");
const RekonProgressService = require("./rekon_progress.service");
const RekonWtHarianProgressService = require("./rekon_wt_harian_progress.service");
const RekonWebSocketService = require("./rekon_websocket.service");

module.exports = {
  RekonWtHarianController,
  rekonWtHarianRoutes,
  RekonWtHarianService,
  RekonProgressService,
  RekonWtHarianProgressService,
  RekonWebSocketService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-wt-harian", rekonWtHarianRoutes);

    // Initialize services
    const rekonProgressService = RekonProgressService; // Already a singleton instance
    const rekonWtHarianProgressService = RekonWtHarianProgressService; // Already a singleton instance

    return {
      rekonWtHarianService: RekonWtHarianService,
      rekonProgressService,
      rekonWtHarianProgressService
    };
  },
};
