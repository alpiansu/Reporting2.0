const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

// Main application database configuration
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: "mysql",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
});

// External store database connection factory
const createStoreConnection = storeConfig => {
  return new Sequelize(storeConfig.STORE_DB_NAME, storeConfig.STORE_DB_USER, storeConfig.STORE_DB_PASSWORD, {
    host: storeConfig.STORE_DB_HOST,
    port: storeConfig.STORE_DB_PORT,
    dialect: "mysql",
    logging: false,
  });
};

module.exports = {
  sequelize,
  createStoreConnection,
};
