import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import logger from "../../config/logger.js";
import HistAdjust from "../../models/hist_adjust.model.js";
import UserService from "../user/user.service.js";
import lockfile from "proper-lockfile";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

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

    this.userService = new UserService();
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
    let release;
    const backupPath = path.join(this.dataDir, "hist_adjust.backup.json");
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      release = await lockfile.lock(this.jsonFilePath, {
        stale: 120000,
        retries: { retries: 10, factor: 2, minTimeout: 2000, maxTimeout: 10000 },
      });

      const exists = await fs
        .access(this.jsonFilePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        await fs.copyFile(this.jsonFilePath, backupPath);
      } else {
        await fs.writeFile(this.jsonFilePath, "[]");
      }

      const stream = createWriteStream(this.jsonFilePath, { encoding: "utf8" });
      await new Promise(resolve => stream.once("open", resolve));
      stream.write("[");

      let offset = 0;
      const limit = 5000;
      let total = 0;
      let first = true;

      while (true) {
        const records = await HistAdjust.findAll({
          order: [["updtime", "DESC"]],
          offset,
          limit,
          raw: true,
        });
        if (!records.length) break;
        total += records.length;
        const mapped = records.map(record => ({
          ...record,
          updtime:
            record.updtime instanceof Date
              ? dayjs(record.updtime).tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss")
              : record.updtime,
        }));

        for (const obj of mapped) {
          if (!first) stream.write(",");
          stream.write(JSON.stringify(obj));
          first = false;
        }
        offset += records.length;
      }

      stream.write("]");
      await new Promise((res, rej) => stream.end(err => (err ? rej(err) : res())));

      await this.loadFromJson();

      if (release) await release();
      await fs.unlink(backupPath).catch(() => {});

      logger.info(`Synced ${total} hist_adjust records to JSON file`);
      return { success: true, recordCount: total };
    } catch (error) {
      try {
        const bakExists = await fs
          .access(backupPath)
          .then(() => true)
          .catch(() => false);
        if (bakExists) {
          await fs.copyFile(backupPath, this.jsonFilePath);
          await fs.unlink(backupPath).catch(() => {});
        }
      } catch {}
      if (release) {
        try {
          await release();
        } catch {}
      }
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
      // console.log("Filters received:", filters);
      // Apply filters
      if (filters.kdtk) {
        // console.log(`kebaca ini`);
        let kdtkList = [];

        // Handle array of kdtk values
        if (Array.isArray(filters.kdtk)) {
          kdtkList = filters.kdtk.map(v => String(v).trim()).filter(Boolean);
        }
        // Handle comma-separated string
        else if (typeof filters.kdtk === "string" && filters.kdtk.includes(",")) {
          kdtkList = filters.kdtk
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
        }
        // Handle single string value
        else if (typeof filters.kdtk === "string") {
          kdtkList = [filters.kdtk.trim()];
        }

        // Filter by list of kdtk (exact match)
        if (kdtkList.length > 0) {
          const set = new Set(kdtkList);
          filteredData = filteredData.filter(record => {
            if (!record.kdtk) return false;
            const recordKdtk = String(record.kdtk).trim();
            return set.has(recordKdtk);
          });
        }
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

      // Calculate total before pagination
      const totalCount = filteredData.length;

      // Apply pagination if requested
      if (filters.limit) {
        const offset = filters.offset || 0;
        filteredData = filteredData.slice(offset, offset + filters.limit);
      }

      // Enrich data dengan fullName dari user
      await this.enrichWithUserData(filteredData);

      return {
        success: true,
        data: filteredData,
        totalCount,
      };
    } catch (error) {
      logger.error(`Error searching hist_adjust records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enrich data dengan fullName - MEMORY EFFICIENT VERSION
   * Hanya query user yang benar-benar ada di pic
   */
  async enrichWithUserData(records) {
    try {
      // Kumpulkan unique pic values
      const uniquePics = [...new Set(records.map(r => r.pic).filter(Boolean))];

      // Jika tidak ada pic, skip
      if (uniquePics.length === 0) {
        records.forEach(record => {
          record.picFullName = null;
        });
        return;
      }

      // Load ALL users hanya sekali (masih pakai cache dari UserService)
      const allUsers = await this.userService.getAllUsers();

      // Buat map HANYA untuk pic yang ada di records
      const userMap = new Map();
      uniquePics.forEach(pic => {
        const user = allUsers.find(u => u.username === pic);
        if (user) {
          userMap.set(pic, user.fullName);
        }
      });

      // Enrich records
      records.forEach(record => {
        if (record.pic) {
          record.picFullName = userMap.get(record.pic) || record.pic;
        } else {
          record.picFullName = null;
        }
      });

      // allUsers akan di-garbage collect setelah function selesai
    } catch (error) {
      logger.error(`Error enriching user data: ${error.message}`);
      records.forEach(record => {
        record.picFullName = record.pic || null;
      });
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
