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
} from './rekon_wt_harian.controller.js';
import rekonWtHarianRoutes from './rekon_wt_harian.routes.js';
import RekonWtHarianService from './rekon_wt_harian.service.js';
import ProgressService from './progress.service.js';

const RekonWtHarianController = {
  cleanupTempFiles,
  startReconciliation,
  getResults,
  getSummary,
  deleteResults,
  getProgress,
  getLatestProgress,
};

export default {
  RekonWtHarianController,
  rekonWtHarianRoutes,
  RekonWtHarianService,
  ProgressService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-wt-harian", rekonWtHarianRoutes);

    // Initialize progress service
    ProgressService.initialize();

    // Initialize services
    const progressService = ProgressService; // Already a singleton instance

    return {
      rekonWtHarianService: RekonWtHarianService,
      progressService
    };
  },
};
