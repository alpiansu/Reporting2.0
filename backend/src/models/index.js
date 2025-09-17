import config from '../config/index.js';
const { resilientDb } = config;
import User from './user.model.js';
import Store from './store.model.js';
import SalesPerDept from './sales_per_dept.model.js';
import MDept from './m_dept.model.js';
import RekonWtHarian from './rekon_wt_harian.model.js';
import RekapRemote from './rekap_remote.model.js';

// Define relationships between models
// Note: Store is now a JSON-based model, so Sequelize relationships don't apply to it

// Note: Store relationships are now handled manually in the service layer
// since Store is no longer a Sequelize model

// Export models
export default {
  getDatabase: () => resilientDb.getDatabase(),
  closeDatabase: () => resilientDb.close(),
  User,
  Store,
  SalesPerDept,
  MDept,
  RekonWtHarian,
  RekapRemote,
};

// Named exports for backward compatibility
export { User, Store, SalesPerDept, MDept, RekonWtHarian, RekapRemote };

// Database connection functions
export const getDatabase = () => resilientDb.getDatabase();
export const closeDatabase = () => resilientDb.close();



// Helper function to manually associate store with manager
// This replaces the Sequelize relationship that was removed
export const getStoreManager = async managerId => {
  if (!managerId) return null;
  return await User.findByPk(managerId);
};
