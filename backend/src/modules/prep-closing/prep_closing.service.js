/**
 * Service for Prep Closing (Screening Pra Closing)
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import ScreeningPraClosing from "./prep_closing.model.js";
import dbStore from "../../config/db_store.js";
import config from "./prep_closing.config.js";
import storeService from "../store/storeService.js";
import ruleEngine from "./rules/rule.engine.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import notesService from "../notes/notes.service.js";
import progressService from "../progress/progress.service.js";
import { wrcExtractorService } from "./wrc_extractor.service.js";

// Path untuk file JSON
const PREP_CLOSING_DATA_DIR = path.join(process.cwd(), "data/prep_closing");

class PrepClosingService {
  constructor() {
    this.prepClosingData = [];
    this.initialized = false;
    this.loadedPeriod = null;

    // TTL Cache Management
    this.lastLoadTime = null;
    this.TTL = 60 * 60 * 1000; // 1 hour
    this.isLoading = false;

    // Multi-key cache for detailed records
    this.cacheDetailData = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes

    // Task 1: issuesCache in-process
    this.issuesCache = new Map();
    this.issuesCachePeriode = null;
    this.issuesCacheTTL = 30 * 60 * 1000; // 30 menit
    this.issuesCacheLoadTime = 0; // timestamp terakhir issuesCache diload dari DB
    this.issuesCachePromise = null;

    // Task 2: storeNameMap sync lookup
    this.storeNameMap = null;

    // Task 3: notesCache
    this.notesCache = null;
    this.notesCacheTime = 0;
    this.notesCacheTTL = 5 * 60 * 1000; // 5 menit
    this.notesCachePromise = null;
  }

  getJsonPath(periode) {
    return path.join(PREP_CLOSING_DATA_DIR, `prep_closing_${periode}.json`);
  }

  async ensureDataDir() {
    await fs.mkdir(PREP_CLOSING_DATA_DIR, { recursive: true });
  }

  /**
   * Initialize the service by loading data from JSON file
   */
  async initialize(periode) {
    if (!periode) throw new Error("periode is required for initialize");
    try {
      await this.ensureDataDir();
      const jsonPath = this.getJsonPath(periode);

      try {
        const data = await fs.readFile(jsonPath, "utf8");
        this.prepClosingData = JSON.parse(data);
        this.loadedPeriod = periode;
        logger.info(
          `[prep_closing.service] Loaded ${this.prepClosingData.length} records from ${jsonPath}`,
        );
      } catch (err) {
        if (err.code === "ENOENT") {
          this.prepClosingData = [];
          this.loadedPeriod = periode;
          await this.saveToFile(periode);
        } else throw err;
      }

      this.initialized = true;
    } catch (error) {
      logger.error(
        `[prep_closing.service] Failed to initialize: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  async saveToFile(periode) {
    try {
      const jsonPath = this.getJsonPath(periode);
      await fs.writeFile(
        jsonPath,
        JSON.stringify(this.prepClosingData, null, 2),
      );
      logger.debug(
        `[prep_closing.service] Saved ${this.prepClosingData.length} records to ${jsonPath}`,
      );
    } catch (error) {
      logger.error(
        `[prep_closing.service] Failed to save to file: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(periode, cabang, kdtk) {
    return JSON.stringify({ periode, cabang, kdtk });
  }

  /**
   * Check if cache is valid
   */
  isCacheFromDbValid(entry) {
    if (!entry) return false;
    const now = Date.now();
    return now - entry.lastAccessTime < this.cacheTTL;
  }

  /**
   * Check if summary cache is valid
   */
  isCacheValid(periode) {
    if (
      !this.initialized ||
      !this.lastLoadTime ||
      this.loadedPeriod !== periode
    ) {
      return false;
    }
    const now = Date.now();
    return now - this.lastLoadTime <= this.TTL;
  }

  /**
   * Invalidate cache manually
   */
  invalidateCache() {
    this.prepClosingData = [];
    this.initialized = false;
    this.loadedPeriod = null;
    this.lastLoadTime = null;
    this.isLoading = false;
    this.cacheDetailData.clear();

    this.issuesCache.clear();
    this.issuesCachePeriode = null;
    this.storeNameMap = null;
    this.notesCache = null;
    this.notesCacheTime = 0;

    logger.info("[prep_closing.service] Cache invalidated");
  }

  /**
   * Ensure data is loaded with TTL-based lazy loading
   */
  async ensureDataLoaded(periode) {
    if (!periode) throw new Error("periode is required for ensureDataLoaded");

    if (this.isCacheValid(periode)) {
      return;
    }

    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.isCacheValid(periode)) return;
    }

    try {
      this.isLoading = true;
      logger.info(
        `[prep_closing.service] Loading data for periode ${periode} (cache expired or period changed)`,
      );

      await this.initialize(periode);
      this.lastLoadTime = Date.now();

      logger.info(
        `[prep_closing.service] Data loaded. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`,
      );
    } finally {
      this.isLoading = false;
    }
  }

  // --- TASK 1: issuesCache ---
  isIssuesCacheValid(periode) {
    if (this.issuesCachePeriode !== periode || this.issuesCache.size === 0)
      return false;
    const now = Date.now();
    return now - this.issuesCacheLoadTime < this.issuesCacheTTL;
  }

  async loadIssuesCache(periode) {
    if (this.isIssuesCacheValid(periode)) {
      return;
    }

    if (this.issuesCachePromise) {
      await this.issuesCachePromise;
      return;
    }

    this.issuesCachePromise = (async () => {
      try {
        const model = await ScreeningPraClosing.getModel();
        const records = await model.findAll({
          where: { PRD_CLOSING: periode, RECID: "*" },
          attributes: ["KDTK", "ISSUES"],
        });

        this.issuesCache.clear();
        this.issuesCachePeriode = periode;

        for (const rec of records) {
          this.issuesCache.set(
            rec.KDTK,
            Array.isArray(rec.ISSUES) ? rec.ISSUES : [],
          );
        }

        this.issuesCacheLoadTime = Date.now();
        logger.info(
          `[prep_closing.service] issuesCache loaded for periode ${periode}. Stores cached: ${this.issuesCache.size}`,
        );
      } catch (error) {
        logger.error(
          `[prep_closing.service] Error in loadIssuesCache: ${error.message}`,
        );
      } finally {
        this.issuesCachePromise = null;
      }
    })();

    await this.issuesCachePromise;
  }

  // --- TASK 2: storeNameMap ---
  ensureStoreNameMap() {
    if (!this.storeNameMap) {
      this.storeNameMap = new Map();
      if (storeService.stores && Array.isArray(storeService.stores)) {
        for (const s of storeService.stores) {
          this.storeNameMap.set(
            s.storeCode || s.kdtk,
            s.storeName || s.namaToko || "-",
          );
        }
      }
    }
  }

  // --- TASK 3: notesCache ---
  async getCachedNotes() {
    const now = Date.now();
    if (this.notesCache && now - this.notesCacheTime < this.notesCacheTTL) {
      return this.notesCache;
    }

    if (this.notesCachePromise) {
      return await this.notesCachePromise;
    }

    this.notesCachePromise = (async () => {
      try {
        this.notesCache = await notesService.getAll();
        this.notesCacheTime = Date.now();
        return this.notesCache;
      } finally {
        this.notesCachePromise = null;
      }
    })();

    return await this.notesCachePromise;
  }

  /**
   * Sync aggregated data to JSON file
   */
  async syncToJsonFile(periode) {
    if (!periode) throw new Error("periode is required for syncToJsonFile");
    try {
      const model = await ScreeningPraClosing.getModel();
      const sequelize = model.sequelize;

      // Query agregasi
      const [rows] = await sequelize.query(
        `
        SELECT
          RECID,
          CAB,
          KDTK,
          PRD_CLOSING,
          TOTAL_RULES,
          PASSED_RULES,
          FAILED_RULES,
          CRITICAL_ISSUES,
          IS_READY,
          LAST_SCREENED,
          UPDTIME
        FROM screening_praclosing
        WHERE PRD_CLOSING = :periode
      `,
        { replacements: { periode } },
      );

      this.prepClosingData = rows.map((r) => ({
        RECID: r.RECID,
        CAB: r.CAB,
        KDTK: r.KDTK,
        PRD_CLOSING: r.PRD_CLOSING,
        TOTAL_RULES: r.TOTAL_RULES || 0,
        PASSED_RULES: r.PASSED_RULES || 0,
        FAILED_RULES: r.FAILED_RULES || 0,
        CRITICAL_ISSUES: r.CRITICAL_ISSUES || 0,
        IS_READY: r.IS_READY || false,
        LAST_SCREENED: r.LAST_SCREENED,
        UPDTIME: r.UPDTIME,
      }));

      await this.saveToFile(periode);
      this.lastLoadTime = Date.now();
      this.loadedPeriod = periode;
      this.initialized = true;

      logger.info(
        `[prep_closing.service] Synced ${this.prepClosingData.length} records to JSON`,
      );

      // TASK 1: Force reload issuesCache dari DB setelah sync agar data selalu fresh
      if (rows.length > 0 && rows[0].PRD_CLOSING) {
        this.issuesCache.clear();
        this.issuesCachePeriode = null;
        this.issuesCacheLoadTime = 0;
        await this.loadIssuesCache(rows[0].PRD_CLOSING);
      }
    } catch (error) {
      logger.error(`[prep_closing.service] Failed to sync: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate previous periode (1 month before)
   */
  getPreviousPeriode(periode) {
    const currentDate = moment(periode, "YYMM");
    const previousDate = currentDate.subtract(1, "months");
    return previousDate.format("YYMM");
  }

  /**
   * Generate filet table names
   */
  getFiletTableNames(kdtk, periode) {
    const previousPeriode = this.getPreviousPeriode(periode);
    const tblFilet = `${kdtk}${previousPeriode}`;
    const tblFiletMaju = `${kdtk}${periode}`;
    return { tblFilet, tblFiletMaju };
  }

  /**
   * Get saldo data from WRC Cache for a store
   * @param {string} kdtk - Store code
   * @returns {Object} Saldo data with fallback to default values
   */
  async getSaldoFromWrc(kdtk, cab) {
    try {
      if (!wrcExtractorService.cacheData?.last_extracted_at) {
        await wrcExtractorService.loadCache();
      }
      const branchData =
        wrcExtractorService.cacheData?.data_by_cabang?.[cab]
          ?.branch_level_data || {};
      const storeData =
        wrcExtractorService.cacheData?.data_by_cabang?.[cab]?.stores?.[kdtk] ||
        {};

      // Gabungkan data dengan urutan: Branch data sebagai base, Store data menimpa jika ada spesifik per toko
      const combinedWrcData = { ...branchData, ...storeData };

      return {
        saldoBlnQty: storeData.saldo_akh_wrc_toko
          ? parseFloat(storeData.saldo_akh_wrc_toko)
          : 0,
        saldoBlnRp: storeData.rp_saldo_akh_wrc_toko
          ? parseFloat(storeData.rp_saldo_akh_wrc_toko)
          : 0,
        strBlnSlsWrc: branchData.bln_sls_wrc || null, // Ambil eksklusif dari branch level
        strMaxBlnAktWrc: branchData.terakhir_bln_akt_wrc || null, // Ambil eksklusif dari branch level
        ...combinedWrcData,
      };
    } catch (e) {
      logger.warn(
        `[prep_closing.service] Legacy WRC mapping error proxy for ${kdtk}, using default values`,
      );
      return {
        saldoBlnQty: 0,
        saldoBlnRp: 0,
        strBlnSlsWrc: null,
        strMaxBlnAktWrc: null,
      };
    }
  }

  /**
   * Process single store screening
   */
  async processSingleStore(store, strPeriode, strYear, strMonth) {
    const { storeCode, cab } = store;
    const results = { success: false, records: null, hasIssue: false };

    try {
      // Get store info
      const storeInfo = await storeService.getStoreIPHost(storeCode);

      if (!storeInfo) {
        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "prep_closing",
          `[${storeCode}] store info not found`,
        );
        return results;
      }

      // Create DB connection
      const storeConnection = await dbStore.createDbStore(
        storeInfo.dbHost,
        config.connectionRetry.maxRetries,
      );

      if (!storeConnection) {
        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "prep_closing",
          `[${storeCode}] failed to connect after ${config.connectionRetry.maxRetries} attempts`,
        );
        return results;
      }

      try {
        // Generate table names
        const { tblFilet, tblFiletMaju } = this.getFiletTableNames(
          storeCode,
          strPeriode,
        );

        // Get saldo data from WRC directly from new Cache
        const saldoData = await this.getSaldoFromWrc(storeCode, cab);

        // Prepare context for rule execution
        const context = {
          cab,
          kdtk: storeCode,
          periode: strPeriode,
          period: strPeriode, // alias untuk mempermudah user config
          strYear,
          year: strYear, // alias untuk konsistensi dengan WRC
          strMonth,
          month: strMonth, // alias sinkronisasi WRC Extractor
          strPrd: moment(`${strYear}-${strMonth}-01`)
            .subtract(1, "month")
            .format("YYYYMM"),
          tblFilet,
          tblFiletMaju,
          ...saldoData,
        };

        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "prep_closing",
          `[${storeCode}] executing rules...`,
        );

        // Execute all rules
        const ruleResults = await ruleEngine.executeRules(
          storeConnection,
          context,
        );

        await RekapRemoteService.addToTemp(
          cab,
          storeCode,
          "prep_closing",
          `[${storeCode}] rules completed: ${ruleResults.passedRules}/${ruleResults.totalRules} passed, ${ruleResults.criticalIssues} critical issues`,
        );

        // Prepare record for database
        const recordId = `${cab}${storeCode}${strPeriode}`;
        const recordData = {
          ID: recordId,
          RECID: "*", // Always mark as unresolved for screening
          CAB: cab,
          KDTK: storeCode,
          PRD_CLOSING: strPeriode,
          ISSUES: ruleResults.issues,
          TOTAL_RULES: ruleResults.totalRules,
          PASSED_RULES: ruleResults.passedRules,
          FAILED_RULES: ruleResults.failedRules,
          CRITICAL_ISSUES: ruleResults.criticalIssues,
          IS_READY: ruleResults.isReady,
          LAST_SCREENED: new Date(),
          UPDTIME: new Date(),
        };

        // Save to database
        await ScreeningPraClosing.upsert(recordData, {
          conflictFields: ["ID"],
        });

        results.records = recordData;
        results.hasIssue = !ruleResults.isReady; // Has issue if not ready
        results.success = true;
      } finally {
        await storeConnection.end();
      }
    } catch (err) {
      await RekapRemoteService.addToTemp(
        cab,
        storeCode,
        "prep_closing",
        `[${storeCode}] ERROR: ${err.message}`,
      );
      logger.error(
        `[prep_closing.service] Error processing store ${storeCode}: ${err.message}`,
      );
    }

    return results;
  }

  /**
   * Update resolved records
   */
  async updateResolvedRecords(params) {
    const {
      periode,
      level,
      cabang,
      kdtk,
      hasIssue,
      screenedStores,
      activeStores,
    } = params;

    try {
      const model = await ScreeningPraClosing.getModel();
      const sequelize = model.sequelize;
      const { Sequelize } = await import("sequelize");

      let query = "";
      let replacements = { periode };

      // LEVEL 3: Single Store
      if (level === 3) {
        if (hasIssue) {
          logger.info(
            `[prep_closing.service] Level 3: Store ${kdtk} has issues, no RECID update`,
          );
          return 0;
        } else {
          query = `
            UPDATE screening_praclosing
            SET RECID = '1'
            WHERE PRD_CLOSING = :periode
              AND KDTK = :kdtk
              AND RECID = '*'
          `;
          replacements.kdtk = kdtk;

          logger.info(
            `[prep_closing.service] Level 3: Updating RECID='1' for store ${kdtk}`,
          );
        }
      }
      // LEVEL 2: Single Branch
      else if (level === 2) {
        if (!screenedStores || screenedStores.length === 0) {
          logger.info(
            `[prep_closing.service] Level 2: No stores screened, skipping`,
          );
          return 0;
        }

        query = `
          UPDATE screening_praclosing
          SET RECID = '1'
          WHERE PRD_CLOSING = :periode
            AND CAB = :cabang
            AND RECID = '*'
            AND KDTK IN (:screenedStores)
        `;
        replacements.cabang = cabang;
        replacements.screenedStores = screenedStores;

        if (activeStores && activeStores.length > 0) {
          query += ` AND KDTK NOT IN (:activeStores)`;
          replacements.activeStores = activeStores;
        }

        logger.info(
          `[prep_closing.service] Level 2: Updating for cabang ${cabang}, screened: ${screenedStores.length}, active: ${
            activeStores?.length || 0
          }`,
        );
      }
      // LEVEL 1: All Branches
      else if (level === 1) {
        if (!screenedStores || screenedStores.length === 0) {
          logger.info(
            `[prep_closing.service] Level 1: No stores screened, skipping`,
          );
          return 0;
        }

        query = `
          UPDATE screening_praclosing
          SET RECID = '1'
          WHERE PRD_CLOSING = :periode
            AND RECID = '*'
            AND KDTK IN (:screenedStores)
        `;
        replacements.screenedStores = screenedStores;

        if (activeStores && activeStores.length > 0) {
          query += ` AND KDTK NOT IN (:activeStores)`;
          replacements.activeStores = activeStores;
        }

        logger.info(
          `[prep_closing.service] Level 1: Updating all cabang, screened: ${screenedStores.length}, active: ${
            activeStores?.length || 0
          }`,
        );
      }

      // Execute query
      const [results, metadata] = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.UPDATE,
      });

      logger.info(
        `[prep_closing.service] Updated ${metadata} records to RECID='1'`,
      );

      return metadata;
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error updating resolved records: ${error.message}`,
      );
      throw error;
    }
  }

  // 👇 Lanjutan di Part 2...
  // ... (lanjutan dari Part 1)

  /**
   * Main screening method
   * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
   */
  async screening(options) {
    // Ensure storeService and ruleEngine are initialized
    await storeService.ensureInitialized();
    await ruleEngine.ensureInitialized();

    const { cabang, periode, kdtk, username } = options;

    // === LEVEL 3: Single Store Screening (No Progress Task) ===
    if (kdtk) {
      logger.info(
        `[prep_closing.service] Starting single store screening: ${kdtk}, periode: ${periode}`,
      );

      try {
        // Get store info to determine cabang
        const storeInfo = await storeService.getStoreByCode(kdtk);
        const storeCab = storeInfo
          ? storeInfo.branch || storeInfo.cab
          : "UNKNOWN";

        // Convert periode
        const strPeriode = periode;
        const strYear = moment(periode, "YYMM").format("YYYY");
        const strMonth = moment(periode, "YYMM").format("MM");

        // Process single store
        const result = await this.processSingleStore(
          { storeCode: kdtk, cab: storeCab },
          strPeriode,
          strYear,
          strMonth,
        );

        // Save logs to database
        await RekapRemoteService.saveLogsToDatabase();

        // Update resolved records
        await this.updateResolvedRecords({
          periode: strPeriode,
          level: 3,
          kdtk: kdtk,
          hasIssue: result.hasIssue,
        });

        // Sync to JSON file
        await this.syncToJsonFile(strPeriode);

        const cacheKey = `detail_${strPeriode}_${kdtk}`;
        this.cacheDetailData.delete(cacheKey);

        return {
          success: true,
          message: `Single store screening completed for ${kdtk}`,
          isReady: result.records?.IS_READY || false,
          totalRules: result.records?.TOTAL_RULES || 0,
          passedRules: result.records?.PASSED_RULES || 0,
          failedRules: result.records?.FAILED_RULES || 0,
          criticalIssues: result.records?.CRITICAL_ISSUES || 0,
        };
      } catch (error) {
        logger.error(
          `[prep_closing.service] Error during single store screening: ${error.message}`,
        );
        throw error;
      }
    }

    // === LEVEL 1 & 2: Multi-Store Screening (With Progress Task) ===
    const taskId = `${config.taskProgressName}_${username}`;
    const limitBranches = pLimit(
      config.parallelProcessing.branchConcurrencyLimit,
    );
    const limitStores = pLimit(config.parallelProcessing.concurrencyLimit);

    const withTimeout = (promise, ms, label) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms),
        ),
      ]);
    };

    try {
      // === STEP 1: Determine branches ===
      let branches = [];
      if (cabang === "All" || cabang === "ALL") {
        const allStores = storeService.stores;
        branches = [
          ...new Set(
            allStores
              .filter((s) => s.notes === "INDUK")
              .map((s) => s.branch || s.cab),
          ),
        ];
      } else {
        branches = [cabang];
      }

      logger.info(
        `[prep_closing.service] Branches to process: ${branches.join(", ")}`,
      );

      // === STEP 2: Collect all stores ===
      const storeGroups = await Promise.all(
        branches.map((cab) =>
          limitBranches(async () => {
            const stores = await storeService.getStoresByBranch(cab, true, {
              validateWRC: true,
              period: periode,
            });
            logger.info(
              `[prep_closing.service] Found ${stores.length} stores for branch ${cab}`,
            );
            return stores.map((s) => ({ ...s, cab }));
          }),
        ),
      );

      const storesToProcess = storeGroups.flat();

      logger.info(
        `[prep_closing.service] Total stores to process: ${storesToProcess.length}`,
      );

      // === STEP 3: Register progress task ===
      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, storesToProcess.length, {
          module: "prep_closing",
          title: "Screening Pra Closing",
          description: "Registering task for prep closing screening",
          startedBy: username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(
          `[prep_closing.service] Progress task registered: ${taskId}`,
        );
      } catch (error) {
        logger.error(
          `[prep_closing.service] Error registering progress: ${error.message}`,
        );

        if (error.message.includes("Maximum concurrent")) {
          await progressService.failProgress(taskId, {
            description: `Task failed: ${error.message}`,
            status: "failed",
          });
          throw new Error(
            "[prep_closing.service] System is busy processing other tasks",
          );
        }

        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
        throw new Error(
          "[prep_closing.service] Failed to register progress task",
        );
      }

      logger.info(
        `[prep_closing.service] Starting screening for branches: ${branches.join(", ")}`,
      );

      // === STEP 4: Prepare processing ===
      const strPeriode = periode;
      const strYear = moment(periode, "YYMM").format("YYYY");
      const strMonth = moment(periode, "YYMM").format("MM");

      // Reload WRC Extractor Cache before massive screening loop
      await wrcExtractorService.loadCache();

      // Skip manual WRC pulling loop (Moved to decoupled Cache System)

      // Track stores
      const screenedStores = new Set();
      const activeStores = new Set();

      let processedCount = 0;
      const totalStores = storesToProcess.length;

      const incrementProgress = async (storeCode, statusText) => {
        processedCount++;

        await progressService.updateProgress(taskId, processedCount, {
          description: `Store ${storeCode} → ${statusText} (${processedCount}/${totalStores})`,
          status: "Screening Stores",
        });
      };

      // === STEP 5: Process each store ===
      await Promise.all(
        storesToProcess.map((store) =>
          limitStores(async () => {
            const { cab, storeCode } = store;

            screenedStores.add(storeCode);

            try {
              const result = await withTimeout(
                this.processSingleStore(store, strPeriode, strYear, strMonth),
                config.parallelProcessing.storeTimeoutMs,
                `process store ${storeCode}`,
              );

              if (result.success) {
                if (result.hasIssue) {
                  activeStores.add(storeCode);
                  await incrementProgress(
                    storeCode,
                    `Has Issues ⚠️ (${result.records.CRITICAL_ISSUES} critical)`,
                  );
                } else {
                  await incrementProgress(storeCode, "Ready for Closing ✅");
                }
              } else {
                await incrementProgress(storeCode, "Error ❌");
              }
            } catch (err) {
              await RekapRemoteService.addToTemp(
                cab,
                storeCode,
                "prep_closing",
                `[${storeCode}] ERROR: ${err.message}`,
              );
              await incrementProgress(storeCode, "Error ❌");
            }
          }),
        ),
      );

      logger.info(
        `[prep_closing.service] Screening completed for periode ${periode}`,
      );
      logger.info(
        `[prep_closing.service] Screened: ${screenedStores.size}, Active (has issues): ${activeStores.size}, Ready: ${
          screenedStores.size - activeStores.size
        }`,
      );

      // === STEP 6: Update resolved records ===
      await progressService.updateProgress(taskId, processedCount, {
        description: "Updating resolved records (RECID = 1)",
        status: "finalizing",
      });

      await this.updateResolvedRecords({
        periode: strPeriode,
        level: cabang === "All" || cabang === "ALL" ? 1 : 2,
        cabang: cabang === "All" || cabang === "ALL" ? null : cabang,
        screenedStores: Array.from(screenedStores),
        activeStores: Array.from(activeStores),
      });

      // === STEP 7: Save logs ===
      await progressService.updateProgress(taskId, processedCount, {
        description: "Saving logs to database",
        status: "finalizing",
      });

      await RekapRemoteService.saveLogsToDatabase();

      // === STEP 8: Sync to JSON ===
      await progressService.updateProgress(taskId, processedCount, {
        description: "Syncing data to JSON file, please wait...",
        status: "finalizing",
      });

      await this.syncToJsonFile(strPeriode);
      logger.info(`[prep_closing.service] Synchronized data to JSON file`);

      // === STEP 9: Complete progress ===
      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed successfully",
        status: "completed",
        completedAt: timeCompleted,
      });

      return {
        success: true,
        message: "Screening process completed",
        screenedStores: screenedStores.size,
        activeStores: activeStores.size,
        resolvedStores: screenedStores.size - activeStores.size,
      };
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error during screening: ${error.message}`,
      );

      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });

      throw error;
    }
  }

  /**
   * Build filter function for data filtering
   */
  buildFilterFunction(params = {}) {
    const { cabang, periode, kdtk } = params;

    return (item) => {
      if (cabang && cabang !== "All" && item.CAB !== cabang) {
        return false;
      }

      if (kdtk && item.KDTK !== kdtk) {
        return false;
      }

      if (periode && item.PRD_CLOSING !== periode) {
        return false;
      }

      return true;
    };
  }

  /**
   * Get summary statistics from JSON file
   */
  async getSummary(options = {}) {
    const { cabang, periode } = options;

    try {
      await this.ensureDataLoaded(periode);

      const filterFn = this.buildFilterFunction({ cabang, periode });
      const filteredData = this.prepClosingData.filter(filterFn);
      // Calculate statistics
      const uniqueStores = new Set(filteredData.map((item) => item.KDTK));
      const readyStores = filteredData.filter((item) => item.IS_READY).length;
      const criticalIssues = filteredData.reduce(
        (sum, item) => sum + (item.CRITICAL_ISSUES || 0),
        0,
      );

      return {
        data: {
          total_stores: uniqueStores.size,
          ready_stores: readyStores,
          stores_with_issues: uniqueStores.size - readyStores,
          total_critical_issues: criticalIssues,
        },
      };
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error getting summary: ${error.message}`,
      );
      throw error;
    }
  }

  async getRulesSummary(options = {}) {
    const { cabang, periode } = options;

    try {
      await ruleEngine.ensureInitialized();
      await this.ensureDataLoaded(periode);
      await this.loadIssuesCache(periode);

      let eligibleKdtk = new Set();
      if (cabang && cabang !== "All") {
        for (const pd of this.prepClosingData) {
          if (pd.PRD_CLOSING === periode && pd.CAB === cabang) {
            eligibleKdtk.add(pd.KDTK);
          }
        }
      }

      const rules = ruleEngine.rules;
      const aggMap = new Map();
      for (const r of rules) {
        aggMap.set(r.key, {
          ruleKey: r.key,
          ruleName: r.name,
          category: r.category,
          totalStores: 0,
          storeList: [],
          severity: null,
          severityBreakdown: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          },
        });
      }

      const storeSets = new Map();

      for (const [kdtk, issues] of this.issuesCache.entries()) {
        if (cabang && cabang !== "All" && !eligibleKdtk.has(kdtk)) {
          continue;
        }

        for (const issue of issues) {
          const entry = aggMap.get(issue.ruleKey);
          if (!entry) continue;
          const sev = (issue.severity || "low").toLowerCase();
          if (entry.severityBreakdown[sev] !== undefined) {
            entry.severityBreakdown[sev] += 1;
          }
          if (!storeSets.has(issue.ruleKey))
            storeSets.set(issue.ruleKey, new Set());
          storeSets.get(issue.ruleKey).add(kdtk);
        }
      }

      for (const [key, entry] of aggMap.entries()) {
        const set = storeSets.get(key) || new Set();
        entry.totalStores = set.size;
        entry.storeList = Array.from(set);
        if (entry.severityBreakdown.critical > 0) entry.severity = "critical";
        else if (entry.severityBreakdown.high > 0) entry.severity = "high";
        else if (entry.severityBreakdown.medium > 0) entry.severity = "medium";
        else if (entry.severityBreakdown.low > 0) entry.severity = "low";
        else entry.severity = null;
      }

      const result = Array.from(aggMap.values()).sort(
        (a, b) => b.totalStores - a.totalStores,
      );

      return { data: result };
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error getRulesSummary: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get resume by store (paginated)
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
      ruleKeys,
    } = options;

    if (!periode) throw new Error("Periode wajib diisi");

    try {
      await this.ensureDataLoaded(periode);
      await storeService.ensureInitialized();

      let filtered = this.prepClosingData.filter(
        (i) =>
          i.PRD_CLOSING === periode &&
          (cabang === "All" || i.CAB === cabang) &&
          i.IS_READY == false,
      );

      if (Array.isArray(ruleKeys) && ruleKeys.length > 0) {
        await this.loadIssuesCache(periode);
        const includeSet = new Set();
        for (const [kdtk, issues] of this.issuesCache.entries()) {
          const hasAny = issues.some((iss) => ruleKeys.includes(iss.ruleKey));
          if (hasAny) includeSet.add(kdtk);
        }
        filtered = filtered.filter((i) => includeSet.has(i.KDTK));
      }

      // Enrich with store name
      let results = [];
      this.ensureStoreNameMap();
      for (const item of filtered) {
        const storeName = this.storeNameMap.get(item.KDTK) || "-";
        results.push({
          RECID: item.RECID,
          CAB: item.CAB,
          KDTK: item.KDTK,
          NAMA: storeName,
          PRD_CLOSING: item.PRD_CLOSING,
          TOTAL_RULES: item.TOTAL_RULES,
          PASSED_RULES: item.PASSED_RULES,
          FAILED_RULES: item.FAILED_RULES,
          CRITICAL_ISSUES: item.CRITICAL_ISSUES,
          IS_READY: item.IS_READY,
          LAST_SCREENED: item.LAST_SCREENED,
          UPDTIME: item.UPDTIME,
        });
      }

      // Enrich with notes
      try {
        const notes = await this.getCachedNotes();
        const notesByKey = new Map(
          notes
            .filter((n) => n.tableName === "screening_praclosing")
            .map((n) => [n.unixKey, n]),
        );

        for (let i = 0; i < results.length; i++) {
          const key = `${results[i].KDTK}${results[i].PRD_CLOSING}`;
          const note = notesByKey.get(key) || null;
          results[i] = {
            ...results[i],
            note: note
              ? {
                  unixKey: note.unixKey,
                  noteText: note.noteText,
                  pic: note.pic,
                  fullName: note.fullName || null,
                  updated_at: note.updated_at || null,
                }
              : null,
          };
        }
      } catch (err) {
        logger.warn(
          `[prep_closing.service] Failed to enrich with notes: ${err.message}`,
        );
      }

      // Preload issues map for search and rule filter
      let issuesByStore = new Map();
      try {
        await this.loadIssuesCache(periode);
        issuesByStore = this.issuesCache;
      } catch (err) {
        logger.warn(
          `[prep_closing.service] Unable to preload issues for search: ${err.message}`,
        );
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        results = results.filter((item) => {
          const fields = [
            "CAB",
            "KDTK",
            "NAMA",
            "PASSED_RULES",
            "FAILED_RULES",
            "CRITICAL_ISSUES",
            "IS_READY",
          ];
          const matchNormal = fields.some(
            (field) =>
              item[field] && item[field].toString().toLowerCase().includes(q),
          );

          const matchNote =
            item.note &&
            ((item.note.noteText &&
              item.note.noteText.toLowerCase().includes(q)) ||
              (item.note.pic && item.note.pic.toLowerCase().includes(q)) ||
              (item.note.fullName &&
                item.note.fullName.toLowerCase().includes(q)));

          let matchIssue = false;
          const storeIssues = issuesByStore.get(item.KDTK) || [];
          if (storeIssues.length > 0) {
            matchIssue = storeIssues.some((iss) => {
              const msg = (iss.message || "").toString().toLowerCase();
              const rname = (iss.ruleName || "").toLowerCase();
              return msg.includes(q) || rname.includes(q);
            });
          }

          return matchNormal || matchNote || matchIssue;
        });
      }

      // Sorting
      const allowedSortColumns = [
        "RECID",
        "CAB",
        "KDTK",
        "NAMA",
        "CRITICAL_ISSUES",
        "IS_READY",
        "LAST_SCREENED",
        "UPDTIME",
      ];
      const col = allowedSortColumns.includes(sortColumn) ? sortColumn : "KDTK";
      const order = sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

      results.sort((a, b) => {
        let av = a[col];
        let bv = b[col];

        if (col === "LAST_SCREENED" || col === "UPDTIME") {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        }

        if (typeof av === "number" || !isNaN(Number(av))) {
          av = Number(av);
          bv = Number(bv);
        }

        return order === "ASC"
          ? av > bv
            ? 1
            : av < bv
              ? -1
              : 0
          : av < bv
            ? 1
            : av > bv
              ? -1
              : 0;
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
      logger.error(
        `[prep_closing.service] Error getResumeByKdtk: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get detailed issues for a specific store
   */
  async getStoreDetails(options = {}) {
    const { kdtk, periode } = options;

    if (!kdtk || !periode) {
      throw new Error("kdtk and periode are required");
    }

    const cacheKey = `detail_${periode}_${kdtk}`;
    const cachedEntry = this.cacheDetailData.get(cacheKey);
    if (this.isCacheFromDbValid(cachedEntry)) {
      return cachedEntry.data;
    }

    try {
      const model = await ScreeningPraClosing.getModel();

      const record = await model.findOne({
        where: {
          KDTK: kdtk,
          PRD_CLOSING: periode,
        },
      });

      if (!record) {
        return null;
      }

      // Get store name
      this.ensureStoreNameMap();
      let storeName = this.storeNameMap.get(kdtk) || "-";

      // Get note
      let note = null;
      try {
        const unixKey = `${kdtk}${periode}`;
        const notes = await this.getCachedNotes();
        note =
          notes.find(
            (n) =>
              n.unixKey === unixKey && n.tableName === "screening_praclosing",
          ) || null;
      } catch {
        // Note not found
      }

      const result = {
        CAB: record.CAB,
        KDTK: record.KDTK,
        NAMA: storeName,
        PRD_CLOSING: record.PRD_CLOSING,
        TOTAL_RULES: record.TOTAL_RULES,
        PASSED_RULES: record.PASSED_RULES,
        FAILED_RULES: record.FAILED_RULES,
        CRITICAL_ISSUES: record.CRITICAL_ISSUES,
        IS_READY: record.IS_READY,
        ISSUES: record.ISSUES || [],
        LAST_SCREENED: record.LAST_SCREENED,
        UPDTIME: record.UPDTIME,
        note: note
          ? {
              unixKey: note.unixKey,
              noteText: note.noteText,
              pic: note.pic,
              fullName: note.fullName || null,
              updated_at: note.updated_at || null,
            }
          : null,
      };

      this.cacheDetailData.set(cacheKey, {
        lastAccessTime: Date.now(),
        data: result,
      });

      return result;
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error getStoreDetails: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get issues grouped by category
   */
  async getIssuesByCategory(options = {}) {
    const { cabang, periode } = options;

    try {
      await this.ensureDataLoaded(periode);
      await ruleEngine.ensureInitialized();

      const filterFn = this.buildFilterFunction({ cabang, periode });
      const filteredData = this.prepClosingData.filter(filterFn);

      // Get all issues from cache instead of DB
      await this.loadIssuesCache(periode);

      let eligibleKdtk = null;
      if (cabang && cabang !== "All") {
        eligibleKdtk = new Set(filteredData.map((d) => d.KDTK));
      }

      // Group issues by category
      const categories = ruleEngine.getCategories();
      const issuesByCategory = {};

      Object.keys(categories).forEach((catKey) => {
        issuesByCategory[catKey] = {
          ...categories[catKey],
          count: 0,
          stores: [],
        };
      });

      for (const [kdtk, issues] of this.issuesCache.entries()) {
        if (eligibleKdtk && !eligibleKdtk.has(kdtk)) continue;

        issues.forEach((issue) => {
          if (issuesByCategory[issue.category]) {
            issuesByCategory[issue.category].count++;
            if (!issuesByCategory[issue.category].stores.includes(kdtk)) {
              issuesByCategory[issue.category].stores.push(kdtk);
            }
          }
        });
      }

      return {
        data: Object.values(issuesByCategory).sort((a, b) => a.order - b.order),
      };
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error getIssuesByCategory: ${error.message}`,
      );
      throw error;
    }
  }

  async getExportData(options = {}) {
    const { cabang = "All", periode, searchQuery, ruleKeys } = options;
    if (!periode) throw new Error("Periode wajib diisi");

    try {
      await this.ensureDataLoaded(periode);
      await storeService.ensureInitialized();
      await ruleEngine.ensureInitialized();

      const summary = await this.getSummary({ cabang, periode });

      await this.loadIssuesCache(periode);
      this.ensureStoreNameMap();

      const getName = (k) => {
        return this.storeNameMap.get(k) || "-";
      };

      const notes = await this.getCachedNotes().catch(() => []);
      const notesByKey = new Map(
        notes
          .filter((n) => n.tableName === "screening_praclosing")
          .map((n) => [n.unixKey, n]),
      );

      const allStores = this.prepClosingData.filter(
        (i) =>
          i.PRD_CLOSING === periode && (cabang === "All" || i.CAB === cabang),
      );

      const ruleKeySet =
        Array.isArray(ruleKeys) && ruleKeys.length > 0
          ? new Set(ruleKeys)
          : null;

      const stores = [];
      const issuesBreakdown = [];

      const issuesMapByStore = new Map();

      // Map CAB based on valid scope
      const storeCabMap = new Map();
      for (const s of allStores) {
        storeCabMap.set(s.KDTK, s.CAB);
      }

      for (const [kdtk, issues] of this.issuesCache.entries()) {
        const cab = storeCabMap.get(kdtk);
        if (!cab) continue; // Skip if no cab mapped (meaning out of loop/cabang filter scope)

        const filteredIssues = ruleKeySet
          ? issues.filter((iss) => ruleKeySet.has(iss.ruleKey))
          : issues;
        issuesMapByStore.set(kdtk, filteredIssues);
        for (const iss of filteredIssues) {
          issuesBreakdown.push({
            CAB: cab,
            KDTK: kdtk,
            ruleKey: iss.ruleKey,
            ruleName: iss.ruleName,
            category: iss.category,
            severity: iss.severity || null,
            message: iss.message || "",
          });
        }
      }

      for (const item of allStores) {
        const nm = getName(item.KDTK);
        const unixKey = `${item.KDTK}${item.PRD_CLOSING}`;
        const note = notesByKey.get(unixKey) || null;
        const storeIssues = issuesMapByStore.get(item.KDTK) || [];

        const storeRow = {
          RECID: item.RECID,
          CAB: item.CAB,
          KDTK: item.KDTK,
          NAMA: nm,
          PRD_CLOSING: item.PRD_CLOSING,
          TOTAL_RULES: item.TOTAL_RULES,
          PASSED_RULES: item.PASSED_RULES,
          FAILED_RULES: item.FAILED_RULES,
          CRITICAL_ISSUES: item.CRITICAL_ISSUES,
          IS_READY: item.IS_READY,
          LAST_SCREENED: item.LAST_SCREENED,
          UPDTIME: item.UPDTIME,
          note: note
            ? {
                unixKey: note.unixKey,
                noteText: note.noteText,
                pic: note.pic,
                fullName: note.fullName || null,
                updated_at: note.updated_at || null,
              }
            : null,
        };

        stores.push(storeRow);
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        stores.splice(
          0,
          stores.length,
          ...stores.filter((item) => {
            const fields = [
              "CAB",
              "KDTK",
              "NAMA",
              "PASSED_RULES",
              "FAILED_RULES",
              "CRITICAL_ISSUES",
              "IS_READY",
            ];
            const matchNormal = fields.some(
              (field) =>
                item[field] && item[field].toString().toLowerCase().includes(q),
            );
            const matchNote =
              item.note &&
              ((item.note.noteText &&
                item.note.noteText.toLowerCase().includes(q)) ||
                (item.note.pic && item.note.pic.toLowerCase().includes(q)) ||
                (item.note.fullName &&
                  item.note.fullName.toLowerCase().includes(q)));
            const storeIssues = issuesMapByStore.get(item.KDTK) || [];
            let matchIssue = storeIssues.some((iss) => {
              const msg = (iss.message || "").toString().toLowerCase();
              const rname = (iss.ruleName || "").toLowerCase();
              return msg.includes(q) || rname.includes(q);
            });
            return matchNormal || matchNote || matchIssue;
          }),
        );
      }

      const rulesSummary = await this.getRulesSummary({ cabang, periode });

      return {
        summary: summary.data,
        stores,
        issuesBreakdown,
        rulesSummary: rulesSummary.data,
      };
    } catch (error) {
      logger.error(
        `[prep_closing.service] Error getExportData: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get Rules Configuration
   */
  async getRulesConfig() {
    try {
      const rulesPath = path.resolve(config.rulesPath);
      const data = await fs.readFile(rulesPath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      logger.error(
        `[prep_closing.service] Failed to get rules config: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Update Rules Configuration
   */
  async updateRulesConfig(rulesData, username) {
    try {
      const rulesPath = path.resolve(config.rulesPath);
      rulesData.lastUpdated = new Date().toISOString();
      rulesData.updatedBy = username;
      await fs.writeFile(rulesPath, JSON.stringify(rulesData, null, 2), "utf8");

      // Force reload the rule engine so the next execution picks up new rules
      await ruleEngine.forceReload();
      logger.info(
        `[prep_closing.service] Rules configuration updated by ${username}`,
      );

      return rulesData;
    } catch (error) {
      logger.error(
        `[prep_closing.service] Failed to update rules config: ${error.message}`,
      );
      throw error;
    }
  }
}

export default new PrepClosingService();
