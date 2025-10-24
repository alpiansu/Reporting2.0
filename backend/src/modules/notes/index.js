/**
 * Notes module index
 */
import routes from "./notes.routes.js";
import service from "./notes.service.js";

export default {
  routes,
  service,
  initialize: app => {
    app.use("/api/notes", routes);
    return { service };
  },
};
