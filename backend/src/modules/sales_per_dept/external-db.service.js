/**
 * Service for connecting to external database
 */
import mysql from 'mysql2/promise';
import syncConfig from '../../config/sync.config.js';
import logger from '../../config/logger.js';
import { WrcService } from '../../services/index.js';

const wrcService = new WrcService();

class ExternalDbService {
  constructor() {
    this.connection = null;
  }

  /**
   * Create a connection to the external database
   * @returns {Promise<Object>} MySQL connection
   */
  /**
   * Create a connection to the external database (default config)
   * @returns {Promise<Object>} MySQL connection
   */
  async connectDefault() {
    try {
      if (this.connection) {
        return this.connection;
      }
      const config = syncConfig.externalDbEDP;
      this.connection = await mysql.createConnection({
        host: config.host,
        user: config.user,
        password: config.password,
        database: config.database,
      });
      logger.info(`Connected to DB_EDP database at ${config.host}`);
      return this.connection;
    } catch (error) {
      logger.error(`Failed to connect to DB_EDP database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a connection to WRC server cabang (dinamis)
   * @param {string} cab - kode cabang
   * @returns {Promise<Object>} MySQL connection
   */
  async connectCabang(cab) {
    try {
      const config = await wrcService.getConnWRC(cab);
      const conn = await mysql.createConnection(config);
      logger.info(`Connected to WRC server cabang ${cab} at ${config.host}`);
      return conn;
    } catch (error) {
      logger.error(`Failed to connect to WRC server cabang ${cab}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      logger.info("Disconnected from DB_EDP database");
    }
  }
}

export default ExternalDbService;
