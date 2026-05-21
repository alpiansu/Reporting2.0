/**
 * Service for Penyesuaian (Sesuai Toko)
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import SesuaiToko from "./penyesuaian.model.js";
import SesuaiTokoSummary from "./penyesuaian_summary.model.js";
import dbStore from "../../config/db_store.js";
import config from "./penyesuaian.config.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import notesService from "../notes/notes.service.js";
import progressService from "../progress/progress.service.js";
import { isNumericString, toNumber, formatNumber } from "../../utils/numberUtils.js";
import { fileUtils } from "../../utils/index.js";

// Path untuk folder JSON penyesuaian (akan di-split per periode)
const PENYESUAIAN_DATA_DIR = path.join(process.cwd(), "data/penyesuaian");

class PenyesuaianService {
  constructor() {
    this.penyesuaianData = [];
    this.loadedPeriod = null; // Menandakan periode mana yang sedang di-load di memory

    // TTL Cache Management
    this.lastLoadTime = null;
    this.TTL = 15 * 60 * 1000; // Dikurangi ke 15 menit agar lebih responsif terhadap update database
    this.isLoading = false; // Prevent concurrent loading

    // 🔥 New multi-key cache for database records (per kdtk/cabang)
    this.cacheDetailData = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Mendapatkan path file JSON untuk periode tertentu
   */
  getJsonPath(periode) {
    if (!periode) return null;
    return path.join(PENYESUAIAN_DATA_DIR, `penyesuaian_${periode}.json`);
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize(periode) {
    if (!periode) throw new Error("Periode is required for initialization");
    try {
      await fs.mkdir(PENYESUAIAN_DATA_DIR, { recursive: true });

      const jsonPath = this.getJsonPath(periode);
      try {
        const data = await fileUtils.readFileWithRetry(jsonPath);
        this.penyesuaianData = JSON.parse(data);
        this.loadedPeriod = periode;
        logger.info(`Loaded ${this.penyesuaianData.length} records for period ${periode} from JSON`);
      } catch (err) {
        if (err.code === "ENOENT") {
          this.penyesuaianData = [];
          this.loadedPeriod = periode;
          await this.saveToFile(periode);
        } else throw err;
      }
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to initialize period ${periode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save penyesuaian data to JSON file for a specific period
   */
  async saveToFile(periode) {
    if (!periode) throw new Error("Periode is required to save data");
    try {
      const jsonPath = this.getJsonPath(periode);
      await fileUtils.writeAtomicWithRetry(jsonPath, JSON.stringify(this.penyesuaianData, null, 2));
      logger.debug(`Saved ${this.penyesuaianData.length} records to JSON file: ${jsonPath}`);
    } catch (error) {
      logger.error(`Failed to save penyesuaian period ${periode} to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate cache key based on periode, cabang, and kdtk
   */
  generateCacheKey(periode, cabang, kdtk) {
    return JSON.stringify({ periode, cabang, kdtk });
  }

  /**
   * Check if cache entry is still valid (based on lastAccessTime)
   */
  isCacheFromDbValid(entry) {
    if (!entry) return false;
    const now = Date.now();
    return now - entry.lastAccessTime < this.cacheTTL;
  }

  /**
   * Load data langsung dari database sesuai filter
   * Jika kdtk ada → abaikan cabang, else filter by cabang
   */
  async loadRecordsDetailFromDb({ periode, cabang, kdtk }) {
    const model = await SesuaiToko.getModel();
    const sequelize = model.sequelize;
    const { Sequelize } = await import("sequelize");

    const whereClauses = [`PERIODE = :periode`, `RECID = '*'`, `ABS(SESUAI) > 1000 `];
    const replacements = { periode };

    if (kdtk) {
      whereClauses.push(`KDTK = :kdtk`);
      replacements.kdtk = kdtk;
    } else if (cabang && cabang !== "All") {
      whereClauses.push(`CABANG = :cabang`);
      replacements.cabang = cabang;
    }

    const query = `
    SELECT RECID_PRODMAST AS RECID, PRDCD, SINGKATAN, PTAG, 
    CAST(SESUAI AS SIGNED) AS SESUAI,
    CAST(BEGBAL AS SIGNED) AS BEGBAL,
    CAST(TRFIN AS SIGNED) AS TRFIN,
    CAST(TRFOUT AS SIGNED) AS TRFOUT,
    CAST(RP_SALES AS SIGNED) AS RP_SALES,
    CAST(RP_RETUR_SALES AS SIGNED) AS RP_RETUR_SALES,
    CAST(ADJ AS SIGNED) AS ADJ,
    CAST(BA AS SIGNED) AS BA,
    CAST(BS AS SIGNED) AS BS,
    CAST(ACOST AS SIGNED) AS ACOST,
    CAST(LCOST AS SIGNED) AS LCOST,
    CAST(STOCK AS SIGNED) AS STOCK,
    CAST(RP_STOCK AS SIGNED) AS RP_STOCK
    FROM sesuai_toko
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY SESUAI DESC
  `;

    const records = await sequelize.query(query, {
      replacements,
      type: Sequelize.QueryTypes.SELECT,
    });

    logger.info(
      `[penyesuaian.service] Loaded ${records.length} records from DB for periode=${periode}, cabang=${
        cabang || "-"
      }, kdtk=${kdtk || "-"}`
    );
    return records;
  }

  /**
   * Optional: Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.cacheDetailData.entries()) {
      if (now - entry.lastAccessTime > this.cacheTTL) {
        this.cacheDetailData.delete(key);
        logger.debug(`[penyesuaian.service] Cache expired & removed for key=${key}`);
      }
    }
  }

  /**
   * Check if cached data is still valid based on TTL
   * @returns {boolean} True if cache is valid, false if expired
   */
  isCacheValid(periode) {
    if (!this.loadedPeriod || this.loadedPeriod !== periode || !this.lastLoadTime) {
      return false;
    }

    const now = Date.now();
    const isExpired = now - this.lastLoadTime > this.TTL;
    return !isExpired;
  }

  /**
   * Invalidate cache manually
   */
  invalidateCache() {
    this.penyesuaianData = [];
    this.loadedPeriod = null;
    this.lastLoadTime = null;
    this.isLoading = false;
    this.cacheDetailData.clear();
    logger.info("Penyesuaian cache invalidated manually");
  }

  /**
   * Ensure data is loaded with TTL-based lazy loading
   * Only loads data when needed and cache is expired
   */
  async ensureDataLoaded(periode) {
    if (!periode) throw new Error("Periode is required to load data");

    // If cache is still valid for this period, skip
    if (this.isCacheValid(periode)) {
      return;
    }

    // Prevent concurrent loading
    if (this.isLoading) {
      // Wait for ongoing loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.isLoading = true;
      logger.info(`Loading penyesuaian data for period ${periode} (cache expired or wrong period)`);

      await this.initialize(periode);
      this.lastLoadTime = Date.now();

      logger.info(
        `Data loaded successfully for ${periode}. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔁 Sync data ke JSON file hanya berupa hasil agregasi SUM(SESUAI) untuk periode tertentu
   */
  async syncToJsonFile(periode) {
    if (!periode) throw new Error("Periode is required for sync");
    try {
      // 🛠️ ALUR BARU: Ambil data resume langsung dari tabel summary
      const rows = await SesuaiTokoSummary.findAll({
        where: { PERIODE: periode }
      });

      this.penyesuaianData = rows.map(r => ({
        CABANG: r.CABANG,
        KDTK: r.KDTK,
        PERIODE: r.PERIODE,
        SESUAI: Number(r.SESUAI) || 0,
        UPDTIME: r.UPDTIME,
        RECID: r.RECID, // Simpan status RECID ke JSON
      }));

      await this.saveToFile(periode);
      this.loadedPeriod = periode;
      this.lastLoadTime = Date.now();

      logger.info(`[penyesuaian.service] Synced ${this.penyesuaianData.length} records from Summary to JSON for period ${periode}`);
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to sync data for period ${periode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🛠️ Fungsi baru untuk mengupdate tabel summary berdasarkan data detail (Upsert)
   * Berfungsi sebagai "Single Source of Truth" untuk resume per toko.
   */
  async updateSummaryFromRecords(records) {
    if (!records || records.length === 0) return;

    try {
      const { CABANG, KDTK, PERIODE } = records[0];
      
      // Hitung total SESUAI in-memory
      const totalSesuai = records.reduce((sum, rec) => sum + (Number(rec.SESUAI) || 0), 0);
      const maxUpdTime = records.reduce((max, rec) => {
        const current = new Date(rec.UPDTIME);
        return current > max ? current : max;
      }, new Date(0));

      await SesuaiTokoSummary.upsert({
        CABANG,
        KDTK,
        PERIODE,
        SESUAI: totalSesuai,
        UPDTIME: maxUpdTime,
        RECID: '*', // Jika ada records detail, berarti statusnya unresolved
      });

      logger.debug(`[penyesuaian.service] Summary updated for ${KDTK} (${PERIODE}): SESUAI=${totalSesuai}`);
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to update summary from records: ${error.message}`);
    }
  }

  /**
   * 🛠️ Fungsi baru untuk mengupdate status summary menjadi Resolved ('1')
   * Aturan: RECID = '1', SESUAI dan UPDTIME tetap dipertahankan sebagai informasi historis.
   */
  async markSummaryAsResolved(params) {
    const { periode, kdtk, cabang } = params;
    try {
      // Kita hanya update RECID menjadi '1'. SESUAI dan UPDTIME dibiarkan (Historical).
      await SesuaiTokoSummary.update({ RECID: '1' }, {
        where: { PERIODE: periode, KDTK: kdtk }
      });
      logger.debug(`[penyesuaian.service] Summary marked as RESOLVED for ${kdtk} (${periode})`);
    } catch (error) {
      logger.error(`[penyesuaian.service] Failed to mark summary as resolved: ${error.message}`);
    }
  }

  /**
   * Calculate previous periode (1 month before)
   * @param {string} periode - Current periode in YYMM format
   * @returns {string} Previous periode in YYMM format
   */
  getPreviousPeriode(periode) {
    const currentDate = moment(periode, "YYMM");
    const previousDate = currentDate.subtract(1, "months");
    return previousDate.format("YYMM");
  }

  /**
   * Generate filetToko table name
   * @param {string} kdtk - Store code
   * @param {string} periode - Current periode in YYMM format
   * @returns {string} Table name (e.g., TW752510)
   */
  getFiletTokoTableName(kdtk, periode) {
    const previousPeriode = this.getPreviousPeriode(periode);
    return `${kdtk}${previousPeriode}`;
  }

  /**
   * Process single store screening
   * @param {Object} store - Store object with storeCode and cab
   * @param {string} strPeriode - Period in YYMM format
   * @param {string} strYear - Year in YYYY format
   * @param {string} strMonth - Month in MM format
   * @returns {Promise<Object>} Result with success status, records, and hasIssue flag
   */
  async processSingleStore(store, strPeriode, strYear, strMonth) {
    const { storeCode, cab } = store;
    const results = { success: false, records: [], hasIssue: false };

    try {
      // --- Store info --- //
      const storeInfo = await storeService.getStoreIPHost(storeCode);

      if (!storeInfo) {
        await RekapRemoteService.addToTemp(cab, storeCode, "penyesuaian", `[${storeCode}] store info not found`);
        return results;
      }

      // --- Create DB connection --- //
      const storeConnection = await dbStore.createDbStore(storeInfo.dbHost, config.connectionRetry.maxRetries);

      if (!storeConnection) {
        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "penyesuaian",
          `[${storeCode}] failed to connect after ${config.connectionRetry.maxRetries} attempts`
        );
        return results;
      }

      try {
        // Generate filetToko table name
        const filetToko = this.getFiletTokoTableName(storeCode, strPeriode);

        // STEP 1: Run filter query to check if store has data exceeding threshold
        const filterQuery = config.queries.filter(filetToko, strPeriode, strMonth, strYear);
        const [filterResult] = await storeConnection.query(filterQuery, [strMonth, strYear, strMonth, strYear]);

        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "penyesuaian",
          `[${storeCode}] filter query completed, threshold check: ${filterResult.length > 0 ? "EXCEEDED" : "OK"}`
        );

        // 🛑 ALUR BARU: Hapus data lama berdasarkan KDTK & PERIODE sebelum proses lebih lanjut
        await SesuaiToko.destroy({ where: { KDTK: storeCode, PERIODE: strPeriode } });

        // STEP 2: If threshold exceeded, run detail query
        if (filterResult.length > 0) {
          const detailQuery = config.queries.detail(filetToko, strPeriode, strMonth, strYear);
          const [detailResult] = await storeConnection.query(detailQuery, [strMonth, strYear, strMonth, strYear]);

          await RekapRemoteService.addToTemp(
            cab,
            storeCode,
            "penyesuaian",
            `[${storeCode}] detail query completed, got ${detailResult.length} records`
          );

          if (detailResult.length > 0) {
            // Normalize field names to match model (uppercase)
            const normalizedRecords = detailResult.map(record => ({
              RECID: "*", // Default value for tracking
              CABANG: record.CAB,
              PERIODE: record.PERIODE,
              KDTK: record.KDTK,
              PRDCD: record.PRDCD,
              SINGKATAN: record.SINGKATAN,
              RECID_PRODMAST: record.RECID_PRODMAST,
              PTAG: record.PTAG,
              BEGBAL: record.BEGBAL,
              TRFIN: record.TRFIN,
              TRFOUT: record.TRFOUT,
              RP_SALES: record.RP_SALES,
              RP_RETUR_SALES: record.RP_RETUR_SALES,
              ADJ: record.ADJ,
              BA: record.BA,
              BS: record.BS,
              ACOST: record.ACOST,
              LCOST: record.lcost,
              STOCK: record.stock,
              RP_STOCK: record.rp_stock,
              SESUAI: record.sesuai,
              UPDTIME: new Date(),
            }));

            // Bulk create records to database (detail table)
            await SesuaiToko.bulkCreate(normalizedRecords);

            // 🛠️ ALUR BARU: Update Summary dari records (status '*')
            await this.updateSummaryFromRecords(normalizedRecords);

            results.records = normalizedRecords;
            results.hasIssue = true; // Store has issues
            results.success = true;
          }
        } else {
          // 🛠️ ALUR BARU: Toko dibawah threshold (Bersih)
          // 1. Hapus data detail (sdh dilakukan diatas via SesuaiToko.destroy)
          // 2. Mark status summary as Resolved ('1'), tapi nilai SEUSAI & UPDTIME lama tetap dipertahankan
          await this.markSummaryAsResolved({ periode: strPeriode, kdtk: storeCode, cabang: cab });

          results.success = true; // Below threshold is still success
          results.hasIssue = false; // No issues
        }
      } finally {
        await storeConnection.end();
      }
    } catch (err) {
      await RekapRemoteService.addToTemp(cab, storeCode, "penyesuaian", `[${storeCode}] ERROR: ${err.message}`);
    }

    return results;
  }

  /**
   * Screening stores to penyesuaian based on store query
   * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
   */
  async screening(options) {
    // Ensure storeService is initialized
    await storeService.ensureInitialized();

    const { cabang, periode, kdtk, username } = options;

    // === LEVEL 3: Single Store Screening (No Progress Task) ===
    if (kdtk) {
      logger.info(`[penyesuaian.service] Starting single store screening: ${kdtk}, periode: ${periode}`);

      try {
        // Get store info to determine cabang
        const storeInfo = await storeService.getStoreByCode(kdtk);
        const storeCab = storeInfo ? storeInfo.branch || storeInfo.cab : "UNKNOWN";

        // Convert periode
        const strPeriode = periode;
        const strYear = moment(periode, "YYMM").format("YYYY");
        const strMonth = moment(periode, "YYMM").format("MM");

        // Process single store
        const result = await this.processSingleStore({ storeCode: kdtk, cab: storeCab }, strPeriode, strYear, strMonth);

        // Save logs to database
        await RekapRemoteService.saveLogsToDatabase();

        // Update resolved records for this specific store
        // Level 3: Update all records of this store that are not in current screening result
        await this.updateResolvedRecords({
          periode: strPeriode,
          level: 3,
          kdtk: kdtk,
          hasIssue: result.hasIssue,
        });

        // Invalidate cache to force reload from JSON file on next request
        this.invalidateCache();

        // Sync to JSON file
        await this.syncToJsonFile(strPeriode);

        return {
          success: true,
          message: `Single store screening completed for ${kdtk}`,
          processedRecords: result.records.length,
        };
      } catch (error) {
        logger.error(`[penyesuaian.service] Error during single store screening: ${error.message}`);
        throw error;
      }
    }

    // === LEVEL 1 & 2: Multi-Store Screening (With Progress Task) ===
    const taskId = `${config.taskProgressName}_${username}`;
    const limitBranches = pLimit(config.parallelProcessing.branchConcurrencyLimit);
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);

    const withTimeout = (promise, ms, label) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
      ]);
    };

    try {
      // === STEP 1: Branches ===
      let branches = [];
      if (cabang === "All" || cabang === "ALL") {
        const allStores = storeService.stores;
        branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
      } else {
        branches = [cabang];
      }

      logger.info(`[penyesuaian.service] Branches to process: ${branches.join(", ")}`);

      // === STEP 2: Collect all stores ===
      const storeGroups = await Promise.all(
        branches.map(cab =>
          limitBranches(async () => {
            const stores = await storeService.getStoresByBranch(cab, true);
            logger.info(`[penyesuaian.service] Found ${stores.length} stores for branch ${cab}`);
            // tambahkan info cabang ke tiap store
            return stores.map(s => ({ ...s, cab }));
          })
        )
      );

      const storesToProcess = storeGroups.flat();

      logger.info(`[penyesuaian.service] Total stores to process: ${storesToProcess.length}`);

      // Register progress task
      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, storesToProcess.length, {
          module: "penyesuaian",
          title: "Screening Penyesuaian",
          description: "registering task",
          startedBy: username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(`Progress task registered for user ${username}, taskId: ${taskId}`);
      } catch (error) {
        logger.error(`Error registering progress task: ${error.message}`);

        if (error.message.includes("Maximum concurrent")) {
          await progressService.failProgress(taskId, {
            description: `Task failed: ${error.message}`,
            status: "failed",
          });
          throw new Error("[service penyesuaian] System is busy processing other tasks");
        }

        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
        throw new Error("[service penyesuaian] Failed to register progress task");
      }

      logger.info(`[penyesuaian.service] Starting screening for branches: ${branches.join(", ")}`);

      // === PREPARE PROCESSING ===
      // Convert from string periode (YYMM)
      const strPeriode = periode;
      const strYear = moment(periode, "YYMM").format("YYYY");
      const strMonth = moment(periode, "YYMM").format("MM");

      // Track stores: screened vs active (has issues)
      const newRecords = [];
      const screenedStores = new Set(); // All stores that were processed (success or error)
      const activeStores = new Set(); // Stores that still have issues

      let processedCount = 0;
      const totalStores = storesToProcess.length;

      const incrementProgress = async (storeCode, statusText) => {
        processedCount++;

        await progressService.updateProgress(taskId, processedCount, {
          description: `Store ${storeCode} → ${statusText} (${processedCount}/${totalStores})`,
          status: "Screening to Stores",
        });
      };

      // step 3, loop each stores asynchronously
      await Promise.all(
        storesToProcess.map(store =>
          limitStores(async () => {
            const { cab, storeCode } = store;

            // Always mark as screened (even if error/timeout)
            screenedStores.add(storeCode);

            try {
              const result = await withTimeout(
                this.processSingleStore(store, strPeriode, strYear, strMonth),
                config.parallelProcessing.storeTimeoutMs,
                `process store ${storeCode}`
              );

              if (result.success) {
                // logger.info(`[penyesuaian.service] value result: ${JSON.stringify(result)}`);
                if (result.hasIssue) {
                  // Store has issues
                  activeStores.add(storeCode);
                  newRecords.push(...result.records);
                  await incrementProgress(storeCode, `Success ✅ (${result.records.length} rows)`);
                } else {
                  // Store below threshold (no issues)
                  await incrementProgress(storeCode, "Masih Dibawah Nilai Toleransi ✓");
                }
              } else {
                await incrementProgress(storeCode, "Error ❌");
              }
            } catch (err) {
              await RekapRemoteService.addToTemp(cab, storeCode, "penyesuaian", `[${storeCode}] ERROR: ${err.message}`);
              await incrementProgress(storeCode, "Error ❌");
            }
          })
        )
      );

      logger.info(`[penyesuaian.service] Screening process completed for periode ${periode}`);
      logger.info(
        `[penyesuaian.service] Screened stores: ${screenedStores.size}, Active stores (has issues): ${activeStores.size}`
      );

      //update status to progress service
      await progressService.updateProgress(taskId, processedCount, {
        description: "Updating resolved records (RECID = 1)",
        status: "finalizing",
      });

      // Update resolved records
      // Level 1 or 2: Update stores that were screened but no longer have issues
      await this.updateResolvedRecords({
        periode: strPeriode,
        level: cabang === "All" || cabang === "ALL" ? 1 : 2,
        cabang: cabang === "All" || cabang === "ALL" ? null : cabang,
        screenedStores: Array.from(screenedStores),
        activeStores: Array.from(activeStores),
      });

      //update status to progress service
      await progressService.updateProgress(taskId, processedCount, {
        description: "Saving logs to database",
        status: "finalizing",
      });

      // Save logs to database
      await RekapRemoteService.saveLogsToDatabase();

      //update status to progress service
      await progressService.updateProgress(taskId, processedCount, {
        description: "Syncing data to JSON file, please wait...",
        status: "finalizing",
      });

      // Sync database to JSON file after write operations
      await this.syncToJsonFile(strPeriode);
      logger.info(`Synchronized ${newRecords.length} new records from database to JSON file`);

      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed",
        status: "completed",
        completedAt: timeCompleted,
      });

      return {
        success: true,
        message: "Screening process completed",
        processedRecords: newRecords.length,
        screenedStores: screenedStores.size,
        activeStores: activeStores.size,
        resolvedStores: screenedStores.size - activeStores.size,
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error during screening: ${error.message}`);

      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });

      throw error;
    }
  }

  /**
   * Update RECID to '1' for records that no longer meet the threshold
   * IMPORTANT: Only update records with RECID='*' to preserve UPDTIME
   *
   * @param {Object} params - Update parameters
   * @param {string} params.periode - Period in YYMM format
   * @param {number} params.level - Screening level (1=All cabang, 2=1 cabang, 3=1 toko)
   * @param {string} [params.cabang] - Branch code (for level 2)
   * @param {string} [params.kdtk] - Store code (for level 3)
   * @param {boolean} [params.hasIssue] - Does the store have issues? (for level 3)
   * @param {Array<string>} [params.screenedStores] - Stores that were screened (for level 1 & 2)
   * @param {Array<string>} [params.activeStores] - Stores that still have issues (for level 1 & 2)
   */
  async updateResolvedRecords(params) {
    const { periode, level, cabang, kdtk, hasIssue, screenedStores, activeStores } = params;

    try {
      // Get the database instance
      const model = await SesuaiToko.getModel();
      const sequelize = model.sequelize;
      const { Sequelize } = await import("sequelize");

      // 🛑 ALUR BARU: Hapus Detail & Update Status Summary
      // LEVEL 3: Single Store
      if (level === 3) {
        if (hasIssue) {
          logger.info(`[penyesuaian.service] Level 3: Store ${kdtk} has issues, skip resolve update`);
          return 0;
        } else {
          // Hapus data detail
          await SesuaiToko.destroy({ where: { PERIODE: periode, KDTK: kdtk } });
          // Mark summary as resolved
          await this.markSummaryAsResolved({ periode, kdtk });
          logger.info(`[penyesuaian.service] Level 3: Resolved store ${kdtk} (details deleted, summary status '1')`);
          return 1;
        }
      }
      
      // LEVEL 1 & 2: Multi Stores (Screened but no longer has issues)
      const storesToResolve = [];
      if (screenedStores && screenedStores.length > 0) {
        for (const sCode of screenedStores) {
          if (!activeStores || !activeStores.includes(sCode)) {
            storesToResolve.push(sCode);
          }
        }
      }

      if (storesToResolve.length === 0) {
        logger.info(`[penyesuaian.service] No resolved stores to update`);
        return 0;
      }

      // BATCHING: Split storesToResolve into chunks to avoid database locks
      const BATCH_SIZE = 500;
      let totalUpdated = 0;

      for (let i = 0; i < storesToResolve.length; i += BATCH_SIZE) {
        const chunk = storesToResolve.slice(i, i + BATCH_SIZE);

        // 1. Hapus dari tabel detail
        const deleteCount = await SesuaiToko.destroy({
          where: {
            PERIODE: periode,
            KDTK: { [Sequelize.Op.in]: chunk }
          }
        });

        // 2. Update status Summary menjadi '1' (Resolved)
        // Kita gunakan update langsung ke model SesuaiTokoSummary
        const [summaryUpdateCount] = await SesuaiTokoSummary.update({ RECID: '1' }, {
          where: {
            PERIODE: periode,
            KDTK: { [Sequelize.Op.in]: chunk }
          }
        });

        totalUpdated += summaryUpdateCount;
        logger.debug(`[penyesuaian.service] Resolved batch ${Math.floor(i/BATCH_SIZE) + 1}: ${summaryUpdateCount} summary rows updated`);
      }

      logger.info(`[penyesuaian.service] Total stores resolved: ${storesToResolve.length}, summary status updated: ${totalUpdated}`);
      return totalUpdated;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error updating resolved records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build filter function for data filtering (DRY principle)
   * IMPORTANT: Always filter RECID='*' for display
   * @param {Object} params - Filter parameters
   * @returns {Function} Filter function
   */
  buildFilterFunction(params = {}) {
    const { cabang, periode, kdtk } = params;

    return item => {
      // CRITICAL: Always filter for RECID='*' (unresolved records only)
      if (item.RECID !== "*") {
        return false;
      }

      // Filter by cabang
      if (cabang && cabang !== "All" && item.CABANG !== cabang) {
        return false;
      }

      // Filter by kdtk
      if (kdtk && item.KDTK !== kdtk) {
        return false;
      }

      // Filter by periode
      if (periode && item.PERIODE !== periode) {
        return false;
      }

      return true;
    };
  }

  /**
   * Get summary statistics from JSON file
   * Only count RECID='*' records
   * @param {Object} options - Query options (cabang, periode)
   * @returns {Promise<Object>} Summary statistics
   */
  async getSummary(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file for the requested period
      await this.ensureDataLoaded(periode);

      // Build filter function (includes RECID='*' filter)
      const filterFn = this.buildFilterFunction({ cabang, periode });

      // Filter data
      const filteredData = this.penyesuaianData.filter(filterFn);

      // Calculate summary
      const uniqueStores = new Set(filteredData.map(item => item.KDTK));
      const totalSesuai = filteredData.reduce((sum, item) => sum + (Number(item.SESUAI) || 0), 0);

      return {
        data: {
          jml_toko: uniqueStores.size,
          total_sesuai: totalSesuai,
          total_records: filteredData.length,
        },
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ambil resume nilai per KDTK dari file JSON (tanpa query DB)
   */
  async getResumeByKdtk(options = {}) {
    const {
      cabang = "All",
      periode,
      page = 1,
      limit = 10,
      sortColumn = "KDTK",
      sortOrder = "ASC",
      searchQuery,
    } = options;

    if (!periode) throw new Error("Periode wajib diisi");

    try {
      await this.ensureDataLoaded(periode);
      await storeService.ensureInitialized();

      let filtered = this.penyesuaianData.filter(
        i => i.PERIODE === periode && (cabang === "All" || i.CABANG === cabang)
      );

      // Ambil nama toko dari storeService
      let results = [];
      for (const item of filtered) {
        let storeName = "-";
        try {
          const storeInfo = await storeService.getStoreByCode(item.KDTK);
          if (storeInfo?.storeName) storeName = storeInfo.storeName;
        } catch {
          logger.warn(`[penyesuaian.service] Nama toko tidak ditemukan untuk ${item.KDTK}`);
        }
        results.push({
          CABANG: item.CABANG,
          PERIODE: item.PERIODE,
          KDTK: item.KDTK,
          NAMA: storeName,
          SESUAI: Number(item.SESUAI.toFixed(2)),
          UPDTIME: item.UPDTIME,
        });
      }

      results = await this.enrichWithNotes(results);

      // 🔍 Search (optional)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        results = results.filter(item => {
          // fields biasa
          const fields = ["CABANG", "KDTK", "NAMA", "SESUAI"];

          // cocokkan field normal
          const matchNormal = fields.some(field => item[field] && item[field].toString().toLowerCase().includes(q));

          // cocokkan field di dalam note
          const matchNote =
            item.note &&
            ((item.note.noteText && item.note.noteText.toLowerCase().includes(q)) ||
              (item.note.pic && item.note.pic.toLowerCase().includes(q)) ||
              (item.note.fullName && item.note.fullName.toLowerCase().includes(q)));

          return matchNormal || matchNote;
        });
      }

      // Sorting
      const allowedSortColumns = ["CABANG", "KDTK", "SESUAI", "UPDTIME"];
      const col = allowedSortColumns.includes(sortColumn) ? sortColumn : "KDTK";
      const order = sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

      results.sort((a, b) => {
        let av = a[col],
          bv = b[col];
        if (col === "UPDTIME") {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        }
        if (typeof av === "number" || !isNaN(Number(av))) {
          av = Number(av);
          bv = Number(bv);
        }
        return order === "ASC" ? (av > bv ? 1 : av < bv ? -1 : 0) : av < bv ? 1 : av > bv ? -1 : 0;
      });

      // Pagination
      const totalRecords = results.length;
      const start = (page - 1) * limit;
      const paginated = results.slice(start, start + limit);

      return {
        data: paginated,
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getResumeByKdtk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ambil resume nilai per KDTK dari file JSON (tanpa query DB)
   */
  async getSingleResumeKdtk(options = {}) {
    const { periode, kdtk } = options;

    try {
      await this.ensureDataLoaded(periode);
      await storeService.ensureInitialized();

      let filtered = this.penyesuaianData.filter(i => i.PERIODE === periode && i.KDTK === kdtk);

      // Ambil nama toko dari storeService
      const results = [];
      for (const item of filtered) {
        let storeName = "-";
        try {
          const storeInfo = await storeService.getStoreByCode(item.KDTK);
          if (storeInfo?.storeName) storeName = storeInfo.storeName;
        } catch {
          logger.warn(`[penyesuaian.service] Nama toko tidak ditemukan untuk ${item.KDTK}`);
        }
        results.push({
          CABANG: item.CABANG,
          PERIODE: item.PERIODE,
          KDTK: item.KDTK,
          NAMA: storeName,
          SESUAI: Number(item.SESUAI.toFixed(2)),
          UPDTIME: item.UPDTIME,
        });
      }

      results = await this.enrichWithNotes(results);

      return results;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getSingleResumeKdtk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all records without pagination and filtering from JSON file
   * Only return RECID='*' records
   * @param {Object} options - Query options
   * @returns {Promise<Object>} All records
   */
  async getAll(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file for requested period
      await this.ensureDataLoaded(periode);

      // Build filter function (includes RECID='*' filter)
      const filterFn = this.buildFilterFunction({ cabang, periode });

      // Filter data
      let filteredData = this.penyesuaianData.filter(filterFn);

      const enrichedData = await this.enrichWithNotes(filteredData);

      return {
        data: enrichedData,
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting all records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all records (with cache, search, sort, and pagination in-memory)
   * Includes cache cleanup and robust error handling
   */
  async getAllRecords(options = {}) {
    const {
      page = 1,
      limit = 10,
      kdtk,
      cabang,
      periode,
      searchQuery,
      sortColumn = "SESUAI", // default: urutkan berdasarkan SESUAI
      sortOrder = "DESC",
    } = options;

    try {
      // 🧩 Validasi input
      if (!periode) throw new Error("Periode wajib diisi");

      // 🧹 Bersihkan cache lama dulu
      this.cleanupCache();

      const key = this.generateCacheKey(periode, cabang, kdtk);
      const now = Date.now();

      let cacheEntry = this.cacheDetailData.get(key);

      // 🔄 Cek apakah cache masih valid
      if (!cacheEntry || !this.isCacheValid(cacheEntry)) {
        const freshData = await this.loadRecordsDetailFromDb({ periode, cabang, kdtk });
        cacheEntry = {
          data: freshData,
          lastFetchTime: now,
          lastAccessTime: now,
        };
        this.cacheDetailData.set(key, cacheEntry);
        logger.info(`[penyesuaian.service] Cache refreshed for key=${key}`);
      } else {
        // ⏳ Perpanjang TTL (karena ada aktivitas)
        cacheEntry.lastAccessTime = now;
        this.cacheDetailData.set(key, cacheEntry);
        logger.debug(`[penyesuaian.service] Cache hit for key=${key}`);
      }

      let filteredData = [...cacheEntry.data];

      // 🔍 Search (optional)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredData = filteredData.filter(item =>
          ["PRDCD", "SINGKATAN", "SESUAI"].some(
            field => item[field] && item[field].toString().toLowerCase().includes(q)
          )
        );
      }

      // 📊 Sorting (numeric-aware)
      const allowedSortColumns = [
        "RECID",
        "CABANG",
        "PERIODE",
        "KDTK",
        "PRDCD",
        "SINGKATAN",
        "RECID_PRODMAST",
        "PTAG",
        "BEGBAL",
        "TRFIN",
        "TRFOUT",
        "RP_SALES",
        "RP_RETUR_SALES",
        "ADJ",
        "BA",
        "BS",
        "ACOST",
        "LCOST",
        "STOCK",
        "RP_STOCK",
        "SESUAI",
        "UPDTIME",
      ];

      const col = allowedSortColumns.includes(sortColumn) ? sortColumn : "UPDTIME";
      const order = sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";

      filteredData.sort((a, b) => {
        let av = a[col];
        let bv = b[col];

        if (col === "UPDTIME") {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        } else if (isNumericString(av) && isNumericString(bv)) {
          av = toNumber(av);
          bv = toNumber(bv);
        } else {
          av = (av || "").toString();
          bv = (bv || "").toString();
        }

        if (av === bv) return 0;
        return order === "ASC" ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
      });

      // 📄 Pagination
      const totalRecords = filteredData.length;
      const start = (page - 1) * limit;
      const paginated = filteredData.slice(start, start + limit);

      // 🔢 Format numbering di tahap akhir (tanpa ubah logic sorting)
      const formattedData = paginated.map(row => {
        const formattedRow = {};
        for (const [key, value] of Object.entries(row)) {
          formattedRow[key] = isNumericString(value) && key !== `PRDCD` ? formatNumber(value) : value;
        }
        return formattedRow;
      });

      // 🚀 Return hasil akhir
      return {
        data: formattedData,
        total: totalRecords,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalRecords / limit),
        fromCache: true,
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error in getAllRecords: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get record by primary key
   */
  async getRecord(cabang, kdtk, periode, prdcd) {
    try {
      const record = await SesuaiToko.findOne({
        where: {
          CABANG: cabang,
          KDTK: kdtk,
          PERIODE: periode,
          PRDCD: prdcd,
        },
      });

      return record;
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge notes and category info into penyesuaianData
   */
  async enrichWithNotes(data) {
    try {
      const notes = await notesService.getAll();

      const notesByKey = new Map(notes.filter(n => n.tableName === "sesuai_toko").map(n => [n.unixKey, n]));

      let enrichedData = data.map(item => {
        const unixKey = `${item.KDTK}${item.PERIODE}`;
        const note = notesByKey.get(unixKey) || null;
        
        if (!note) {
          return { ...item, note: null };
        }

        return {
          ...item,
          note: {
            unixKey: note.unixKey,
            noteText: note.noteText,
            pic: note.pic,
            fullName: note.fullName || null,
            updated_at: note.updated_at || null,
          },
        };
      });

      // --- FALLBACK LOGIC: Ambil dari table lama jika note kosong ---
      const itemsWithoutNote = enrichedData.filter(item => !item.note);
      
      if (itemsWithoutNote.length > 0) {
        // Bentuk format IDNOTE dari table lama: CABANG + KDTK + PERIODE (tanpa titik, sesuai permintaan)
        const missingIdNotes = itemsWithoutNote.map(item => `${item.CABANG}${item.KDTK}${item.PERIODE}`);
        
        // Ambil note dari db legacy
        const legacyNotes = await notesService.getLegacyNotesFallback("web_reporting.sesuaiToko", missingIdNotes);
        
        if (legacyNotes && legacyNotes.length > 0) {
          const legacyNotesMap = new Map(legacyNotes.map(n => [n.legacyIdNote, n]));
          
          // Map ulang data dan masukkan legacy notes jika ada
          enrichedData = enrichedData.map(item => {
            if (item.note) return item; // Jika sudah punya note dari sistem baru, skip
            
            const legacyIdNote = `${item.CABANG}${item.KDTK}${item.PERIODE}`;
            const legacyNote = legacyNotesMap.get(legacyIdNote);
            
            if (legacyNote) {
              return {
                ...item,
                note: {
                  unixKey: legacyNote.unixKey,
                  noteText: legacyNote.noteText,
                  pic: legacyNote.pic,
                  fullName: legacyNote.fullName,
                  updated_at: legacyNote.updated_at
                }
              };
            }
            
            return item;
          });
        }
      }

      return enrichedData;
    } catch (err) {
      logger.error(`[penyesuaian.service] Error enriching data with notes: ${err.message}`);
      return data;
    }
  }
}

export default new PenyesuaianService();
