/**
 * Device config module index
 */
import deviceConfigRoutes from "./device-config.routes.js";
import DeviceConfigService from "./device-config.service.js";

export default {
  deviceConfigRoutes,
  DeviceConfigService,
  initialize: (app) => {
    app.use("/api/device-config", deviceConfigRoutes);
    return { deviceConfigRoutes };
  },
};