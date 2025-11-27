/**
 * Cache Manager - Modular cache management with TTL and auto cleanup
 * Handles JSON file storage per periode and in-memory caching
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";

class CacheManager {
  constructor(config) {
    this.config = config;
    this.cache = new Map(); // In-memory cache: key -> { data, lastAccessTime, ttl }
    this.cleanupInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize cache manager and start cleanup interval
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Ensure base directory exists
      const baseDir = path.join(process.cwd(), this.config.storage.baseDir);
      await fs.mkdir(baseDir, { recursive: true });

      // Start automatic cleanup
      this.startCleanupInterval();

      this.isInitialized = true;
      logger.info(`[CacheManager] Initialized for ${this.config.storage.baseDir}`);
    } catch (error) {
      logger.error(`[CacheManager] Failed to initialize: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(params) {
    return JSON.stringify(params);
  }

  /**
   * Get file path for JSON storage
   * Format: data/rekon_sales/YYYY-MM/rekon_sales_YYYY-MM.json
   */
  getFilePath(year, month) {
    const baseDir = path.join(process.cwd(), this.config.storage.baseDir);
    const periodDir = `${year}-${month.toString().padStart(2, "0")}`;
    const fileName = `${this.config.storage.filePrefix}_${year}-${month.toString().padStart(2, "0")}.json`;

    return {
      dirPath: path.join(baseDir, periodDir),
      filePath: path.join(baseDir, periodDir, fileName),
      periodKey: `${year}-${month}`,
    };
  }

  /**
   * Load data from JSON file
   */
  async loadFromFile(year, month) {
    try {
      const { filePath, periodKey } = this.getFilePath(year, month);

      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);

      logger.info(`[CacheManager] Loaded data from ${filePath}`);
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.info(`[CacheManager] File not found for ${year}-${month}, returning empty array`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  async saveToFile(year, month, data) {
    try {
      const { dirPath, filePath, periodKey } = this.getFilePath(year, month);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

      logger.info(`[CacheManager] Saved ${data.length} records to ${filePath}`);
    } catch (error) {
      logger.error(`[CacheManager] Failed to save to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get data from cache (with TTL check)
   */
  get(key, ttl = this.config.cache.summaryTTL) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.lastAccessTime;

    // Check if expired
    if (age > ttl) {
      logger.debug(`[CacheManager] Cache expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    // Update last access time
    entry.lastAccessTime = now;
    this.cache.set(key, entry);

    logger.debug(`[CacheManager] Cache hit for key: ${key}`);
    return entry.data;
  }

  /**
   * Set data to cache
   */
  set(key, data, ttl = this.config.cache.summaryTTL) {
    const now = Date.now();

    this.cache.set(key, {
      data,
      lastAccessTime: now,
      createdAt: now,
      ttl,
    });

    logger.debug(`[CacheManager] Cache set for key: ${key}`);
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`[CacheManager] Cache deleted for key: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[CacheManager] Cleared ${size} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    const stats = {
      totalEntries: entries.length,
      activeEntries: 0,
      inactiveEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null,
    };

    entries.forEach(([key, entry]) => {
      const age = now - entry.lastAccessTime;
      const inactive = age > this.config.cache.inactiveThreshold;

      if (inactive) {
        stats.inactiveEntries++;
      } else {
        stats.activeEntries++;
      }

      // Calculate size (rough estimate)
      stats.totalSize += JSON.stringify(entry.data).length;

      // Track oldest and newest
      if (!stats.oldestEntry || entry.createdAt < stats.oldestEntry.createdAt) {
        stats.oldestEntry = entry;
      }
      if (!stats.newestEntry || entry.createdAt > stats.newestEntry.createdAt) {
        stats.newestEntry = entry;
      }
    });

    return stats;
  }

  /**
   * Cleanup inactive cache entries
   * Removes entries that haven't been accessed for inactiveThreshold duration
   */
  cleanup() {
    const now = Date.now();
    const before = this.cache.size;
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.lastAccessTime;

      // Remove if inactive beyond threshold
      if (age > this.config.cache.inactiveThreshold) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`[CacheManager] Cleanup: removed ${cleaned} inactive entries (${before} -> ${this.cache.size})`);
    } else {
      logger.debug(`[CacheManager] Cleanup: no inactive entries found`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        logger.error(`[CacheManager] Cleanup error: ${error.message}`);
      }
    }, this.config.cache.cleanupInterval);

    logger.info(
      `[CacheManager] Cleanup interval started (every ${
        this.config.cache.cleanupInterval / 1000
      }s, inactive threshold: ${this.config.cache.inactiveThreshold / 1000}s)`
    );
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info(`[CacheManager] Cleanup interval stopped`);
    }
  }

  /**
   * Get all available periods from disk
   */
  async getAvailablePeriods() {
    try {
      const baseDir = path.join(process.cwd(), this.config.storage.baseDir);
      const entries = await fs.readdir(baseDir, { withFileTypes: true });

      const periods = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => /^\d{4}-\d{2}$/.test(name))
        .sort();

      return periods;
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete old period files (older than X months)
   */
  async cleanupOldFiles(monthsToKeep = 6) {
    try {
      const baseDir = path.join(process.cwd(), this.config.storage.baseDir);
      const periods = await this.getAvailablePeriods();

      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);

      const cutoffPeriod = `${cutoffDate.getFullYear()}-${(cutoffDate.getMonth() + 1).toString().padStart(2, "0")}`;

      let deleted = 0;

      for (const period of periods) {
        if (period < cutoffPeriod) {
          const periodDir = path.join(baseDir, period);
          await fs.rm(periodDir, { recursive: true, force: true });
          deleted++;
          logger.info(`[CacheManager] Deleted old period: ${period}`);
        }
      }

      if (deleted > 0) {
        logger.info(`[CacheManager] Cleaned up ${deleted} old period directories`);
      }

      return deleted;
    } catch (error) {
      logger.error(`[CacheManager] Error cleaning up old files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Shutdown - cleanup and stop intervals
   */
  shutdown() {
    this.stopCleanupInterval();
    this.clear();
    this.isInitialized = false;
    logger.info(`[CacheManager] Shutdown complete`);
  }
}

export default CacheManager;
