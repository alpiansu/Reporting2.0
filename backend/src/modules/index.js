/**
 * Modules index file
 * Exports all modules and provides initialization function
 */

const authModule = require('./auth');
const storeModule = require('./store');
const syncModule = require('./sync');
const userActivityModule = require('./userActivity');
const screeningModule = require('./screening');
const salesPerDeptModule = require('./sales_per_dept');
const mDeptModule = require('./m_dept');
const rekonWtHarianModule = require('./rekon_wt_harian');
const mCabangModule = require('./m_cabang');

module.exports = {
  // Export all modules
  authModule,
  storeModule,
  syncModule,
  userActivityModule,
  screeningModule,
  salesPerDeptModule,
  mDeptModule,
  rekonWtHarianModule,
  mCabangModule,
  
  // Initialize all modules
  initialize: (app) => {
    // Initialize each module
    const auth = authModule.initialize(app);
    const store = storeModule.initialize(app);
    const sync = syncModule.initialize(app);
    const userActivity = userActivityModule.initialize(app);
    const screening = screeningModule.initialize(app);
    const salesPerDept = salesPerDeptModule.initialize(app);
    const mDept = mDeptModule.initialize(app);
    const rekonWtHarian = rekonWtHarianModule.initialize(app);
    const mCabang = mCabangModule.initialize(app);
    
    return {
      auth,
      store,
      sync,
      userActivity,
      screening,
      salesPerDept,
      mDept,
      rekonWtHarian,
      mCabang
    };
  }
};