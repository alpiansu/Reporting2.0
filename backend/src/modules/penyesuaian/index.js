/**
 * Penyesuaian (Sesuai Toko) module index
 */
import { screeningByCabang, getAllRecords, getAll, getRecord, getSummary } from "./penyesuaian.controller.js";
import penyesuaianRoutes from "./penyesuaian.routes.js";
import PenyesuaianService from "./penyesuaian.service.js";

const PenyesuaianController = {
  screeningByCabang,
  getAllRecords,
  getAll,
  getRecord,
  getSummary,
};

export default {
  PenyesuaianController,
  penyesuaianRoutes,
  PenyesuaianService,
  initialize: app => {
    // Register routes
    app.use("/api/penyesuaian", penyesuaianRoutes);

    return {
      penyesuaianService: PenyesuaianService,
    };
  },
};
