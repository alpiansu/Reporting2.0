/**
 * Modules index file
 * Exports all modules and provides initialization function
 */

import authModule from "./auth/index.js";
import storeModule from "./store/index.js";
import syncModule from "./sync/index.js";
import userActivityModule from "./user-activity/index.js";
import salesPerDeptModule from "./sales_per_dept/index.js";
import mDeptModule from "./m_dept/index.js";
import rekonWtHarianModule from "./rekon_wt_harian/index.js";
import mCabangModule from "./m_cabang/index.js";
import userModule from "./user/index.js";
import menuManagerModule from "./menu-manager/index.js";
import rekapRemoteModule from "./rekap_remote/index.js";
import prepClosingModule from "./prep-closing/index.js";
import adjustModule from "./adjust/index.js";
import rekonVirtualMrgModule from "./rekon_virtual_mrg/index.js";
import progressModule from "./progress/index.js";
import progress from "./progress/index.js";

export default {
  // Export all modules
  authModule,
  storeModule,
  syncModule,
  userActivityModule,
  salesPerDeptModule,
  mDeptModule,
  rekonWtHarianModule,
  mCabangModule,
  userModule,
  menuManagerModule,
  rekapRemoteModule,
  prepClosingModule,
  adjustModule,
  rekonVirtualMrgModule,
  progressModule,

  // Initialize all modules
  initialize: app => {
    // Initialize each module
    const auth = authModule.initialize(app);
    const store = storeModule.initialize(app);
    const sync = syncModule.initialize(app);
    const userActivity = userActivityModule.initialize(app);
    const salesPerDept = salesPerDeptModule.initialize(app);
    const mDept = mDeptModule.initialize(app);
    const rekonWtHarian = rekonWtHarianModule.initialize(app);
    const mCabang = mCabangModule.initialize(app);
    const user = userModule.initialize(app);
    const rekapRemote = rekapRemoteModule.initialize(app);
    const prepClosing = prepClosingModule.initialize(app);
    const adjust = adjustModule.initialize(app);
    const rekonVirtualMrg = rekonVirtualMrgModule.initialize(app);
    const progress = progressModule.initialize(app);

    // Initialize menu manager module
    app.use("/api/menu-manager", menuManagerModule.routes);

    return {
      auth,
      store,
      sync,
      userActivity,
      salesPerDept,
      mDept,
      rekonWtHarian,
      mCabang,
      user,
      rekapRemote,
      prepClosing,
      adjust,
      rekonVirtualMrg,
      progress,
      menuManager: true,
    };
  },
};
