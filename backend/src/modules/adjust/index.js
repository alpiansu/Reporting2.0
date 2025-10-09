/**
 * Adjust module index
 */
import * as adjustController from "./adjust.controller.js";
import adjustRoutes from "./adjust.routes.js";
import adjustService from "./adjust.service.js";
import histAdjustStagingService from "./hist_adjust_staging.service.js";

export default {
  adjustController,
  adjustRoutes,
  adjustService,
  histAdjustStagingService,
  initialize: app => {
    // Initialize history staging service asynchronously but don't await
    histAdjustStagingService.initialize().catch(error => {
      console.error("Failed to initialize hist adjust staging service:", error);
    });

    // Register routes with /api/adjust prefix
    app.use("/api/adjust", adjustRoutes);

    return {
      adjustService,
      histAdjustStagingService,
    };
  },
};
