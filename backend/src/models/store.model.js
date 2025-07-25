const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Store = sequelize.define('Store', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  storeCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
  storeName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  region: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dbHost: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbPort: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3306,
  },
  dbUser: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbPassword: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastScreening: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  screeningStatus: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  connectionStatus: {
    type: DataTypes.ENUM('connected', 'disconnected', 'unknown'),
    defaultValue: 'unknown',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'stores',
  timestamps: true,
  underscored: true,
});

module.exports = Store;