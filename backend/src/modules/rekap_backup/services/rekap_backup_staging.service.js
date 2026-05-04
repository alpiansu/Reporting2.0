import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import logger from "../../config/logger.js";
import lockfile from "proper-lockfile";
import config from "../../config/index.js";
const { resilientDb } = config;

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

class RekapBackupStagingService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data", "rekap_backup");
    this.memoryCacheHarian = new Map();
    this.memoryCacheBulanan = new Map();
    this.cacheTTL = 15 * 60 * 1000; // 15 mins
    this.isInitialized = false;
  }

  getFilePath(type, periode) {
    return path.join(this.dataDir, `rekap_backup_${type}_${periode}.json`);
  }

  async getAvailablePeriodes(type) {
    try {
      const files = await fs.readdir(this.dataDir).catch(() => []);
      return files
        .filter(f => f.startsWith(`rekap_backup_${type}_`) && f.endsWith(".json") && !f.includes("backup"))
        .map(f => f.replace(`rekap_backup_${type}_`, "").replace(".json", ""))
        .sort((a, b) => b.localeCompare(a));
    } catch (error) {
      logger.error(`Error listing available periodes rekap_backup ${type}: ${error.message}`);
      return [];
    }
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.isInitialized = true;
      logger.info("RekapBackup staging service initialized successfully");
    } catch (error) {
      logger.error(`Failed to initialize RekapBackup staging service: ${error.message}`);
      throw error;
    }
  }

  async loadFromJson(type, periode) {
    if (!periode) return;
    const filePath = this.getFilePath(type, periode);
    const cache = type === 'harian' ? this.memoryCacheHarian : this.memoryCacheBulanan;
    
    try {
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        cache.set(periode, { data: [], timestamp: Date.now() });
        return;
      }
      const fileContent = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(fileContent);
      cache.set(periode, {
        data: Array.isArray(data) ? data : [],
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error loading rekap_backup_${type} data for ${periode}: ${error.message}`);
      cache.set(periode, { data: [], timestamp: Date.now() });
    }
  }

  async getData(type, periode) {
    if (!periode) return [];
    const cache = type === 'harian' ? this.memoryCacheHarian : this.memoryCacheBulanan;
    const cached = cache.get(periode);
    
    if (!cached || Date.now() - cached.timestamp > this.cacheTTL) {
      await this.loadFromJson(type, periode);
      return (cache.get(periode) || { data: [] }).data;
    }
    return cached.data;
  }

  async getAllData(type) {
    const periodes = await this.getAvailablePeriodes(type);
    const results = await Promise.all(periodes.map(p => this.getData(type, p)));
    return results.flat();
  }

  async syncToJson(type, periode) {
    if (!periode) return { success: false, message: "Periode is required" };
    
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    let release;
    const jsonFilePath = this.getFilePath(type, periode);
    const backupPath = `${jsonFilePath}.backup.json`;
    const tableName = type === 'harian' ? 'rekap_backup_harian' : 'rekap_backup_bulanan';
    
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

      // Query from Database for specific periode
      // Note: The period format in DB might be YYYY-MM or YYYYMM. 
      // The old project queried WHERE LEFT(periode,4) for years. Usually it's YYYY-MM-DD or YYYYMM.
      // We assume periode param is YYYYMM and the DB column is YYYYMM. If the DB is YYYY-MM, we adjust.
      // Let's select all matching that period.
      const queryStr = `SELECT * FROM ${tableName} WHERE LEFT(cabang,1)='G' AND REPLACE(periode, '-', '') LIKE '${periode}%'`;
      const [records] = await sequelize.query(queryStr);

      const stream = createWriteStream(jsonFilePath, { encoding: "utf8" });
      await new Promise(resolve => stream.once("open", resolve));
      stream.write("[");

      let first = true;
      for (const obj of records) {
        if (!first) stream.write(",");
        stream.write(JSON.stringify(obj));
        first = false;
      }

      stream.write("]");
      await new Promise((res, rej) => stream.end(err => (err ? rej(err) : res())));

      await this.loadFromJson(type, periode);
      if (release) await release();
      await fs.unlink(backupPath).catch(() => {});

      logger.info(`Synced ${records.length} records to ${path.basename(jsonFilePath)}`);
      return { success: true, recordCount: records.length, periode };
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
      logger.error(`Error syncing rekap_backup_${type} for ${periode}: ${error.message}`);
      throw error;
    }
  }

  async syncAllFromDatabase() {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    try {
      const result = { harian: 0, bulanan: 0 };
      
      for (const type of ['harian', 'bulanan']) {
        const tableName = type === 'harian' ? 'rekap_backup_harian' : 'rekap_backup_bulanan';
        const [periodes] = await sequelize.query(`SELECT DISTINCT REPLACE(LEFT(periode, 7), '-', '') AS prd FROM ${tableName} WHERE periode != '' AND periode IS NOT NULL`);
        
        for (const row of periodes) {
          const prd = row.prd;
          if (prd && prd.length >= 6) {
            await this.syncToJson(type, prd);
            result[type]++;
          }
        }
      }
      
      return { success: true, monthsProcessed: result };
    } catch (error) {
      logger.error(`Error in syncAllFromDatabase rekap_backup: ${error.message}`);
      throw error;
    }
  }
}

export default new RekapBackupStagingService();
