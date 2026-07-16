import routes from "./jenis-retur.routes.js";
import jenisReturService from "./jenis-retur.service.js";

export default {
  routes,
  service: jenisReturService,
  initialize: (app) => {
    app.use("/api/jenis-retur", routes);
    return { service: jenisReturService };
  },
};
