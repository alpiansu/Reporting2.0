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
import RekonProgressService from './rekon_progress.service.js';
import RekonWtHarianProgressService from './rekon_wt_harian_progress.service.js';
import RekonWebSocketService from './rekon_websocket.service.js';

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
  RekonProgressService,
  RekonWtHarianProgressService,
  RekonWebSocketService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-wt-harian", rekonWtHarianRoutes);

    // Initialize SSE endpoints
    RekonWebSocketService.initialize(app);

    // Initialize services
    const rekonProgressService = RekonProgressService; // Already a singleton instance
    const rekonWtHarianProgressService = RekonWtHarianProgressService; // Already a singleton instance

    return {
      rekonWtHarianService: RekonWtHarianService,
      rekonProgressService,
      rekonWtHarianProgressService,
      rekonWebSocketService: RekonWebSocketService
    };
  },
};
