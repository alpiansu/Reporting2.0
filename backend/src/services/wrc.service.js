/**
 * Service for connecting to external database
 */
import mysql from 'mysql2/promise';
import syncConfig from '../config/sync.config.js';
import logger from '../config/logger.js';

class wrcBulananService {
  /**
   * Get monthly connection config for a branch (cab)
   * @param {string} cab - Branch code
   * @returns {Promise<Object>} Connection config object
   */
  async getConnWRC(cab) {
    let conDBEdp;
    try {
      conDBEdp = await mysql.createConnection({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
      });
      const [rows] = await conDBEdp.execute(
        `SELECT * FROM config_cabang WHERE rkey IN('constringwrc') AND kode_cab=?`,
        [cab]
      );
      if (!rows.length || !rows[0].nilai) {
        throw new Error("No config wrc found for cabang: " + cab);
      }
      const constring = rows[0].nilai.split(";");
      const config = {};
      for (const obj of constring) {
        const cek = obj.trim().split("=");
        switch (cek[0].toLowerCase()) {
          case "server":
            config.host = cek[1];
            break;
          case "uid":
            config.user = cek[1];
            break;
          case "password":
            config.password = cek[1];
            break;
          case "database":
            config.database = cek[1];
            break;
        }
      }
      // Default options
      config.multipleStatements = true;
      config.dateStrings = ["DATE", "DATETIME"];
      return config;
    } catch (error) {
      logger.error(`getConnWRC error: ${error.message}`);
      throw error;
    } finally {
      if (conDBEdp) await conDBEdp.end();
    }
  }

  /**
   * Get all active branches that have WRC connection strings
   * @returns {Promise<Array<string>>} Array of branch codes
   */
  async getAllCabangWrc() {
    let conDBEdp;
    try {
      conDBEdp = await mysql.createConnection({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
      });
      const [rows] = await conDBEdp.execute(
        `SELECT DISTINCT kode_cab FROM config_cabang WHERE rkey IN('constringwrc')`
      );
      return rows.map(r => r.kode_cab);
    } catch (error) {
      logger.error(`getAllCabangWrc error: ${error.message}`);
      throw error;
    } finally {
      if (conDBEdp) await conDBEdp.end();
    }
  }

  constructor() {
    this.config = syncConfig.externalDbEDP;
    this.connection = null;
  }

  /**
   * Create a connection to the external database
   * @returns {Promise<Object>} MySQL connection
   */
  async connect() {
    try {
      if (this.connection) {
        return this.connection;
      }

      this.connection = await mysql.createConnection({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
      });

      logger.info(`Connected to DB_EDP database at ${this.config.host}`);
      return this.connection;
    } catch (error) {
      logger.error(`Failed to connect to DB_EDP database: ${error.message}`);
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

export default wrcBulananService;
