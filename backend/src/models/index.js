import { sequelize } from '../config/database.js';
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
  sequelize,
  User,
  Store,
  SalesPerDept,
  MDept,
  RekonWtHarian,
  RekapRemote,
};

// Named exports for backward compatibility
export { sequelize, User, Store, SalesPerDept, MDept, RekonWtHarian, RekapRemote };



// Helper function to manually associate store with manager
// This replaces the Sequelize relationship that was removed
export const getStoreManager = async managerId => {
  if (!managerId) return null;
  return await User.findByPk(managerId);
};
