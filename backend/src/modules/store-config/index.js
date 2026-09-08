/**
 * Store Config module index
 */
import storeConfigRoutes from "./store-config.routes.js";
import StoreConfigService from "./store-config.service.js";

export default {
  StoreConfigService,
  storeConfigRoutes,
  initialize: (app) => {
    // Register routes
    app.use("/api/store-config", storeConfigRoutes);

    return {
      storeConfigService: new StoreConfigService(),
    };
  },
};
