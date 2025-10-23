/**
 * Note Categories module index
 */
import routes from "./noteCategories.routes.js";
import service from "./noteCategories.service.js";

export default {
  routes,
  service,
  initialize: app => {
    app.use("/api/note-categories", routes);
    return { service };
  },
};
