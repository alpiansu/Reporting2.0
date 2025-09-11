/**
 * Base Service Class with Resilient Database Support
 * Provides graceful degradation when database is unavailable
 */
import resilientDb from '../config/resilient-database.js';
import logger from '../config/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class BaseService {
  constructor(model = null) {
    this.model = model;
    this.offlineDataPath = path.join(process.cwd(), 'data', 'offline');
    this.ensureOfflineDirectory();
  }

  /**
   * Ensure offline data directory exists
   */
  async ensureOfflineDirectory() {
    try {
      await fs.mkdir(this.offlineDataPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create offline data directory:', error);
    }
  }

  /**
   * Get database connection with lazy loading
   */
  async getConnection() {
    return await resilientDb.getConnection();
  }

  /**
   * Execute database operation with graceful degradation
   */
  async executeWithFallback(operation, fallbackData = null, cacheKey = null) {
    try {
      // Check if database is available
      if (!resilientDb.isDatabaseAvailable()) {
        logger.warn('Database unavailable, using fallback data');
        return await this.getFallbackData(cacheKey, fallbackData);
      }

      const connection = await this.getConnection();
      const result = await operation(connection);
      
      // Cache successful result for offline use
      if (cacheKey && result) {
        await this.cacheData(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      logger.error('Database operation failed:', error);
      
      // Try to use cached data if available
      if (cacheKey) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          logger.info(`Using cached data for ${cacheKey}`);
          return cachedData;
        }
      }
      
      // Use fallback data if no cache available
      if (fallbackData) {
        logger.info('Using fallback data');
        return fallbackData;
      }
      
      throw error;
    }
  }

  /**
   * Execute write operation with database availability check
   */
  async executeWriteOperation(operation) {
    if (!resilientDb.isDatabaseAvailable()) {
      throw new Error('Database sedang tidak tersedia. Operasi tulis tidak dapat dilakukan.');
    }

    const connection = await this.getConnection();
    return await operation(connection);
  }

  /**
   * Cache data for offline use
   */
  async cacheData(key, data) {
    try {
      const filePath = path.join(this.offlineDataPath, `${key}.json`);
      const cacheData = {
        data,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
      logger.debug(`Data cached for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to cache data for key ${key}:`, error);
    }
  }

  /**
   * Get cached data
   */
  async getCachedData(key) {
    try {
      const filePath = path.join(this.offlineDataPath, `${key}.json`);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const cacheData = JSON.parse(fileContent);
      
      // Check if cache is not too old (24 hours)
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge > maxAge) {
        logger.warn(`Cache expired for key: ${key}`);
        return null;
      }
      
      return cacheData.data;
    } catch (error) {
      logger.debug(`No cached data found for key: ${key}`);
      return null;
    }
  }

  /**
   * Get fallback data
   */
  async getFallbackData(cacheKey, fallbackData) {
    if (cacheKey) {
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }
    return fallbackData || [];
  }

  /**
   * Find all records with fallback support
   */
  async findAll(options = {}, cacheKey = null, fallbackData = []) {
    return await this.executeWithFallback(
      async (connection) => {
        if (this.model) {
          return await this.model.findAll(options);
        }
        throw new Error('Model not defined');
      },
      fallbackData,
      cacheKey
    );
  }

  /**
   * Find one record with fallback support
   */
  async findOne(options = {}, cacheKey = null, fallbackData = null) {
    return await this.executeWithFallback(
      async (connection) => {
        if (this.model) {
          return await this.model.findOne(options);
        }
        throw new Error('Model not defined');
      },
      fallbackData,
      cacheKey
    );
  }

  /**
   * Find by primary key with fallback support
   */
  async findByPk(id, options = {}, cacheKey = null, fallbackData = null) {
    return await this.executeWithFallback(
      async (connection) => {
        if (this.model) {
          return await this.model.findByPk(id, options);
        }
        throw new Error('Model not defined');
      },
      fallbackData,
      cacheKey
    );
  }

  /**
   * Create record (requires database)
   */
  async create(data) {
    return await this.executeWriteOperation(async (connection) => {
      if (this.model) {
        return await this.model.create(data);
      }
      throw new Error('Model not defined');
    });
  }

  /**
   * Update record (requires database)
   */
  async update(data, options) {
    return await this.executeWriteOperation(async (connection) => {
      if (this.model) {
        return await this.model.update(data, options);
      }
      throw new Error('Model not defined');
    });
  }

  /**
   * Delete record (requires database)
   */
  async destroy(options) {
    return await this.executeWriteOperation(async (connection) => {
      if (this.model) {
        return await this.model.destroy(options);
      }
      throw new Error('Model not defined');
    });
  }

  /**
   * Count records with fallback support
   */
  async count(options = {}, cacheKey = null, fallbackCount = 0) {
    return await this.executeWithFallback(
      async (connection) => {
        if (this.model) {
          return await this.model.count(options);
        }
        throw new Error('Model not defined');
      },
      fallbackCount,
      cacheKey
    );
  }

  /**
   * Execute raw query with fallback support
   */
  async executeQuery(query, options = {}, cacheKey = null, fallbackData = []) {
    return await this.executeWithFallback(
      async (connection) => {
        return await connection.query(query, options);
      },
      fallbackData,
      cacheKey
    );
  }

  /**
   * Get database status
   */
  getDatabaseStatus() {
    return resilientDb.getStatus();
  }

  /**
   * Check if database is available
   */
  isDatabaseAvailable() {
    return resilientDb.isDatabaseAvailable();
  }
}

export default BaseService;