/**
 * Resilient Database Connection Wrapper
 * Provides graceful degradation when database is unavailable
 */
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import logger from "./logger.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

class ResilientDatabase {
  constructor() {
    this.sequelize = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.lastConnectionAttempt = null;
    this.lastConnectionFailure = null;
    this.connectionCooldown = 30000; // 30 seconds cooldown after real failures
    this.connectionPromise = null;
    this.generation = 0;

    // JSON file paths for offline data
    this.dataPath = path.join(process.cwd(), "data");
    this.offlineDataFiles = {
      stores: path.join(this.dataPath, "stores.json"),
      users: path.join(this.dataPath, "users.json"),
      rekon_wt_harian: path.join(this.dataPath, "rekon_wt_harian.json"),
      rekap_remote: path.join(this.dataPath, "rekap_remote.json"),
    };
  }

  /**
   * Initialize database connection with retry mechanism
   */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.connect();
    } catch (error) {
      logger.warn(`Database initialization failed: ${error.message}. Running in offline mode.`);
      this.isConnected = false;
    }
  }

  /**
   * Ensure data directory exists for offline storage
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create data directory: ${error.message}`);
    }
  }

  /**
   * Attempt to connect to database. Concurrent callers share one connection attempt.
   */
  async connect(options = {}) {
    const { force = false } = options;

    if (this.connectionPromise) {
      logger.info("Database connection attempt already in progress, waiting for existing attempt...");
      return this.connectionPromise;
    }

    if (!force && this.lastConnectionFailure && Date.now() - this.lastConnectionFailure < this.connectionCooldown) {
      throw new Error("Connection attempt in cooldown period");
    }

    this.lastConnectionAttempt = Date.now();
    this.connectionPromise = this.createConnection();

    try {
      return await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  async createConnection() {
    let nextSequelize = null;

    try {
      nextSequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "mysql",
        timezone: "+07:00",
        logging: process.env.NODE_ENV === "development" ? console.log : false,
        define: {
          timestamps: true,
          underscored: true,
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        retry: {
          max: this.maxRetries,
        },
      });

      await nextSequelize.authenticate();

      const previousSequelize = this.sequelize;
      if (previousSequelize && previousSequelize !== nextSequelize) {
        await previousSequelize.close().catch(error => {
          logger.warn(`Failed to close previous database connection: ${error.message}`);
        });
      }

      this.sequelize = nextSequelize;
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.lastConnectionFailure = null;
      this.generation++;
      logger.info("Database connection established successfully");

      this.setupConnectionHandlers();

      return nextSequelize;
    } catch (error) {
      this.isConnected = false;
      this.connectionAttempts++;
      this.lastConnectionFailure = Date.now();
      logger.error(`Database connection failed (attempt ${this.connectionAttempts}): ${error.message}`);

      if (nextSequelize) {
        await nextSequelize.close().catch(closeError => {
          logger.warn(`Failed to close failed database connection: ${closeError.message}`);
        });
      }

      throw error;
    }
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    if (!this.sequelize) return;

    try {
      // Handle connection errors using Sequelize hooks instead of connectionManager events
      this.sequelize.addHook("afterConnect", () => {
        logger.info("Database connection established via hook");
        this.isConnected = true;
      });

      this.sequelize.addHook("beforeDisconnect", () => {
        logger.warn("Database disconnecting via hook");
        this.isConnected = false;
      });
    } catch (error) {
      logger.warn(`Could not setup connection handlers: ${error.message}`);
    }
  }

  /**
   * Get database instance with automatic reconnection and retry
   */
  async getDatabase() {
    if (this.isConnected && this.sequelize) {
      return this.sequelize;
    }

    if (this.connectionPromise) {
      try {
        return await this.connectionPromise;
      } catch (error) {
        logger.warn(`Database connection in progress failed: ${error.message}`);
      }
    }

    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempting to reconnect to database (attempt ${attempt}/${maxRetries})...`);
        await this.connect({ force: attempt > 1 });

        if (this.isConnected && this.sequelize) {
          logger.info("Database reconnected successfully");
          return this.sequelize;
        }
      } catch (error) {
        logger.warn(`Database reconnection attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = retryDelay * attempt;
          logger.info(`Waiting ${delay}ms before next retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.warn("Database unavailable after all reconnection attempts, operating in offline mode");
    return null;
  }

  /**
   * Execute database operation with fallback to offline mode
   */
  async executeOperation(operation, fallbackData = null) {
    const db = await this.getDatabase();

    if (!db) {
      if (fallbackData) {
        logger.info("Database unavailable, using fallback data");
        return fallbackData;
      }
      throw new DatabaseUnavailableError("Database is currently unavailable");
    }

    try {
      return await operation(db);
    } catch (error) {
      logger.error(`Database operation failed: ${error.message}`);
      this.isConnected = false;

      if (fallbackData) {
        logger.info("Database operation failed, using fallback data");
        return fallbackData;
      }

      throw error;
    }
  }

  /**
   * Read data from JSON file (offline mode)
   */
  async readOfflineData(dataType) {
    try {
      const filePath = this.offlineDataFiles[dataType];
      if (!filePath) {
        throw new Error(`Unknown data type: ${dataType}`);
      }

      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn(`Offline data file not found for ${dataType}`);
        return [];
      }
      logger.error(`Error reading offline data for ${dataType}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write data to JSON file (for offline access)
   */
  async writeOfflineData(dataType, data) {
    try {
      const filePath = this.offlineDataFiles[dataType];
      if (!filePath) {
        throw new Error(`Unknown data type: ${dataType}`);
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`Offline data saved for ${dataType}`);
    } catch (error) {
      logger.error(`Error writing offline data for ${dataType}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if database is available
   */
  isDatabaseAvailable() {
    return this.isConnected && this.sequelize;
  }

  /**
   * Force reconnection attempt
   */
  async forceReconnect() {
    this.lastConnectionAttempt = null;
    this.lastConnectionFailure = null;
    this.connectionAttempts = 0;
    return await this.connect({ force: true });
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.sequelize) {
      try {
        await this.sequelize.close();
        this.isConnected = false;
        this.sequelize = null;
        this.generation++;
        logger.info("Database connection closed");
      } catch (error) {
        logger.error(`Error closing database connection: ${error.message}`);
      }
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      lastConnectionAttempt: this.lastConnectionAttempt,
      lastConnectionFailure: this.lastConnectionFailure,
      hasSequelize: !!this.sequelize,
      generation: this.generation,
      reconnecting: !!this.connectionPromise,
    };
  }

  getGeneration() {
    return this.generation;
  }
}

/**
 * Custom error for database unavailability
 */
class DatabaseUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.statusCode = 503;
    this.isOperational = true;
  }
}

// Create singleton instance
const resilientDb = new ResilientDatabase();

export default resilientDb;
export { DatabaseUnavailableError };