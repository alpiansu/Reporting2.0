/**
 * Rekon WT Harian module index
 */
const RekonWtHarianController = require("./rekon_wt_harian.controller");
const rekonWtHarianRoutes = require("./rekon_wt_harian.routes");
const RekonWtHarianService = require("./rekon_wt_harian.service");

module.exports = {
  RekonWtHarianController,
  rekonWtHarianRoutes,
  RekonWtHarianService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-wt-harian", rekonWtHarianRoutes);

    return {
      rekonWtHarianService: RekonWtHarianService,
    };
  },
};
