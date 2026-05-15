import fs from "fs/promises";
// createWriteStream tidak lagi dipakai setelah refactor ke JSON.stringify
import path from "path";
import logger from "../../../config/logger.js";
import lockfile from "proper-lockfile";
import config from "../../../config/index.js";
import mysql from "mysql2/promise";
import WrcService from "../../../services/wrc.service.js";

const { resilientDb } = config;
const wrcService = new WrcService();

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
    this.memoryCacheSummary = null;
    this.cacheTTL = 15 * 60 * 1000; // 15 mins
    this.isInitialized = false;
  }

  getFilePath(type, identifier) {
    return path.join(this.dataDir, `rekap_backup_${type}_${identifier}.json`);
  }

  async getAvailableBranches(type) {
    try {
      const files = await fs.readdir(this.dataDir).catch(() => []);
      return files
        .filter(f => f.startsWith(`rekap_backup_${type}_`) && f.endsWith(".json") && !f.includes("summary") && !f.includes("backup"))
        .map(f => f.replace(`rekap_backup_${type}_`, "").replace(".json", ""))
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      logger.error(`Error listing available branches rekap_backup ${type}: ${error.message}`);
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

  async loadFromJson(type, cabang) {
    if (!cabang) return;
    const filePath = this.getFilePath(type, cabang);
    const cache = type === 'harian' ? this.memoryCacheHarian : this.memoryCacheBulanan;
    
    try {
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        cache.set(cabang, { data: [], timestamp: Date.now() });
        return;
      }
      const fileContent = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(fileContent);
      cache.set(cabang, {
        data: Array.isArray(data) ? data : [],
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error loading rekap_backup_${type} data for ${cabang}: ${error.message}`);
      cache.set(cabang, { data: [], timestamp: Date.now() });
    }
  }

  async getData(type, cabang) {
    if (!cabang) return [];
    const cache = type === 'harian' ? this.memoryCacheHarian : this.memoryCacheBulanan;
    const cached = cache.get(cabang);
    
    if (!cached || Date.now() - cached.timestamp > this.cacheTTL) {
      await this.loadFromJson(type, cabang);
      return (cache.get(cabang) || { data: [] }).data;
    }
    return cached.data;
  }

  async loadSummaryFromJson() {
    const summaryFilePath = path.join(this.dataDir, "rekap_backup_summary_all.json");
    try {
      const fileExists = await fs.access(summaryFilePath).then(() => true).catch(() => false);
      if (!fileExists) {
        this.memoryCacheSummary = { data: [], timestamp: Date.now() };
        return;
      }
      const fileContent = await fs.readFile(summaryFilePath, "utf-8");
      const json = JSON.parse(fileContent);
      this.memoryCacheSummary = {
        data: json.data || [],
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error loading rekap_backup_summary_all data: ${error.message}`);
      this.memoryCacheSummary = { data: [], timestamp: Date.now() };
    }
  }

  async getSummaryData() {
    if (!this.memoryCacheSummary || Date.now() - this.memoryCacheSummary.timestamp > this.cacheTTL) {
      await this.loadSummaryFromJson();
    }
    return this.memoryCacheSummary.data;
  }

  async getAllData(type) {
    const branches = await this.getAvailableBranches(type);
    const results = await Promise.all(branches.map(b => this.getData(type, b)));
    return results.flat();
  }

  async _syncTokoAktifInternal(cabang, periode) {
    if (!cabang || !periode) return 0;
    
    try {
      const wrcConfig = await wrcService.getConnWRC(cabang);
      const pool = mysql.createPool({
        host: wrcConfig.host,
        user: wrcConfig.user,
        password: wrcConfig.password,
        database: wrcConfig.database,
      });

      let formattedPeriode = periode;
      if (periode.length === 6) {
        formattedPeriode = `${periode.substring(0,4)}-${periode.substring(4,6)}-01`;
      }

      const strCountStore = `
        SELECT count(*) as stores FROM poscabang.mstr_toko_all
        WHERE
            DATE(tgl_buka) <= LAST_DAY(DATE('${formattedPeriode}'))
        AND
        (
            tok_tgl_tutup='0000-00-00'
            OR DATE(tok_tgl_tutup) >= DATE('${formattedPeriode}')
        )
      `;

      const [rows] = await pool.query(strCountStore);
      const countStores = rows[0]?.stores || 0;
      await pool.end();

      let sequelize = await resilientDb.getDatabase();
      if(!sequelize){
        sequelize = await resilientDb.forceReconnect();
      } 
      if (sequelize) {
        await sequelize.query(`UPDATE db_edp.rekap_backup_harian SET jml_toko_aktif = :count WHERE cabang = :cab AND periode = :prd`, {
          replacements: { count: countStores, cab: cabang, prd: periode }
        });
        await sequelize.query(`UPDATE db_edp.rekap_backup_bulanan SET jml_toko_aktif = :count WHERE cabang = :cab AND periode = :prd`, {
          replacements: { count: countStores, cab: cabang, prd: periode }
        });
      }

      return countStores;
    } catch (error) {
      logger.error(`Error in _syncTokoAktifInternal for ${cabang} - ${periode}: ${error.message}`);
      return 0;
    }
  }

  async syncToJson(type, cabang) {
    if (!cabang) return { success: false, message: "Cabang is required" };
    
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database not connected");

    let release;
    const jsonFilePath = this.getFilePath(type, cabang);
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

      // Query from Database for specific cabang (all periods)
      const queryStr = `SELECT * FROM ${tableName} WHERE cabang = '${cabang}' ORDER BY periode DESC`;
      const [records] = await sequelize.query(queryStr);

      // Normalisasi field Date ke format YYYY-MM-DD HH:mm:ss
      // agar tidak tersimpan sebagai string Zulu (ISO 8601) di JSON
      const normalized = records.map(normalizeRecord);

      // Otomatisasi sinkronisasi jml_toko_aktif jika NULL
      for (const record of normalized) {
        if (record.jml_toko_aktif === null) {
          const prd = record.periode ? record.periode.replace(/-/g, '').substring(0, 6) : null;
          if (prd) {
            logger.info(`Auto-syncing jml_toko_aktif for ${record.cabang} - ${prd} because value is NULL`);
            const count = await this._syncTokoAktifInternal(record.cabang, prd);
            record.jml_toko_aktif = count;
          }
        }
      }

      // Tulis JSON dengan pretty-print (indent 2 spasi) agar mudah dibaca manual
      await fs.writeFile(jsonFilePath, JSON.stringify(normalized, null, 2), "utf-8");

      await this.loadFromJson(type, cabang);
      if (release) await release();
      await fs.unlink(backupPath).catch(() => {});

      logger.info(`Synced ${records.length} records to ${path.basename(jsonFilePath)}`);
      return { success: true, recordCount: records.length, cabang };
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
      logger.error(`Error syncing rekap_backup_${type} for ${cabang}: ${error.message}`);
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
      const querySummaryHarian = `SELECT cabang, sum(jml_cek) AS total_bln, MIN(periode) AS oldest_bln, MAX(periode) AS newest_bln FROM db_edp.rekap_backup_bulanan where jenis_file='IDT' AND LEFT(CABANG,1) IN ('G') GROUP BY cabang;`;
      logger.info(`Process getting data bulanan...`);
      const querySummaryBulanan = `SELECT cabang, sum(jml_cek) AS total_harian, MIN(periode) AS oldest_harian, MAX(periode) AS newest_harian FROM db_edp.rekap_backup_harian WHERE LEFT(CABANG,1) IN ('G') GROUP BY cabang;`;

      let sequelize = await resilientDb.getDatabase();
      if(!sequelize){
        sequelize = await resilientDb.forceReconnect();
      } 
      if (!sequelize) throw new Error("Database not connected : " + resilientDb);

      const [allHarian] = await sequelize.query(querySummaryBulanan);
      const [allBulanan] = await sequelize.query(querySummaryHarian);

      const summaryMap = new Map();

      for (const row of allHarian) {
        if (!row.cabang) continue;

        const cab = row.cabang.trim().toUpperCase();

        if (!summaryMap.has(cab)) {
            summaryMap.set(cab, {
                cabang: cab,
                total_harian: 0,
                oldest_harian: null,
                newest_harian: null,
                total_bln: 0,
                oldest_bln: null,
                newest_bln: null
            });
        }

        const s = summaryMap.get(cab);

        s.total_harian = row.total_harian || 0;
        s.oldest_harian = row.oldest_harian;
        s.newest_harian = row.newest_harian;
      }

      for (const row of allBulanan) {
        if (!row.cabang) continue;

        const cab = row.cabang.trim().toUpperCase();

        if (!summaryMap.has(cab)) {
            summaryMap.set(cab, {
                cabang: cab,
                total_harian: 0,
                oldest_harian: null,
                newest_harian: null,
                total_bln: 0,
                oldest_bln: null,
                newest_bln: null
            });
        }

        const s = summaryMap.get(cab);

        s.total_bln = row.total_bln || 0;
        s.oldest_bln = row.oldest_bln;
        s.newest_bln = row.newest_bln;
      }

      const summaryArray = Array.from(summaryMap.values()).sort((a, b) => a.cabang.localeCompare(b.cabang));
      const meta = {
        generated_at: dayjs().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss"),
        total_cabang: summaryArray.length,
        data: summaryArray,
      };

      await fs.writeFile(summaryFilePath, JSON.stringify(meta, null, 2), "utf-8");
      await this.loadSummaryFromJson();
      logger.info(`Summary all JSON generated: ${summaryArray.length} cabang -> ${path.basename(summaryFilePath)}`);
      return { success: true, totalCabang: summaryArray.length };
    } catch (error) {
      logger.error(`Error generating summary all JSON: ${error.message}`);
      throw error;
    }
  }

  async syncAllFromDatabase() {
    let sequelize = await resilientDb.getDatabase();
    if(!sequelize){
      sequelize = await resilientDb.forceReconnect();
    }   
    if (!sequelize) throw new Error("Database not connected");

    try {
      const result = { harian: 0, bulanan: 0 };
      
      // Get all unique cabangs
      const [cabangs] = await sequelize.query(`
        SELECT DISTINCT cabang FROM db_edp.rekap_backup_harian WHERE LEFT(cabang,1)='G'
        UNION
        SELECT DISTINCT cabang FROM db_edp.rekap_backup_bulanan WHERE LEFT(cabang,1)='G'
      `);
      
      for (const row of cabangs) {
        const cab = row.cabang;
        if (cab) {
          await this.syncToJson('harian', cab);
          await this.syncToJson('bulanan', cab);
          result.harian++;
          result.bulanan++;
        }
      }
      
      // Generate summary all JSON setelah semua cabang selesai di-sync
      await this.syncSummaryJson();

      return { success: true, branchesProcessed: result };
    } catch (error) {
      logger.error(`Error in syncAllFromDatabase rekap_backup: ${error.message}`);
      throw error;
    }
  }
}

export default new RekapBackupStagingService();
