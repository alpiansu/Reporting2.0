/**
 * Configuration for connecting to store databases
 */
const mysql = require("mysql2/promise");
const logger = require("./logger");

class DbStoreService {
  /**
   * Create a connection pool to a store database
   * @param {string} host - Database host IP address
   * @param {number} retries - Number of connection retries (default: 3)
   * @returns {Promise<Object>} MySQL connection pool
   */
  async createDbStore(host, retries = 3) {
    try {
      let dbStore = null;
      let attempt = 0;

      // Database configurations to try
      const dbConfigurations = [
        {
          user: 'edp',
          password: 'cUm4l!h4t@datA'
        },
        // Add more configurations if needed
      ];

      while (attempt < retries) {
        try {
          for (const config of dbConfigurations) {
            const pool = mysql.createPool({
              host,
              ...config,
              database: 'pos',
              timezone: '+00:00',
              dateStrings: true,
              multipleStatements: true,
              waitForConnections: true,
              connectTimeout: 15000,
              connectionLimit: 3,
              maxIdle: 2,
              enableKeepAlive: true,
              keepAliveInitialDelay: 0,
              idleTimeout: 30000,
            });

            // Test the connection
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();

            dbStore = pool;
            break; // If connection successful, exit the loop
          }

          if (dbStore) {
            break;
          }
        } catch (error) {
          const errorMessage = `Error creating database connection to host ${host} (Attempt ${attempt + 1}): ${error}`;
          logger.error(errorMessage);

          if (
            error.code === 'PROTOCOL_CONNECTION_LOST' ||
            error.code === 'PROTOCOL_TIMEOUT' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENETUNREACH' ||
            error.code === 'ECONNRESET'
          ) {
            const connectionErrorMessage = `Connection to host ${host} lost or timed out.`;
            logger.error(connectionErrorMessage);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempt++;
        }
      }

      if (!dbStore) {
        const errorMessage = `Could not establish connection to host ${host} with available configurations.`;
        logger.error(errorMessage);
      }

      return dbStore;
    } catch (error) {
      const errorMessage = `Failed to create connection to host ${host}: ${error.message}`;
      logger.error(errorMessage);
      throw error;
    }
  }
}

module.exports = new DbStoreService();