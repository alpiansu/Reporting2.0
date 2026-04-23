import routes from "./buat_rmb.routes.js";
import histBuatRmbStagingService from "./hist_buat_rmb_staging.service.js";
import logger from "../../config/logger.js";

export default {
  routes,
  initialize: (app) => {
    // Register routes
    app.use("/api/buat-rmb", routes);
    
    // Initialize staging service
    histBuatRmbStagingService.initialize().catch(err => {
      logger.error(`Failed to initialize buat_rmb staging service: ${err.message}`);
    });

    return {
      routes,
      service: histBuatRmbStagingService
    };
  }
};
