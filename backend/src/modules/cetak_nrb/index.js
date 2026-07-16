import routes from "./cetak_nrb.routes.js";
import cetakNrbService from "./cetak_nrb.service.js";

export default {
  routes,
  service: cetakNrbService,
  initialize: (app) => {
    app.use("/api/cetak-nrb", routes);
    return { service: cetakNrbService };
  },
};
