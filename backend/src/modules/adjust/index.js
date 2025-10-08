/**
 * Adjust module index
 */
import * as adjustController from "./adjust.controller.js";
import adjustRoutes from "./adjust.routes.js";
import adjustService from "./adjust.service.js";

export default {
  adjustController,
  adjustRoutes,
  adjustService,
  initialize: app => {
    // Register routes with /api/adjust prefix
    app.use("/api/adjust", adjustRoutes);

    return {
      adjustService,
    };
  },
};
