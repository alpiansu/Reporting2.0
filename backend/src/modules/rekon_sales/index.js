/**
 * Rekon Sales (Sales Reconciliation) module index
 */
import {
  screeningByCabang,
  getSummary,
  getResumeByKdtk,
  getStoreDetails,
  getDifferences,
  getKodePesananIssues,
  getExportData,
  updateNote,
} from "./rekon_sales.controller.js";
import rekonSalesRoutes from "./rekon_sales.routes.js";
import RekonSalesService from "./rekon_sales.service.js";

const RekonSalesController = {
  screeningByCabang,
  getSummary,
  getResumeByKdtk,
  getStoreDetails,
  getDifferences,
  getKodePesananIssues,
  getExportData,
  updateNote,
};

export default {
  RekonSalesController,
  rekonSalesRoutes,
  RekonSalesService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-sales", rekonSalesRoutes);

    return {
      rekonSalesService: RekonSalesService,
    };
  },
};
