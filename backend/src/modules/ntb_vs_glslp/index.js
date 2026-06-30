import routes from "./ntb_vs_glslp.routes.js";

export default {
  initialize: (app) => {
    app.use("/api/ntb-vs-glslp", routes);
    return true;
  },
};
