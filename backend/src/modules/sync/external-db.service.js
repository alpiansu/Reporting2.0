/**
 * Service for connecting to external database
 */
const mysql = require("mysql2/promise");
const syncConfig = require("../../config/sync.config");
const logger = require("../../config/logger");

class ExternalDbService {
  constructor() {
    this.config = syncConfig.externalDbEDP;
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = 3;
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
      logger.info("Disconnected from external database");
    }
  }

  /**
   * Fetch store data from external database
   * @returns {Promise<Array>} Array of store data
   */
  async fetchStoreData() {
    try {
      const conn = await this.connect();

      // Use the new query that joins with store name information
      const query = `SELECT * FROM db_edp.rekap_ip a INNER JOIN ( 
                      SELECT * FROM ( 
                        SELECT KodeGudang as Cab, KodeToko AS KDTK, NamaToko AS NAMATK FROM tb_toko UNION ALL 
                        SELECT KDCAB as Cab, Toko AS KDTK, Nama AS NAMATK FROM m_toko 
                      ) AS toko GROUP BY KDTK 
                    ) b ON a.kdtk = b.KDTK WHERE a.jenis IN ('INDUK','STB');`;

      const [rows] = await conn.execute(query);
      // logger.info(`Fetched ${rows.length} records from external database`);

      return rows;
    } catch (error) {
      logger.error(`Failed to fetch store data: ${error.message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Fetch department data from external database
   * @returns {Promise<Array>} Array of department data
   */
  async fetchDeptData() {
    try {
      const conn = await this.connect();

      const query = `SELECT * FROM db_edp.m_dept;`;
      const [rows] = await conn.execute(query);

      return rows;
    } catch (error) {
      logger.error(`Failed to fetch department data: ${error.message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

module.exports = ExternalDbService;
