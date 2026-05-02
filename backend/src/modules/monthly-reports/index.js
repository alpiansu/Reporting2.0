/**
 * Monthly Reports Module — Entry Point
 *
 * Mengikuti pola module lain (ceklist-prep-closing, buat_rmb, dll.)
 * Daftarkan route ke Express app via fungsi initialize().
 */

import monthlyReportsRoutes from "./monthly_reports.routes.js";
import * as monthlyReportsController from "./monthly_reports.controller.js";
import * as configLoaderService from "./services/config_loader.service.js";
import { executeReport } from "./services/wrc_executor.service.js";
import { exportToResponse } from "./services/excel_export.service.js";

export default {
  monthlyReportsRoutes,
  monthlyReportsController,
  configLoaderService,
  executeReport,
  exportToResponse,

  initialize: app => {
    app.use("/api/monthly-reports", monthlyReportsRoutes);
    return {
      monthlyReportsController,
      configLoaderService,
    };
  },
};
