/**
 * Ceklist Panduan module entry point
 */
import ceklistPanduanRoutes from "./ceklist_panduan.routes.js";
import ceklistPanduanService from "./ceklist_panduan.service.js";
import { CeklistPanduanWrapper } from "./ceklist_panduan.model.js";

export default {
  ceklistPanduanRoutes,
  ceklistPanduanService,
  CeklistPanduanWrapper,
  initialize: app => {
    app.use("/api/ceklist-panduan", ceklistPanduanRoutes);
    return {
      ceklistPanduanService,
    };
  },
};