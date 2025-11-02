/**
 * Configuration for connecting to store databases
 */
import mysql from "mysql2/promise";
import logger from "./logger.js";

class DbStoreService {
  /**
   * Create a connection pool to a store database
   * @param {string} host - Database host IP address
   * @param {number} retries - Number of connection retries (default: 2)
   * @returns {Promise<Object>} MySQL connection pool
   */
  async createDbStore(host, retries = 2) {
    try {
      let dbStore = null;
      let attempt = 0;

      // Database configurations to try
      const dbConfigurations = [
        {
          user: "edp",
          password: "cUm4l!h4t@datA",
        },
        // Add more configurations if needed
      ];

      while (attempt < retries) {
        try {
          for (const config of dbConfigurations) {
            const pool = mysql.createPool({
              host,
              ...config,
              database: "pos",
              timezone: "+00:00",
              dateStrings: true,
              multipleStatements: true,
              waitForConnections: true,
              connectTimeout: 5000,
              connectionLimit: 3,
              maxIdle: 2,
              enableKeepAlive: true,
              keepAliveInitialDelay: 0,
              idleTimeout: 5000,
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
            error.code === "PROTOCOL_CONNECTION_LOST" ||
            error.code === "PROTOCOL_TIMEOUT" ||
            error.code === "ETIMEDOUT" ||
            error.code === "ENETUNREACH" ||
            error.code === "ECONNRESET"
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
        throw new Error(errorMessage);
      }

      return dbStore;
    } catch (error) {
      const errorMessage = `Failed to create connection to host ${host}: ${error.message}`;
      logger.error(errorMessage);
      throw error;
    }
  }

  async createDbStoreInterfence(host, retries = 3) {
    try {
      let dbStore = null;

      // Database configurations to try - expanded array for multiple options
      const dbConfigurations = [
        {
          user: "root",
          password: "phha8KKaFMraZOx7X4WYkJRJE6nlIrREM=XeAb9A5JTq",
        },
        {
          user: "root",
          password: "vdhoTZNDyeEcyiAV/5vlUcd6srNsylsVE=U0o+YPeZ/L",
        },
        // Add more configurations as needed
      ];

      // Try each configuration first for access denied scenarios
      for (let configIndex = 0; configIndex < dbConfigurations.length; configIndex++) {
        const config = dbConfigurations[configIndex];
        let attempt = 0;
        let connectionSuccessful = false;

        // Retry logic for non-access-denied errors
        while (attempt < retries && !connectionSuccessful) {
          try {
            const pool = mysql.createPool({
              host,
              ...config,
              database: "pos",
              timezone: "+00:00",
              dateStrings: true,
              multipleStatements: true,
              waitForConnections: true,
              connectTimeout: 5000,
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
            connectionSuccessful = true;
            break; // Connection successful, exit both loops
          } catch (error) {
            const errorMessage = `Error creating database connection to host ${host} with user ${config.user} (Config ${
              configIndex + 1
            }, Attempt ${attempt + 1}): ${error}`;
            logger.error(errorMessage);

            // Check if it's an access denied error
            if (error.code === "ER_ACCESS_DENIED_ERROR" || error.message.includes("Access denied")) {
              logger.error(`Access denied for user ${config.user}@${host}. Trying next configuration...`);
              break; // Break attempt loop and try next configuration
            }

            // For other connection errors, retry with same configuration
            if (
              error.code === "PROTOCOL_CONNECTION_LOST" ||
              error.code === "PROTOCOL_TIMEOUT" ||
              error.code === "ETIMEDOUT" ||
              error.code === "ENETUNREACH" ||
              error.code === "ECONNRESET"
            ) {
              const connectionErrorMessage = `Connection to host ${host} lost or timed out.`;
              logger.error(connectionErrorMessage);
            }

            // Wait before retrying (only for non-access-denied errors)
            if (attempt < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            attempt++;
          }
        }

        // If connection was successful, break out of configuration loop
        if (connectionSuccessful) {
          break;
        }
      }

      if (!dbStore) {
        const errorMessage = `Could not establish connection to host ${host} with any available configurations after trying all options.`;
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

export default new DbStoreService();
