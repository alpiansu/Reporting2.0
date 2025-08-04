const { sequelize } = require("../config/database");
const User = require("./user.model");
const Store = require("./store.model");
const Screening = require("./screening.model");
const SalesPerDept = require("./sales_per_dept.model");

// Define relationships between models
// Note: Store is now a JSON-based model, so Sequelize relationships don't apply to it

// User - Screening relationship
User.hasMany(Screening, { foreignKey: "userId", as: "screenings" });
Screening.belongsTo(User, { foreignKey: "userId", as: "user" });

// Screening - User creator relationship
Screening.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
User.hasMany(Screening, { foreignKey: "createdBy", as: "createdScreenings" });

// Note: Store relationships are now handled manually in the service layer
// since Store is no longer a Sequelize model

// Export models
module.exports = {
  sequelize,
  User,
  Store,
  Screening,
  SalesPerDept,
};

// Helper function to manually associate store with screenings
// This replaces the Sequelize relationship that was removed
module.exports.getStoreScreenings = async storeId => {
  return await Screening.findAll({ where: { storeId } });
};

// Helper function to manually associate store with manager
// This replaces the Sequelize relationship that was removed
module.exports.getStoreManager = async managerId => {
  if (!managerId) return null;
  return await User.findByPk(managerId);
};
