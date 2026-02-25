import routes from "./rekon_persediaan.routes.js";
import service from "./rekon_persediaan.service.js";

export default {
  routes,
  initialize: app => {
    app.use("/api/rekon-persediaan", routes);
    // Initialize service (lazy loading is handled internally but we can call ensureDataLoaded)
    service.ensureDataLoaded().catch(err => {
        console.error("Failed to initialize RekonPersediaan service data:", err.message);
    });
    return true;
  },
};
