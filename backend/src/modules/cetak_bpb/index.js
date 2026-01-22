/**
 * Cetak BPB module entry point
 */
import routes from "./cetak_bpb.routes.js";
import cetakBpbService from "./cetak_bpb.service.js";

export default {
  routes,
  service: cetakBpbService,
  initialize: (app) => {
    app.use("/api/cetak-bpb", routes);
    return { service: cetakBpbService };
  }
};
