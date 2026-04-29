/**
 * Ceklist Prep Closing module entry point
 */
import {
  getSpaceHdd,
  upsertSpaceHdd,
  deleteSpaceHdd,
  getSpaceTampung,
  upsertSpaceTampung,
  deleteSpaceTampung,
  getImportIdt,
  upsertImportIdt,
  deleteImportIdt,
  uploadCaptureIdt,
  initImportIdt,
  getRekapScreening,
  exportExcel,
  getSummary,
} from "./ceklist_prep_closing.controller.js";
import ceklistPrepClosingRoutes from "./ceklist_prep_closing.routes.js";
import CeklistPrepClosingService from "./ceklist_prep_closing.service.js";

const CeklistPrepClosingController = {
  getSpaceHdd,
  upsertSpaceHdd,
  deleteSpaceHdd,
  getSpaceTampung,
  upsertSpaceTampung,
  deleteSpaceTampung,
  getImportIdt,
  upsertImportIdt,
  deleteImportIdt,
  uploadCaptureIdt,
  initImportIdt,
  getRekapScreening,
  exportExcel,
  getSummary,
};


export default {
  CeklistPrepClosingController,
  ceklistPrepClosingRoutes,
  CeklistPrepClosingService,
  initialize: app => {
    app.use("/api/ceklist-prep-closing", ceklistPrepClosingRoutes);
    return {
      ceklistPrepClosingService: CeklistPrepClosingService,
    };
  },
};
