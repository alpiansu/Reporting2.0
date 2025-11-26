/**
 * Prep Closing (Screening Pra Closing) module index
 */
import {
  screeningByCabang,
  getSummary,
  getRulesSummary,
  getResumeByKdtk,
  getStoreDetails,
  getIssuesByCategory,
  updateNote,
} from "./prep_closing.controller.js";
import prepClosingRoutes from "./prep_closing.routes.js";
import PrepClosingService from "./prep_closing.service.js";

const PrepClosingController = {
  screeningByCabang,
  getSummary,
  getRulesSummary,
  getResumeByKdtk,
  getStoreDetails,
  getIssuesByCategory,
  updateNote,
};

export default {
  PrepClosingController,
  prepClosingRoutes,
  PrepClosingService,
  initialize: app => {
    // Register routes
    app.use("/api/prep-closing", prepClosingRoutes);

    return {
      prepClosingService: PrepClosingService,
    };
  },
};
