/**
 * Service for Penyesuaian (Sesuai Toko)
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import SesuaiToko from "./penyesuaian.model.js";
import dbStore from "../../config/db_store.js";
import config from "./penyesuaian.config.js";
import storeService from "../store/storeService.js";
import pLimit from "p-limit";
import moment from "moment-timezone";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import noteCategoriesService from "../note_categories/noteCategories.service.js";
import notesService from "../notes/notes.service.js";
import progressService from "../progress/progress.service.js";

// Path untuk file JSON penyesuaian
const PENYESUAIAN_JSON_PATH = path.join(process.cwd(), "data/penyesuaian.json");

class PenyesuaianService {
  constructor() {
    this.penyesuaianData = [];
    this.initialized = false;

    // TTL Cache Management
    this.lastLoadTime = null;
    this.TTL = 60 * 60 * 1000; // 1 hour in milliseconds
    this.isLoading = false; // Prevent concurrent loading
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(PENYESUAIAN_JSON_PATH);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(PENYESUAIAN_JSON_PATH, "utf8");
        const rawData = JSON.parse(data);

        // Ensure numeric fields are numbers when loading from JSON
        this.penyesuaianData = rawData.map(item => ({
          ...item,
          BEGBAL: Number(item.BEGBAL) || 0,
          TRFIN: Number(item.TRFIN) || 0,
          TRFOUT: Number(item.TRFOUT) || 0,
          RP_SALES: Number(item.RP_SALES) || 0,
          RP_RETUR_SALES: Number(item.RP_RETUR_SALES) || 0,
          ADJ: Number(item.ADJ) || 0,
          BA: Number(item.BA) || 0,
          BS: Number(item.BS) || 0,
          ACOST: Number(item.ACOST) || 0,
          LCOST: Number(item.LCOST) || 0,
          STOCK: Number(item.STOCK) || 0,
          RP_STOCK: Number(item.RP_STOCK) || 0,
          SESUAI: Number(item.SESUAI) || 0,
        }));

        logger.info(`Loaded ${this.penyesuaianData.length} penyesuaian records from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.penyesuaianData = [];
          await this.saveToFile();
          logger.info("Created new penyesuaian.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize penyesuaian service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save penyesuaian data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(PENYESUAIAN_JSON_PATH, JSON.stringify(this.penyesuaianData, null, 2));
      logger.debug(`Saved ${this.penyesuaianData.length} penyesuaian records to JSON file`);
    } catch (error) {
      logger.error(`Failed to save penyesuaian to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if cached data is still valid based on TTL
   * @returns {boolean} True if cache is valid, false if expired
   */
  isCacheValid() {
    if (!this.initialized || !this.lastLoadTime) {
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
    this.initialized = false;
    this.lastLoadTime = null;
    this.isLoading = false;
    logger.info("Penyesuaian cache invalidated manually");
  }

  /**
   * Ensure data is loaded with TTL-based lazy loading
   * Only loads data when needed and cache is expired
   */
  async ensureDataLoaded() {
    // If cache is still valid, no need to reload
    if (this.isCacheValid()) {
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
      logger.info("Loading penyesuaian data from JSON file (cache expired or empty)");

      await this.initialize();
      this.lastLoadTime = Date.now();

      logger.info(`Data loaded successfully. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Synchronize data from database to JSON file
   * Call this after any write operation to keep JSON in sync
   */
  async syncToJsonFile() {
    try {
      // Get all data from database
      const dbData = await SesuaiToko.findAll();

      // Convert to plain objects and ensure numeric fields are numbers
      this.penyesuaianData = dbData.map(item => {
        const plainItem = item.get({ plain: true });

        return {
          ...plainItem,
          BEGBAL: Number(plainItem.BEGBAL) || 0,
          TRFIN: Number(plainItem.TRFIN) || 0,
          TRFOUT: Number(plainItem.TRFOUT) || 0,
          RP_SALES: Number(plainItem.RP_SALES) || 0,
          RP_RETUR_SALES: Number(plainItem.RP_RETUR_SALES) || 0,
          ADJ: Number(plainItem.ADJ) || 0,
          BA: Number(plainItem.BA) || 0,
          BS: Number(plainItem.BS) || 0,
          ACOST: Number(plainItem.ACOST) || 0,
          LCOST: Number(plainItem.LCOST) || 0,
          STOCK: Number(plainItem.STOCK) || 0,
          RP_STOCK: Number(plainItem.RP_STOCK) || 0,
          SESUAI: Number(plainItem.SESUAI) || 0,
        };
      });

      // Save to file
      await this.saveToFile();

      // Update cache timestamp since we just loaded fresh data
      this.lastLoadTime = Date.now();
      this.initialized = true;

      logger.info(`Synchronized ${this.penyesuaianData.length} penyesuaian records to JSON file`);
      logger.info(`Cache refreshed. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`);

      return this.penyesuaianData.length;
    } catch (error) {
      logger.error(`Failed to synchronize penyesuaian data: ${error.message}`);
      throw error;
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
   * @returns {Promise<Object>} Result with success status and records
   */
  async processSingleStore(store, strPeriode, strYear, strMonth) {
    const { storeCode, cab } = store;
    const results = { success: false, records: [], activeKeys: new Set() };

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

            // Bulk create/update records to database
            await SesuaiToko.bulkCreate(normalizedRecords, {
              updateOnDuplicate: [
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
              ],
            });

            // Collect records and active keys
            results.records = normalizedRecords;
            normalizedRecords.forEach(record => {
              results.activeKeys.add(`${record.KDTK}-${record.PRDCD}`);
            });

            results.success = true;
          }
        } else {
          results.success = true; // Below threshold is still success
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

        // Update resolved records if any
        if (result.activeKeys.size > 0) {
          await this.updateResolvedRecords(storeCab, strPeriode, Array.from(result.activeKeys));
        }

        // Sync to JSON file
        await this.syncToJsonFile();

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

      // Temporary array to collect new records and active keys
      const newRecords = [];
      const activeKeys = new Set(); // Set to store KDTK-PRDCD combinations that still have issues

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

            try {
              const result = await withTimeout(
                this.processSingleStore(store, strPeriode, strYear, strMonth),
                config.parallelProcessing.storeTimeoutMs,
                `process store ${storeCode}`
              );

              if (result.success) {
                if (result.records.length > 0) {
                  newRecords.push(...result.records);
                  result.activeKeys.forEach(key => activeKeys.add(key));
                  await incrementProgress(storeCode, `Success ✅ (${result.records.length} rows)`);
                } else {
                  await incrementProgress(storeCode, "Below threshold ✓");
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

      //update status to progress service
      await progressService.updateProgress(taskId, processedCount, {
        description: "Updating resolved records (RECID = 1)",
        status: "finalizing",
      });

      // Update resolved records (records that no longer meet the threshold)
      if (activeKeys.size > 0) {
        await this.updateResolvedRecords(cabang, strPeriode, Array.from(activeKeys));
      }

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
      if (newRecords.length > 0 || activeKeys.size > 0) {
        await this.syncToJsonFile();
        logger.info(`Synchronized ${newRecords.length} new records from database to JSON file`);
      }

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
        resolvedRecords: activeKeys.size,
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
   * @param {string} cabang - Branch code or 'All'
   * @param {string} periode - Period in YYMM format
   * @param {Array<string>} activeKeys - Array of KDTK-PRDCD combinations that still have issues
   */
  async updateResolvedRecords(cabang, periode, activeKeys) {
    try {
      // Get the database instance
      const model = await SesuaiToko.getModel();
      const sequelize = model.sequelize;
      const { Sequelize } = await import("sequelize");

      // Build the query - CRITICAL: Include RECID='*' condition
      let query = `
        UPDATE sesuai_toko 
        SET RECID = '1' 
        WHERE PERIODE = :periode 
          AND RECID = '*'
      `;

      const replacements = { periode };

      if (cabang !== "All" && cabang !== "ALL") {
        query += ` AND CABANG = :cabang`;
        replacements.cabang = cabang;
      }

      if (activeKeys.length > 0) {
        query += ` AND CONCAT(KDTK, '-', PRDCD) NOT IN (:activeKeys)`;
        replacements.activeKeys = activeKeys;
      }

      const [results, metadata] = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.UPDATE,
      });

      logger.info(
        `[penyesuaian.service] Updated ${metadata} records to RECID='1' for periode ${periode}, cabang ${cabang}`
      );

      return metadata;
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
      // Ensure data is loaded from JSON file
      await this.ensureDataLoaded();

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
   * Get all records without pagination and filtering from JSON file
   * Only return RECID='*' records
   * @param {Object} options - Query options
   * @returns {Promise<Object>} All records
   */
  async getAll(options = {}) {
    const { cabang, periode } = options;

    try {
      // Ensure data is loaded from JSON file
      await this.ensureDataLoaded();

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
   * Get all records with pagination and filtering from JSON file
   * Only return RECID='*' records
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getAllRecords(options = {}) {
    const {
      page = 1,
      limit = 10,
      kdtk,
      cabang,
      periode,
      searchQuery,
      sortColumn = "UPDTIME",
      sortOrder = "DESC",
    } = options;

    try {
      // Ensure data is loaded from JSON file
      await this.ensureDataLoaded();

      // Build filter function (includes RECID='*' filter)
      const filterFn = this.buildFilterFunction({ cabang, periode, kdtk });

      // Filter data
      let filteredData = this.penyesuaianData.filter(filterFn);

      // Apply search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(item => {
          return (
            (item.KDTK && item.KDTK.toLowerCase().includes(query)) ||
            (item.CABANG && item.CABANG.toLowerCase().includes(query)) ||
            (item.PRDCD && item.PRDCD.toLowerCase().includes(query)) ||
            (item.SINGKATAN && item.SINGKATAN.toLowerCase().includes(query)) ||
            (item.PERIODE && item.PERIODE.toLowerCase().includes(query))
          );
        });
      }

      // Sort data
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
      const sanitizedSortColumn = allowedSortColumns.includes(sortColumn) ? sortColumn : "UPDTIME";
      const sanitizedSortOrder = sortOrder && sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

      filteredData.sort((a, b) => {
        let aVal = a[sanitizedSortColumn];
        let bVal = b[sanitizedSortColumn];

        // Handle dates
        if (sanitizedSortColumn === "UPDTIME") {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        // Handle numbers
        if (typeof aVal === "number" || !isNaN(Number(aVal))) {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        }

        if (sanitizedSortOrder === "ASC") {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });

      // Pagination
      const totalRecords = filteredData.length;
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedData = filteredData.slice(startIndex, endIndex);

      const enrichedData = await this.enrichWithNotes(paginatedData);

      return {
        data: enrichedData,
        total: totalRecords,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRecords / parseInt(limit)),
      };
    } catch (error) {
      logger.error(`[penyesuaian.service] Error getting records: ${error.message}`);
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
      // ambil semua notes & categories dari service (cached dengan TTL)
      const [notes, categoryResult] = await Promise.all([
        await notesService.getAll(),
        await noteCategoriesService.getAll(),
      ]);

      const categories = categoryResult.data || [];

      logger.info(
        `[penyesuaian.service] Notes & Categories loaded: ${notes.length} notes, ${categories.length} categories`
      );

      // buat lookup map untuk kategori agar cepat
      const categoryMap = new Map(categories.map(c => [c.id, c]));

      // proses penggabungan data
      return data.map(item => {
        // bentuk unixKey dari sesuai_toko
        const unixKey = `${item.KDTK}${item.PERIODE}${item.PRDCD}`;

        // ambil semua note yang terkait dengan unixKey ini
        const note = notes.find(n => n.unixKey === unixKey);
        if (!note) return { ...item, note: null };

        const category = categoryMap.get(note.categoryId) || null;

        // kembalikan data + notes
        return {
          ...item,
          note: {
            ...note,
            category,
          },
        };
      });
    } catch (err) {
      logger.error(`[penyesuaian.service] Error enriching data with notes: ${err.message}`);
      return data;
    }
  }
}

export default new PenyesuaianService();
