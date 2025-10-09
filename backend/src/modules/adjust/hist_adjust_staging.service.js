import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import HistAdjust from "../../models/hist_adjust.model.js";

/**
 * HistAdjust Staging Service
 * Handles JSON file storage and memory cache with TTL for hist_adjust data
 * Similar to rekon_wt_harian module pattern
 */
class HistAdjustStagingService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
    this.jsonFilePath = path.join(this.dataDir, "hist_adjust.json");
    this.memoryCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes TTL
    this.isInitialized = false;
  }

  /**
   * Initialize staging service
   */
  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Load data from JSON file to memory cache
      await this.loadFromJson();

      this.isInitialized = true;
      logger.info("HistAdjust staging service initialized successfully");
    } catch (error) {
      logger.error(`Failed to initialize HistAdjust staging service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load data from JSON file
   */
  async loadFromJson() {
    try {
      const fileExists = await fs
        .access(this.jsonFilePath)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        // Create empty JSON file if it doesn't exist
        await fs.writeFile(this.jsonFilePath, JSON.stringify([], null, 2));
        this.memoryCache.set("hist_adjust_data", { data: [], timestamp: Date.now() });
        logger.info("Created new hist_adjust.json file");
        return;
      }

      const fileContent = await fs.readFile(this.jsonFilePath, "utf-8");
      const data = JSON.parse(fileContent);

      // Cache data with timestamp
      this.memoryCache.set("hist_adjust_data", {
        data: Array.isArray(data) ? data : [],
        timestamp: Date.now(),
      });

      logger.info(`Loaded ${data.length} hist_adjust records from JSON file`);
    } catch (error) {
      logger.error(`Error loading hist_adjust data from JSON: ${error.message}`);
      // Initialize with empty array on error
      this.memoryCache.set("hist_adjust_data", { data: [], timestamp: Date.now() });
    }
  }

  /**
   * Get data from memory cache or reload from JSON if TTL expired
   */
  async getData() {
    const cached = this.memoryCache.get("hist_adjust_data");

    if (!cached || Date.now() - cached.timestamp > this.cacheTTL) {
      await this.loadFromJson();
      return this.memoryCache.get("hist_adjust_data").data;
    }

    return cached.data;
  }

  /**
   * Sync database data to JSON file
   */
  async syncToJson() {
    try {
      const records = await HistAdjust.findAll({
        order: [["updtime", "DESC"]],
        limit: 10000, // Limit to prevent memory issues
        raw: true,
      });

      // Convert dates to ISO strings for JSON serialization
      const jsonData = records.map(record => ({
        ...record,
        updtime: record.updtime instanceof Date ? record.updtime.toISOString() : record.updtime,
      }));

      await fs.writeFile(this.jsonFilePath, JSON.stringify(jsonData, null, 2));

      // Update memory cache
      this.memoryCache.set("hist_adjust_data", {
        data: jsonData,
        timestamp: Date.now(),
      });

      logger.info(`Synced ${records.length} hist_adjust records to JSON file`);
      return { success: true, recordCount: records.length };
    } catch (error) {
      logger.error(`Error syncing hist_adjust to JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk insert adjustment history records
   * @param {Array} historyRecords - Array of history records to insert
   */
  async bulkInsert(historyRecords) {
    try {
      if (!Array.isArray(historyRecords) || historyRecords.length === 0) {
        return { success: true, insertedCount: 0 };
      }

      // Bulk insert to database
      const insertedRecords = await HistAdjust.bulkCreate(historyRecords, {
        validate: true,
        ignoreDuplicates: false,
      });

      logger.info(`Bulk inserted ${insertedRecords.length} hist_adjust records`);

      // Sync to JSON file after successful database insert
      await this.syncToJson();

      return {
        success: true,
        insertedCount: insertedRecords.length,
        records: insertedRecords,
      };
    } catch (error) {
      logger.error(`Error bulk inserting hist_adjust records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search history records with filters
   * @param {Object} filters - Search filters
   */
  async searchHistory(filters = {}) {
    try {
      const data = await this.getData();
      let filteredData = [...data];

      // Apply filters
      if (filters.kdtk) {
        filteredData = filteredData.filter(
          record => record.kdtk && record.kdtk.toLowerCase().includes(filters.kdtk.toLowerCase())
        );
      }

      if (filters.pic) {
        filteredData = filteredData.filter(
          record => record.pic && record.pic.toLowerCase().includes(filters.pic.toLowerCase())
        );
      }

      if (filters.status) {
        filteredData = filteredData.filter(record => record.status === filters.status);
      }

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        filteredData = filteredData.filter(record => new Date(record.updtime) >= fromDate);
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filteredData = filteredData.filter(record => new Date(record.updtime) <= toDate);
      }

      // Sort by updtime descending
      filteredData.sort((a, b) => new Date(b.updtime) - new Date(a.updtime));

      // Apply pagination if requested
      if (filters.limit) {
        const offset = filters.offset || 0;
        filteredData = filteredData.slice(offset, offset + filters.limit);
      }

      return {
        success: true,
        data: filteredData,
        totalCount: filteredData.length,
      };
    } catch (error) {
      logger.error(`Error searching hist_adjust records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics from history data
   */
  async getStatistics(filters = {}) {
    try {
      const data = await this.getData();
      let filteredData = [...data];

      // Apply date filters if provided
      if (filters.dateFrom || filters.dateTo) {
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          filteredData = filteredData.filter(record => new Date(record.updtime) >= fromDate);
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          filteredData = filteredData.filter(record => new Date(record.updtime) <= toDate);
        }
      }

      const totalRecords = filteredData.length;
      const successRecords = filteredData.filter(record => record.status === "SUCCESS").length;
      const failedRecords = filteredData.filter(record => record.status === "FAILED").length;

      // Get unique stores and users
      const uniqueStores = [...new Set(filteredData.map(record => record.kdtk))].length;
      const uniqueUsers = [...new Set(filteredData.map(record => record.pic))].length;

      return {
        success: true,
        statistics: {
          totalRecords,
          successRecords,
          failedRecords,
          successRate: totalRecords > 0 ? ((successRecords / totalRecords) * 100).toFixed(2) : 0,
          uniqueStores,
          uniqueUsers,
        },
      };
    } catch (error) {
      logger.error(`Error getting hist_adjust statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear expired cache entries (for memory management)
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.timestamp && now - value.timestamp > this.cacheTTL) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export default new HistAdjustStagingService();
