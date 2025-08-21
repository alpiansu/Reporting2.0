const { sequelize } = require("../config/database");
const User = require("./user.model");
const Store = require("./store.model");
const SalesPerDept = require("./sales_per_dept.model");
const MDept = require("./m_dept.model");
const RekonWtHarian = require("./rekon_wt_harian.model");

// Define relationships between models
// Note: Store is now a JSON-based model, so Sequelize relationships don't apply to it

// Note: Store relationships are now handled manually in the service layer
// since Store is no longer a Sequelize model

// Export models
module.exports = {
  sequelize,
  User,
  Store,
  SalesPerDept,
  MDept,
  RekonWtHarian,
};



// Helper function to manually associate store with manager
// This replaces the Sequelize relationship that was removed
module.exports.getStoreManager = async managerId => {
  if (!managerId) return null;
  return await User.findByPk(managerId);
};
