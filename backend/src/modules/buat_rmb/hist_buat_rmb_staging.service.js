import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import logger from "../../config/logger.js";
import HistBuatRmb from "../../models/hist_buat_rmb.js";
import UserService from "../user/user.service.js";
import lockfile from "proper-lockfile";
import { Op } from "sequelize";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

class HistBuatRmbStagingService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data", "hist_buat_rmb");
    this.memoryCache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
    this.isInitialized = false;
    this.userService = new UserService();
  }

  getFilePath(periode) {
    return path.join(this.dataDir, `hist_buat_rmb_${periode}.json`);
  }

  getPeriodeFromDate(date) {
    return dayjs(date).tz("Asia/Jakarta").format("YYYYMM");
  }

  async getAvailablePeriodes() {
    try {
      const files = await fs.readdir(this.dataDir).catch(() => []);
      return files
        .filter(f => f.startsWith("hist_buat_rmb_") && f.endsWith(".json") && !f.includes("backup"))
        .map(f => f.replace("hist_buat_rmb_", "").replace(".json", ""))
        .sort((a, b) => b.localeCompare(a));
    } catch (error) {
      logger.error(`Error listing available periodes rmb: ${error.message}`);
      return [];
    }
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.isInitialized = true;
      logger.info("HistBuatRmb staging service initialized successfully with monthly file support");
    } catch (error) {
      logger.error(`Failed to initialize HistBuatRmb staging service: ${error.message}`);
      throw error;
    }
  }

  async loadFromJson(periode) {
    if (!periode) return;
    const filePath = this.getFilePath(periode);
    try {
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
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
    } catch (error) {
      logger.error(`Error loading hist_buat_rmb data for ${periode}: ${error.message}`);
      this.memoryCache.set(periode, { data: [], timestamp: Date.now() });
    }
  }

  async getData(periode) {
    if (!periode) return [];
    const cached = this.memoryCache.get(periode);
    if (!cached || Date.now() - cached.timestamp > this.cacheTTL) {
      await this.loadFromJson(periode);
      return (this.memoryCache.get(periode) || { data: [] }).data;
    }
    return cached.data;
  }

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

  async syncToJson(periode) {
    if (!periode) {
      periode = dayjs().tz("Asia/Jakarta").format("YYYYMM");
    }
    let release;
    const jsonFilePath = this.getFilePath(periode);
    const backupPath = `${jsonFilePath}.backup.json`;
    
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const exists = await fs.access(jsonFilePath).then(() => true).catch(() => false);

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
        const records = await HistBuatRmb.findAll({
          where: { updtime: { [Op.between]: [startOfMonth, endOfMonth] } },
          order: [["updtime", "DESC"]],
          offset,
          limit,
          raw: true,
        });
        if (!records.length) break;
        total += records.length;
        const mapped = records.map(record => ({
          ...record,
          updtime: dayjs(record.updtime).tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss"),
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
      logger.error(`Error syncing hist_buat_rmb for ${periode}: ${error.message}`);
      throw error;
    }
  }

  async syncAllFromDatabase() {
    try {
      const allRecords = await HistBuatRmb.findAll({ attributes: ["updtime"], raw: true });
      if (allRecords.length === 0) {
        return { success: true, monthsProcessed: 0 };
      }
      const periodes = [...new Set(allRecords.map(r => this.getPeriodeFromDate(r.updtime)))];
      for (const periode of periodes) {
        await this.syncToJson(periode);
      }
      return { success: true, monthsProcessed: periodes.length };
    } catch (error) {
      throw error;
    }
  }

  async bulkInsert(historyRecords) {
    try {
      if (!Array.isArray(historyRecords) || historyRecords.length === 0) {
        return { success: true, insertedCount: 0 };
      }
      const insertedRecords = await HistBuatRmb.bulkCreate(historyRecords, { validate: true, ignoreDuplicates: false });
      const periodes = [...new Set(historyRecords.map(r => this.getPeriodeFromDate(r.updtime || new Date())))];
      
      for (const periode of periodes) {
        await this.syncToJson(periode);
      }
      return {
        success: true,
        insertedCount: insertedRecords.length,
        records: insertedRecords.map(r => {
          const data = r.get({ plain: true });
          return {
            ...data,
            updtime: dayjs(data.updtime).tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss")
          };
        }),
      };
    } catch (error) {
      logger.error(`Error bulk inserting hist_buat_rmb records: ${error.message}`);
      throw error;
    }
  }

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
      return { success: true, data: filteredData, totalCount };
    } catch (error) {
      logger.error(`Error searching hist_buat_rmb records: ${error.message}`);
      throw error;
    }
  }

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
      records.forEach(record => { record.picFullName = record.pic || null; });
    }
  }

  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.timestamp && now - value.timestamp > this.cacheTTL) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export default new HistBuatRmbStagingService();
