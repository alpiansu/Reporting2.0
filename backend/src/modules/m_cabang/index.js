/**
 * MCabang module index
 */
import {
  getAllCabang,
  getCabangByCode,
  createCabang,
  updateCabang,
  deleteCabang,
} from './m_cabang.controller.js';
import mCabangRoutes from './m_cabang.routes.js';
import MCabangService from './m_cabang.service.js';

const MCabangController = {
  getAllCabang,
  getCabangByCode,
  createCabang,
  updateCabang,
  deleteCabang,
};

export default {
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