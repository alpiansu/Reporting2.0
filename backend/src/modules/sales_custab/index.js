import * as salesCustabController from "./sales_custab.controller.js";
import salesCustabRoutes from "./sales_custab.routes.js";
import salesCustabService from "./sales_custab.service.js";

export default {
  salesCustabController,
  salesCustabRoutes,
  salesCustabService,

  initialize: app => {
    app.use("/api/sales-custab", salesCustabRoutes);
    return {
      salesCustabService,
      salesCustabController,
    };
  },
};
