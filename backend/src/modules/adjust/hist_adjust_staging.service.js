import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import logger from "../../config/logger.js";
import HistAdjust from "../../models/hist_adjust.model.js";
import UserService from "../user/user.service.js";
import lockfile from "proper-lockfile";
import { Op } from "sequelize";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * HistAdjust Staging Service
 * Handles JSON file storage and memory cache with TTL for hist_adjust data
 * Data is stored in monthly files (e.g., hist_adjust_202403.json)
 */
class HistAdjustStagingService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data", "hist_adjust");
    this.memoryCache = new Map(); // Key: periode (YYYYMM), Value: { data, timestamp }
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes TTL
    this.isInitialized = false;

    this.userService = new UserService();
  }

  /**
   * Get file path for a specific periode
   * @param {string} periode - Periode in YYYYMM format
   * @returns {string} Absolute file path
   */
  getFilePath(periode) {
    return path.join(this.dataDir, `hist_adjust_${periode}.json`);
  }

  /**
   * Get periode from a date string or Date object
   * @param {string|Date} date - Date to extract periode from
   * @returns {string} Periode in YYYYMM format
   */
  getPeriodeFromDate(date) {
    return dayjs(date).tz("Asia/Jakarta").format("YYYYMM");
  }

  /**
   * Get list of available monthly files
   * @returns {Promise<Array>} List of periodes
   */
  async getAvailablePeriodes() {
    try {
      const files = await fs.readdir(this.dataDir).catch(() => []);
      return files
        .filter(f => f.startsWith("hist_adjust_") && f.endsWith(".json") && !f.includes("backup"))
        .map(f => f.replace("hist_adjust_", "").replace(".json", ""))
        .sort((a, b) => b.localeCompare(a)); // Newest first
    } catch (error) {
      logger.error(`Error listing available periodes: ${error.message}`);
      return [];
    }
  }

  /**
   * Initialize staging service
   */
  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Handle legacy file if it exists
      const legacyPath = path.join(process.cwd(), "data", "hist_adjust.json");
      const legacyExists = await fs.access(legacyPath).then(() => true).catch(() => false);
      if (legacyExists) {
        logger.info("Found legacy hist_adjust.json. You may want to sync from DB to redistribute data to monthly files.");
      }

      this.isInitialized = true;
      logger.info("HistAdjust staging service initialized successfully with monthly file support");
    } catch (error) {
      logger.error(`Failed to initialize HistAdjust staging service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load data from JSON file for a specific periode
   * @param {string} periode - Periode in YYYYMM format
   */
  async loadFromJson(periode) {
    if (!periode) return;
    
    const filePath = this.getFilePath(periode);
    try {
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        this.memoryCache.set(periode, { data: [], timestamp: Date.now() });
        return;
      }

      const fileContent = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(fileContent);

      this.memoryCache.set(periode, {
        data: Array.isArray(data) ? data : [],
        timestamp: Date.now(),
      });

      logger.info(`Loaded ${data.length} records for periode ${periode}`);
    } catch (error) {
      logger.error(`Error loading hist_adjust data for ${periode}: ${error.message}`);
      this.memoryCache.set(periode, { data: [], timestamp: Date.now() });
    }
  }

  /**
   * Get data for a specific periode
   * @param {string} periode - Periode in YYYYMM format
   */
  async getData(periode) {
    if (!periode) return [];

    const cached = this.memoryCache.get(periode);

    if (!cached || Date.now() - cached.timestamp > this.cacheTTL) {
      await this.loadFromJson(periode);
      return (this.memoryCache.get(periode) || { data: [] }).data;
    }

    return cached.data;
  }

  /**
   * Get data for a range of months
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   */
  async getDataRange(dateFrom, dateTo) {
    let start = dateFrom ? dayjs(dateFrom) : dayjs().subtract(1, "month");
    const end = dateTo ? dayjs(dateTo) : dayjs();
    
    const periodes = [];
    let current = start.startOf("month");
    while (current.isBefore(end) || current.isSame(end, "month")) {
      periodes.push(current.format("YYYYMM"));
      current = current.add(1, "month");
    }

    const results = await Promise.all(periodes.map(p => this.getData(p)));
    return results.flat();
  }

  /**
   * Sync database data to JSON file for a specific periode
   * @param {string} periode - Periode in YYYYMM format
   */
  async syncToJson(periode) {
    if (!periode) {
      periode = dayjs().tz("Asia/Jakarta").format("YYYYMM");
    }

    let release;
    const jsonFilePath = this.getFilePath(periode);
    const backupPath = `${jsonFilePath}.backup.json`;
    
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      const exists = await fs
        .access(jsonFilePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        release = await lockfile.lock(jsonFilePath, {
          stale: 120000,
          retries: { retries: 10, factor: 2, minTimeout: 2000, maxTimeout: 10000 },
        });
        await fs.copyFile(jsonFilePath, backupPath);
      } else {
        await fs.writeFile(jsonFilePath, "[]");
        release = await lockfile.lock(jsonFilePath, {
          stale: 120000,
          retries: { retries: 10, factor: 2, minTimeout: 2000, maxTimeout: 10000 },
        });
      }

      const stream = createWriteStream(jsonFilePath, { encoding: "utf8" });
      await new Promise(resolve => stream.once("open", resolve));
      stream.write("[");

      let offset = 0;
      const limit = 5000;
      let total = 0;
      let first = true;

      const startOfMonth = dayjs(periode, "YYYYMM").startOf("month").toDate();
      const endOfMonth = dayjs(periode, "YYYYMM").endOf("month").toDate();

      while (true) {
        const records = await HistAdjust.findAll({
          where: {
            updtime: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          },
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

      await this.loadFromJson(periode);

      if (release) await release();
      await fs.unlink(backupPath).catch(() => {});

      logger.info(`Synced ${total} records to ${path.basename(jsonFilePath)}`);
      return { success: true, recordCount: total, periode };
    } catch (error) {
      try {
        const bakExists = await fs.access(backupPath).then(() => true).catch(() => false);
        if (bakExists) {
          await fs.copyFile(backupPath, jsonFilePath);
          await fs.unlink(backupPath).catch(() => {});
        }
      } catch {}
      if (release) {
        try { await release(); } catch {}
      }
      logger.error(`Error syncing hist_adjust for ${periode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform a full synchronization of all data from database to monthly JSON files
   */
  async syncAllFromDatabase() {
    try {
      // Get all records from database to identify which months have data
      const allRecords = await HistAdjust.findAll({
        attributes: ["updtime"],
        raw: true
      });

      if (allRecords.length === 0) {
        logger.info("No records found in database to sync");
        return { success: true, monthsProcessed: 0 };
      }

      // Group by periode
      const periodes = [...new Set(allRecords.map(r => this.getPeriodeFromDate(r.updtime)))];
      logger.info(`Starting full sync for ${periodes.length} months: ${periodes.join(", ")}`);

      for (const periode of periodes) {
        await this.syncToJson(periode);
      }

      logger.info(`Full synchronization complete for ${periodes.length} months`);
      return { success: true, monthsProcessed: periodes.length };
    } catch (error) {
      logger.error(`Failed to perform full synchronization: ${error.message}`);
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

      const insertedRecords = await HistAdjust.bulkCreate(historyRecords, {
        validate: true,
        ignoreDuplicates: false,
      });

      logger.info(`Bulk inserted ${insertedRecords.length} hist_adjust records`);

      const periodes = [...new Set(historyRecords.map(r => this.getPeriodeFromDate(r.updtime || new Date())))];
      
      for (const periode of periodes) {
        await this.syncToJson(periode);
      }

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
      let data = [];
      
      if (filters.dateFrom || filters.dateTo) {
        data = await this.getDataRange(filters.dateFrom, filters.dateTo);
      } else {
        const currentPeriode = dayjs().format("YYYYMM");
        data = await this.getData(currentPeriode);
      }

      let filteredData = [...data];

      if (filters.kdtk) {
        let kdtkList = [];
        if (Array.isArray(filters.kdtk)) {
          kdtkList = filters.kdtk.map(v => String(v).trim()).filter(Boolean);
        } else if (typeof filters.kdtk === "string") {
          kdtkList = filters.kdtk.split(",").map(v => v.trim()).filter(Boolean);
        }

        if (kdtkList.length > 0) {
          const set = new Set(kdtkList);
          filteredData = filteredData.filter(record => record.kdtk && set.has(String(record.kdtk).trim()));
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
        toDate.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(record => new Date(record.updtime) <= toDate);
      }

      filteredData.sort((a, b) => new Date(b.updtime) - new Date(a.updtime));

      const totalCount = filteredData.length;

      if (filters.limit) {
        const offset = filters.offset || 0;
        filteredData = filteredData.slice(offset, offset + filters.limit);
      }

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
   * Enrich data dengan fullName
   */
  async enrichWithUserData(records) {
    try {
      const uniquePics = [...new Set(records.map(r => r.pic).filter(Boolean))];
      if (uniquePics.length === 0) {
        records.forEach(record => { record.picFullName = null; });
        return;
      }

      const allUsers = await this.userService.getAllUsers();
      const userMap = new Map();
      uniquePics.forEach(pic => {
        const user = allUsers.find(u => u.username === pic);
        if (user) userMap.set(pic, user.fullName);
      });

      records.forEach(record => {
        record.picFullName = record.pic ? (userMap.get(record.pic) || record.pic) : null;
      });
    } catch (error) {
      logger.error(`Error enriching user data: ${error.message}`);
      records.forEach(record => { record.picFullName = record.pic || null; });
    }
  }

  /**
   * Get statistics from history data
   */
  async getStatistics(filters = {}) {
    try {
      const data = await this.getDataRange(filters.dateFrom, filters.dateTo);
      let filteredData = [...data];

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        filteredData = filteredData.filter(record => new Date(record.updtime) >= fromDate);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(record => new Date(record.updtime) <= toDate);
      }

      const totalRecords = filteredData.length;
      const successRecords = filteredData.filter(record => record.status === "SUCCESS").length;
      const failedRecords = filteredData.filter(record => record.status === "FAILED").length;

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
   * Clear expired cache entries
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
