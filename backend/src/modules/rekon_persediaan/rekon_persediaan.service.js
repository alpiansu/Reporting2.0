import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import logger from "../../config/logger.js";
import SaldoRekonPersediaan from "../../models/saldorekonpersediaan.model.js";
import dbStore from "../../config/db_store.js";
import config from "./rekon_persediaan.config.js";
import storeService from "../store/storeService.js";
import wrcBulananService from "../../services/wrc.service.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import progressService from "../progress/progress.service.js";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import screeningGuard from "../../utils/screeningGuard.js";
import { Op } from "sequelize";

const REKON_PERSEDIAAN_JSON_PATH = path.join(process.cwd(), "data/rekon_persediaan.json");
const wrcService = new wrcBulananService();

class RekonPersediaanService {
  constructor() {
    this.rekonData = [];
    this.initialized = false;
    this.lastLoadTime = null;
    this.TTL = 60 * 60 * 1000;
    this.isLoading = false;
  }

  async initialize() {
    try {
      const dir = path.dirname(REKON_PERSEDIAAN_JSON_PATH);
      await fs.mkdir(dir, { recursive: true });
      try {
        const data = await fs.readFile(REKON_PERSEDIAAN_JSON_PATH, "utf8");
        this.rekonData = JSON.parse(data);
      } catch (error) {
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.rekonData = [];
          await this.saveToFile();
        } else throw error;
      }
      this.initialized = true;
    } catch (error) {
      logger.error(`Initialize failed: ${error.message}`);
      throw error;
    }
  }

  async saveToFile() {
    try {
      await fs.writeFile(REKON_PERSEDIAAN_JSON_PATH, JSON.stringify(this.rekonData, null, 2));
    } catch (error) {
      logger.error(`Save failed: ${error.message}`);
      throw error;
    }
  }

  async ensureDataLoaded() {
    if (this.initialized && this.lastLoadTime && Date.now() - this.lastLoadTime < this.TTL) return;
    if (this.isLoading) {
      while (this.isLoading) await new Promise(r => setTimeout(r, 100));
      return;
    }
    try {
      this.isLoading = true;
      await this.initialize();
      this.lastLoadTime = Date.now();
    } finally {
      this.isLoading = false;
    }
  }

  async syncToJsonFile() {
    try {
      // Only sync records with RECID = '*' for display
      const dbData = await SaldoRekonPersediaan.findAll({
        where: { RECID: "*" },
      });
      this.rekonData = dbData.map(item => item.get({ plain: true }));
      await this.saveToFile();
      this.lastLoadTime = Date.now();
      this.initialized = true;
      return this.rekonData.length;
    } catch (error) {
      logger.error(`Sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process single store for rekon persediaan screening
   * @param {Object} store - Store object with storeCode and cab
   * @param {string} strPeriode - Period in YYMM format
   * @param {string} strYear - Year in YYYY format
   * @param {string} strMonth - Month in MM format
   * @param {Array} dates - Array of date strings to process
   * @param {Object} wrcContext - Pre-computed WRC context { wrcPool, branchWrcMap }
   * @param {Object|null} sharedConnection - Shared DB connection from combined screening
   * @returns {Promise<Object>} Result with success status and newRecordsCount
   */
  async processSingleStore(store, strPeriode, strYear, strMonth, dates, wrcContext, sharedConnection = null, options = {}) {
    const { storeCode, cab } = store;
    const results = { success: false, newRecordsCount: 0 };
    const isShared = !!sharedConnection;
    const { branchWrcMap } = wrcContext || {};
    const { suppressIntermediateLogs = false } = options;

    try {
      const storeInfo = await storeService.getStoreIPHost(storeCode);
      if (!storeInfo) {
        await RekapRemoteService.addToTemp(cab, storeCode, "rekon_persediaan", `[${storeCode}] store info not found`);
        return results;
      }

      const storeConn = isShared ? sharedConnection : await dbStore.createDbStore(storeInfo.dbHost, 2);

      if (!storeConn) {
        await RekapRemoteService.addToTemp(cab, storeCode, "rekon_persediaan", `[${storeCode}] failed to connect`);
        return results;
      }

      try {
        for (const date of dates) {
          try {
            // Fetch Store HPP
            const [rows] = await storeConn.query(config.queries.store, [date, date, date, date, date]);
            const sData = rows[0] || {};

            // Lookup WRC HPP from Cache
            const wData = (branchWrcMap && branchWrcMap.get(`${storeCode}_${date}`)) || {};

            const h_s = [
              Number(sData.HPP_DRY) || 0,
              Number(sData.HPP_ISTORE) || 0,
              Number(sData.HPP_RESTO) || 0,
              Number(sData.HPP_VIRTUAL) || 0,
              Number(sData.HPP_SPC_STORE) || 0,
            ];
            const h_w = [
              Number(wData.HPP_DRY) || 0,
              Number(wData.HPP_ISTORE) || 0,
              Number(wData.HPP_RESTO) || 0,
              Number(wData.HPP_VIRTUAL) || 0,
              Number(wData.HPP_SPC_STORE) || 0,
            ];
            const diffs = h_s.map((v, i) => v - h_w[i]);
            const hasDiff = diffs.some(d => Math.abs(d) > 100);

            if (hasDiff) {
              await SaldoRekonPersediaan.bulkCreate(
                [
                  {
                    CABANG: cab,
                    SHOP: storeCode,
                    TANGGAL: date,
                    RECID: "*",
                    HPP_DRY_STORE: h_s[0],
                    HPP_ISTORE_STORE: h_s[1],
                    HPP_RESTO_STORE: h_s[2],
                    HPP_VIRTUAL_STORE: h_s[3],
                    HPP_SPC_STORE_STORE: h_s[4],
                    HPP_DRY_WRC: h_w[0],
                    HPP_ISTORE_WRC: h_w[1],
                    HPP_RESTO_WRC: h_w[2],
                    HPP_VIRTUAL_WRC: h_w[3],
                    HPP_SPC_STORE_WRC: h_w[4],
                    SELISIH_DRY: diffs[0],
                    SELISIH_ISTORE: diffs[1],
                    SELISIH_RESTO: diffs[2],
                    SELISIH_VIRTUAL: diffs[3],
                    SELISIH_SPC: diffs[4],
                    LASTCATCH: new Date(),
                  },
                ],
                {
                  updateOnDuplicate: [
                    "HPP_DRY_STORE",
                    "HPP_ISTORE_STORE",
                    "HPP_RESTO_STORE",
                    "HPP_VIRTUAL_STORE",
                    "HPP_SPC_STORE_STORE",
                    "HPP_DRY_WRC",
                    "HPP_ISTORE_WRC",
                    "HPP_RESTO_WRC",
                    "HPP_VIRTUAL_WRC",
                    "HPP_SPC_STORE_WRC",
                    "SELISIH_DRY",
                    "SELISIH_ISTORE",
                    "SELISIH_RESTO",
                    "SELISIH_VIRTUAL",
                    "SELISIH_SPC",
                    "RECID",
                    "LASTCATCH",
                  ],
                },
              );
              results.newRecordsCount++;
            } else {
              // Resolve if previously existed but now matches
              await SaldoRekonPersediaan.update(
                { RECID: "1", LASTCATCH: new Date() },
                {
                  where: {
                    CABANG: cab,
                    SHOP: storeCode,
                    TANGGAL: date,
                    RECID: "*",
                  },
                },
              );
            }
          } catch (e) {
            logger.error(`[rekon_persediaan] Step Error ${storeCode} ${date}: ${e.message}`);
          }
        }

        results.success = true;

        if (!suppressIntermediateLogs) {
          await RekapRemoteService.addToTemp(
            cab, storeCode, "rekon_persediaan",
            `[${storeCode}] ${results.newRecordsCount > 0 ? "issue_found" : "success"}`,
          );
        }
      } finally {
        if (!isShared && storeConn) {
          await storeConn.end();
        }
      }
    } catch (err) {
      logger.error(`[rekon_persediaan] Store Error ${storeCode}: ${err.message}`);
      await RekapRemoteService.addToTemp(cab, storeCode, "rekon_persediaan", `Error: ${err.message}`);
    }

    return results;
  }

  async screening(options) {
    await storeService.ensureInitialized();
    const { cabang, periode, shops, username, fullName, force } = options;
    const taskId = `${config.taskProgressName}_${username}`;

    if (!/^\d{4}$/.test(periode)) throw new Error("Invalid period YYMM");
    const year = "20" + periode.substring(0, 2);
    const month = periode.substring(2, 4);

    // === PREPARE DATES (Up to yesterday if current month) ===
    const dates = [];
    const targetMoment = moment(`${year}-${month}`, "YYYY-MM");
    const today = moment();
    const isCurrentMonth = targetMoment.isSame(today, "month");
    const lastDay = isCurrentMonth ? today.date() - 1 : targetMoment.daysInMonth();

    for (let i = 1; i <= lastDay; i++) {
      dates.push(moment(`${year}-${month}-${i.toString().padStart(2, "0")}`).format("YYYY-MM-DD"));
    }
    if (dates.length === 0) throw new Error("No dates to process (cannot process future dates)");

    // === STEP 1: Collect Stores ===
    let storesToProcess = [];
    if (shops && shops.length > 0) {
      const allStores = storeService.stores;
      storesToProcess = allStores
        .filter(s => shops.some(code => code.toUpperCase() === (s.storeCode || s.kdtk || "").toUpperCase()))
        .map(s => ({ ...s, cab: s.branch || s.cab }));
    } else {
      const branches =
        cabang === "All" || cabang === "ALL"
          ? [...new Set(storeService.stores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))]
          : [cabang];

      const groups = await Promise.all(
        branches.map(cab => storeService.getStoresByBranch(cab, true).then(ss => ss.map(s => ({ ...s, cab })))),
      );
      storesToProcess = groups.flat();
    }

    // --- Progress tracking: 1 unit per STORE ---
    const totalSteps = storesToProcess.length;
    const skipProgress = totalSteps <= 1;

    if (!skipProgress) {
      await progressService.startProgress(taskId, totalSteps, {
        module: "rekon_persediaan",
        title: "Screening Rekon Persediaan",
        description: "registering task",
        startedBy: fullName || username,
        status: "registering",
      });
    }

    const withTimeout = (promise, ms, label) =>
      Promise.race([promise, new Promise((_, r) => setTimeout(() => r(new Error(`Timeout: ${label}`)), ms))]);
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);
    const wrcPools = new Map();
    const wrcDataCache = new Map(); // branch -> Map<storeCode_date, hppData>
    let processedStores = 0;
    let newRecordsCount = 0;

    const fetchWrcBatch = async (cab, pool) => {
      if (wrcDataCache.has(cab)) return wrcDataCache.get(cab);

      logger.info(`[rekon_persediaan] Batching WRC data for branch ${cab}...`);

      // 1. Get existing tables
      const [tables] = await pool.query("SHOW TABLES LIKE 'glslp_%'");
      const existingTableNames = tables.map(t => Object.values(t)[0]);

      // 2. Build UNION ALL query
      const queries = [];
      const params = [];

      for (const date of dates) {
        const table = `glslp_${moment(date).format("YYMMDD")}`;
        if (existingTableNames.includes(table)) {
          queries.push(`
                    SELECT KODE_TOKO, ? as AS_DATE,
                           SUM(CASE WHEN SUBKODE = '01' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_DRY,
                           SUM(CASE WHEN SUBKODE = '02' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_ISTORE,
                           SUM(CASE WHEN SUBKODE = '03' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_RESTO,
                           SUM(CASE WHEN SUBKODE = '06' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_VIRTUAL,
                           SUM(CASE WHEN SUBKODE = '07' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_SPC_STORE
                    FROM ${table}
                    WHERE KODE = 25
                    GROUP BY KODE_TOKO
                `);
          params.push(date);
        }
      }

      const branchDataMap = new Map();
      if (queries.length > 0) {
        const [rows] = await pool.query(queries.join(" UNION ALL "), params);
        for (const row of rows) {
          const key = `${row.KODE_TOKO}_${moment(row.AS_DATE).format("YYYY-MM-DD")}`;
          branchDataMap.set(key, row);
        }
      }

      wrcDataCache.set(cab, branchDataMap);
      return branchDataMap;
    };

    try {
      // === STEP 2: Flat Parallel Loop ===
      await Promise.all(
        storesToProcess.map(store =>
          limitStores(async () => {
            const { storeCode, cab } = store;

            // Check if task was cancelled before starting this store
            if (!skipProgress && progressService.isAborted(taskId)) {
              logger.info(`[rekon_persediaan] Skipping store ${storeCode} — task aborted`);
              processedStores++;
              if (!skipProgress)
                await progressService.updateProgress(taskId, processedStores, {
                  description: `Store ${storeCode} → Dibatalkan ⛔`,
                  status: "Processing",
                });
              return;
            }

            // === DAILY GUARD: Skip toko yang sudah sukses screening hari ini ===
            if (!force) {
              const guard = await screeningGuard.isSuccessToday("rekon_persediaan", storeCode);
              if (guard.screened) {
                processedStores++;
                if (!skipProgress)
                  await progressService.updateProgress(taskId, processedStores, {
                    description: `Store ${storeCode} → Skip (sudah screen ${guard.updtime})`,
                    status: "Processing",
                  });
                return;
              }
            }

            try {
              // Initialize Pool & Cache Batch WRC
              if (!wrcPools.has(cab)) {
                const wrcConfig = await wrcService.getConnWRC(cab);
                wrcPools.set(cab, mysql.createPool({ ...wrcConfig, connectionLimit: 10 }));
              }
              const wrcPool = wrcPools.get(cab);
              const branchWrcMap = await fetchWrcBatch(cab, wrcPool);

              const result = await this.processSingleStore(store, periode, year, month, dates, {
                wrcPool,
                branchWrcMap,
              });

              if (result.success) {
                newRecordsCount += result.newRecordsCount;
              }

              processedStores++;
              if (!skipProgress)
                await progressService.updateProgress(taskId, processedStores, {
                  description: `Store ${storeCode} ${result.success ? "processed" : "→ Error"}`,
                  status: "Processing",
                });
            } catch (err) {
              logger.error(`[rekon_persediaan] Store Error ${storeCode}: ${err.message}`);
              await RekapRemoteService.addToTemp(cab, storeCode, "rekon_persediaan", `Error: ${err.message}`);
              processedStores++;
              if (!skipProgress)
                await progressService.updateProgress(taskId, processedStores, {
                  description: `Store ${storeCode} → Error`,
                  status: "Processing",
                });
            }
          }),
        ),
      );

      // === STEP 3: Finalization ===
      // If task was cancelled during store processing, stop before finalizing
      if (!skipProgress && progressService.isAborted(taskId)) {
        logger.info(`[rekon_persediaan] Task ${taskId} was cancelled — skipping finalization`);
        throw new Error("Proses dibatalkan oleh pengguna");
      }

      await RekapRemoteService.saveLogsToDatabase();
      await this.syncToJsonFile();
      if (!skipProgress) {
        await progressService.completeProgress(taskId, {
          description: "All stores processed",
          status: "completed",
        });
      }

      return {
        success: true,
        message: "Screening completed",
        processedRecords: newRecordsCount,
      };
    } catch (error) {
      // If task was cancelled by user, don't call failProgress (already handled by cancelTask)
      if (!skipProgress && progressService.isAborted(taskId)) {
        logger.info(`[rekon_persediaan] Task ${taskId} was cancelled — skipping failProgress`);
        return {
          success: false,
          message: "Proses dibatalkan oleh pengguna",
          cancelled: true,
        };
      }

      if (!skipProgress)
        await progressService.failProgress(taskId, {
          description: error.message,
          status: "failed",
        });
      throw error;
    } finally {
      for (const pool of wrcPools.values()) await pool.end();
    }
  }

  async getSummary(opts = {}) {
    await this.ensureDataLoaded();
    const filtered = this.rekonData.filter(
      i =>
        (!opts.cabang || opts.cabang === "All" || i.CABANG === opts.cabang) &&
        (!opts.periode || moment(i.TANGGAL).format("YYMM") === opts.periode),
    );
    return {
      data: {
        jml_toko: new Set(filtered.map(i => i.SHOP)).size,
        total_selisih: filtered.reduce(
          (a, i) =>
            a +
            Math.abs(i.SELISIH_DRY) +
            Math.abs(i.SELISIH_ISTORE) +
            Math.abs(i.SELISIH_RESTO) +
            Math.abs(i.SELISIH_VIRTUAL) +
            Math.abs(i.SELISIH_SPC),
          0,
        ),
        total_records: filtered.length,
      },
    };
  }

  async getAllRecords(opts = {}) {
    await this.ensureDataLoaded();
    const { page = 1, limit = 10, cabang, periode, searchQuery, sortColumn = "TANGGAL", sortOrder = "DESC" } = opts;
    let filtered = this.rekonData.filter(
      i =>
        (!cabang || cabang === "All" || i.CABANG === cabang) &&
        (!periode || moment(i.TANGGAL).format("YYMM") === periode) &&
        (!searchQuery ||
          i.SHOP.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.CABANG.toLowerCase().includes(searchQuery.toLowerCase())),
    );
    const col = ["CABANG", "SHOP", "TANGGAL", "LASTCATCH"].includes(sortColumn) ? sortColumn : "TANGGAL";
    filtered.sort((a, b) => {
      let vA = a[col],
        vB = b[col];
      if (sortOrder.toUpperCase() === "DESC") [vA, vB] = [vB, vA];
      return vA > vB ? 1 : vA < vB ? -1 : 0;
    });
    return {
      data: {
        data: filtered.slice((page - 1) * limit, page * limit),
        total: filtered.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(filtered.length / limit),
      },
    };
  }
}

export default new RekonPersediaanService();
