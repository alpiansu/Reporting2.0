const { sequelize } = require('../config/database');
const User = require('./user.model');
const Store = require('./store.model');
const Screening = require('./screening.model');

// Define relationships between models

// User - Screening relationship
User.hasMany(Screening, { foreignKey: 'userId', as: 'screenings' });
Screening.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Store - Screening relationship
Store.hasMany(Screening, { foreignKey: 'storeId', as: 'screenings' });
Screening.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

// Export models
module.exports = {
  sequelize,
  User,
  Store,
  Screening,
};