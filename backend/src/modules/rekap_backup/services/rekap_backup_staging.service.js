import fs from "fs/promises";
// createWriteStream tidak lagi dipakai setelah refactor ke JSON.stringify
import path from "path";
import logger from "../../../config/logger.js";
import lockfile from "proper-lockfile";
import config from "../../../config/index.js";
const { resilientDb } = config;

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Konversi semua field bertipe Date pada satu record
 * ke format string YYYY-MM-DD HH:mm:ss.
 * Sequelize secara default mengembalikan kolom DATETIME/TIMESTAMP
 * sebagai JavaScript Date object, yang akan di-serialize JSON.stringify
 * menjadi format Zulu (ISO 8601 dengan suffix Z). Fungsi ini mencegah hal itu.
 */
function normalizeRecord(record) {
  const result = {};
  for (const [key, val] of Object.entries(record)) {
    if (val instanceof Date) {
      result[key] = dayjs(val).format("YYYY-MM-DD HH:mm:ss");
    } else {
      result[key] = val;
    }
  }
  return result;
}

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
    const tableName = type === 'harian' ? 'db_edp.rekap_backup_harian' : 'db_edp.rekap_backup_bulanan';
    
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
      const queryStr = `SELECT * FROM ${tableName} WHERE LEFT(cabang,1)='G' AND REPLACE(periode, '-', '') LIKE '${periode}%'`;
      const [records] = await sequelize.query(queryStr);

      // Normalisasi field Date ke format YYYY-MM-DD HH:mm:ss
      // agar tidak tersimpan sebagai string Zulu (ISO 8601) di JSON
      const normalized = records.map(normalizeRecord);

      // Tulis JSON dengan pretty-print (indent 2 spasi) agar mudah dibaca manual
      await fs.writeFile(jsonFilePath, JSON.stringify(normalized, null, 2), "utf-8");

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

  /**
   * Generate file summary all yang menggabungkan seluruh periode dari memory cache.
   * File: rekap_backup_summary_all.json
   * Dipanggil otomatis setelah syncAllFromDatabase selesai.
   */
  async syncSummaryJson() {
    try {
      const summaryFilePath = path.join(this.dataDir, "rekap_backup_summary_all.json");

      logger.info(`Syncing summary all JSON...`);
      logger.info(`Process getting data harian...`);
      const allHarian = await this.getAllData('harian');
      logger.info(`Process getting data bulanan...`);
      const allBulanan = await this.getAllData('bulanan');

      const summaryMap = new Map();

      for (const row of allHarian) {
        if (!row.cabang) continue;
        const cab = row.cabang.trim().toUpperCase();
        if (!summaryMap.has(cab)) {
          summaryMap.set(cab, {
            cabang: cab,
            total_harian: 0, oldest_harian: null, newest_harian: null,
            total_bln: 0, oldest_bln: null, newest_bln: null,
          });
        }
        const s = summaryMap.get(cab);
        s.total_harian += (row.jml_cek || 0);
        if (row.periode) {
          if (!s.oldest_harian || row.periode < s.oldest_harian) s.oldest_harian = row.periode;
          if (!s.newest_harian || row.periode > s.newest_harian) s.newest_harian = row.periode;
        }
      }

      for (const row of allBulanan) {
        if (!row.cabang) continue;
        const cab = row.cabang.trim().toUpperCase();
        if (!summaryMap.has(cab)) {
          summaryMap.set(cab, {
            cabang: cab,
            total_harian: 0, oldest_harian: null, newest_harian: null,
            total_bln: 0, oldest_bln: null, newest_bln: null,
          });
        }
        const s = summaryMap.get(cab);
        if (row.jenis_file === 'IDT') s.total_bln += (row.jml_cek || 0);
        if (row.periode) {
          if (!s.oldest_bln || row.periode < s.oldest_bln) s.oldest_bln = row.periode;
          if (!s.newest_bln || row.periode > s.newest_bln) s.newest_bln = row.periode;
        }
      }

      const summaryArray = Array.from(summaryMap.values()).sort((a, b) => a.cabang.localeCompare(b.cabang));
      const meta = {
        generated_at: dayjs().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss"),
        total_cabang: summaryArray.length,
        data: summaryArray,
      };

      await fs.writeFile(summaryFilePath, JSON.stringify(meta, null, 2), "utf-8");
      logger.info(`Summary all JSON generated: ${summaryArray.length} cabang -> ${path.basename(summaryFilePath)}`);
      return { success: true, totalCabang: summaryArray.length };
    } catch (error) {
      logger.error(`Error generating summary all JSON: ${error.message}`);
      throw error;
    }
  }

  async syncAllFromDatabase() {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    try {
      const result = { harian: 0, bulanan: 0 };
      
      for (const type of ['harian', 'bulanan']) {
        const tableName = type === 'harian' ? 'db_edp.rekap_backup_harian' : 'db_edp.rekap_backup_bulanan';
        const [periodes] = await sequelize.query(`SELECT DISTINCT REPLACE(LEFT(periode, 7), '-', '') AS prd FROM ${tableName} WHERE periode != '' AND periode IS NOT NULL`);
        
        for (const row of periodes) {
          const prd = row.prd;
          if (prd && prd.length >= 6) {
            await this.syncToJson(type, prd);
            result[type]++;
          }
        }
      }
      
      // Generate summary all JSON setelah semua periode selesai di-sync
      await this.syncSummaryJson();

      return { success: true, monthsProcessed: result };
    } catch (error) {
      logger.error(`Error in syncAllFromDatabase rekap_backup: ${error.message}`);
      throw error;
    }
  }
}

export default new RekapBackupStagingService();
