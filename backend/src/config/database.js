import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import config from './index.js';
import mysql from 'mysql2/promise';
import logger from './logger.js';
import resilientDb from './resilient-database.js';

dotenv.config();

// Main database connection with lazy loading
let sequelize = null;

const getSequelizeConnection = async () => {
  if (!sequelize) {
    try {
      sequelize = new Sequelize(
        config.database.name,
        config.database.username,
        config.database.password,
        {
          host: config.database.host,
          port: config.database.port,
          dialect: config.database.dialect,
          logging: config.database.logging ? logger.info : false,
          pool: {
            max: 5, // Reduced pool size for lazy loading
            min: 0,
            acquire: 30000,
            idle: 5000, // Shorter idle time
            evict: 10000, // Auto-close idle connections
          },
          define: {
            timestamps: true,
            underscored: true,
          },
          retry: {
            max: 3,
            timeout: 5000,
          },
        }
      );
      
      // Test connection
      await sequelize.authenticate();
      logger.info('Database connection established successfully');
      
    } catch (error) {
      logger.error('Unable to connect to database:', error);
      sequelize = null;
      throw error;
    }
  }
  return sequelize;
};

// Close connection when not needed
const closeSequelizeConnection = async () => {
  if (sequelize) {
    try {
      await sequelize.close();
      sequelize = null;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }
};

// External store database connection factory
const createStoreConnection = storeConfig => {
  return new Sequelize(storeConfig.STORE_DB_NAME, storeConfig.STORE_DB_USER, storeConfig.STORE_DB_PASSWORD, {
    host: storeConfig.STORE_DB_HOST,
    port: storeConfig.STORE_DB_PORT,
    dialect: "mysql",
    logging: false,
  });
};

export default {
  getSequelizeConnection,
  closeSequelizeConnection,
  createStoreConnection,
};

// Named exports for convenience
export { getSequelizeConnection, closeSequelizeConnection, createStoreConnection };
