/**
 * MCabang module index
 */
const MCabangController = require("./m_cabang.controller");
const mCabangRoutes = require("./m_cabang.routes");
const MCabangService = require("./m_cabang.service");

module.exports = {
  MCabangController,
  mCabangRoutes,
  MCabangService,
  // Export a function to initialize the module
  init: async () => {
    // Initialize cabang data at startup
    const mCabangService = new MCabangService();
    await mCabangService.initCabangData();
    return true;
  },
  // Initialize function for use with app.js
  initialize: (app) => {
    // Register routes
    app.use("/api/m-cabang", mCabangRoutes);
    return {
      routes: mCabangRoutes,
    };
  },
};