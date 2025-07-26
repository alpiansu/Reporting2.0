const { sequelize } = require('../config/database');
const User = require('./user.model');
const Store = require('./store.model');
const Screening = require('./screening.model');

// Define relationships between models

// Store - User relationship
Store.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });
User.hasMany(Store, { foreignKey: 'managerId', as: 'managedStores' });

// Screening relationships
Screening.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });
Store.hasMany(Screening, { foreignKey: 'storeId', as: 'screenings' });

Screening.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
User.hasMany(Screening, { foreignKey: 'createdBy', as: 'createdScreenings' });

// User - Screening relationship
User.hasMany(Screening, { foreignKey: 'userId', as: 'screenings' });
Screening.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Export models
module.exports = {
  sequelize,
  User,
  Store,
  Screening,
};