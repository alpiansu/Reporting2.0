/**
 * Rekon Virtual MRG module index
 */
import {
  screeningByCabang,
  getAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  insertFromStore,
} from "./rekon_virtual_mrg.controller.js";
import rekonVirtualMrgRoutes from "./rekon_virtual_mrg.routes.js";
import RekonVirtualMrgService from "./rekon_virtual_mrg.service.js";

const RekonVirtualMrgController = {
  screeningByCabang,
  getAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  insertFromStore,
};

export default {
  RekonVirtualMrgController,
  rekonVirtualMrgRoutes,
  RekonVirtualMrgService,
  initialize: app => {
    // Register routes
    app.use("/api/rekon-virtual-mrg", rekonVirtualMrgRoutes);

    return {
      rekonVirtualMrgService: RekonVirtualMrgService,
    };
  },
};
