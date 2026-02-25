import dashboardRoutes from "./dashboard.routes.js";

export default {
  initialize: (app) => {
    app.use("/api/dashboard", dashboardRoutes);
    return true;
  }
};
