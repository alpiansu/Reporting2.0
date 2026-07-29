/**
 * Notifications module index
 */
import routes from "./notifications.routes.js";
import service from "./notifications.service.js";

export default {
  routes,
  service,
  initialize: app => {
    app.use("/api/notifications", routes);
    return { service };
  },
};
