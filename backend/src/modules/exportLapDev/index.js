import exportLapDevRoutes from "./exportLapDev.routes.js";
import * as exportLapDevController from "./exportLapDev.controller.js";
import * as exportLapDevService from "./exportLapDev.service.js";

export default {
  exportLapDevRoutes,
  exportLapDevController,
  exportLapDevService,

  initialize: app => {
    app.use("/exportLap", exportLapDevRoutes);
    return {
      exportLapDevController,
      exportLapDevService,
    };
  },
};
