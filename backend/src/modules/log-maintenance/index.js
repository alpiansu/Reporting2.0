import logMaintenanceRoutes from "./log-maintenance.routes.js";
import LogMaintenanceService from "./log-maintenance.service.js";

export default {
  LogMaintenanceService,
  logMaintenanceRoutes,
  initialize: app => {
    app.use("/api/log-maintenance", logMaintenanceRoutes);

    return {
      logMaintenanceService: new LogMaintenanceService(),
    };
  },
};
