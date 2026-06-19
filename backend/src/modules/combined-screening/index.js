/**
 * Combined Screening Module Index
 */
import combinedScreeningRoutes from "./combined_screening.routes.js";
import combinedScreeningService from "./combined_screening.service.js";

export default {
  combinedScreeningService,
  combinedScreeningRoutes,
  initialize: app => {
    // Register routes
    app.use("/api/combined-screening", combinedScreeningRoutes);

    return {
      combinedScreeningService,
    };
  },
};
