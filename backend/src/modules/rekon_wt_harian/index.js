/**
 * Rekon WT Harian module index
 */
import {
  cleanupTempFiles,
  startReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
  getDailyShopSummary,
} from './rekon_wt_harian.controller.js';
import rekonWtHarianRoutes from './rekon_wt_harian.routes.js';
import RekonWtHarianService from './rekon_wt_harian.service.js';
const RekonWtHarianController = {
  cleanupTempFiles,
  startReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
  getDailyShopSummary,
};

export default {
  RekonWtHarianController,
  rekonWtHarianRoutes,
  RekonWtHarianService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-wt-harian", rekonWtHarianRoutes);

    return {
      rekonWtHarianService: RekonWtHarianService
    };
  },
};
