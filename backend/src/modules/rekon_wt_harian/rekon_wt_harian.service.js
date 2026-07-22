/**
 * Service for WT reconciliation
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import logger from "../../config/logger.js";
import dbStore from "../../config/db_store.js";
import RekonWtHarian from "../../models/rekon_wt_harian.model.js";
import config from "../../config/rekon_wt_harian.config.js";
import progressService from "../progress/progress.service.js";
import storeService from "../../modules/store/storeService.js";
import wrcUtils from "../../utils/wrc.utils.js";
import screeningGuard from "../../utils/screeningGuard.js";
import RekapRemoteService from "../rekap_remote/rekap_remote.service.js";
import RekapRemoteStagingService from "../rekap_remote/rekap_remote_staging.service.js";
import notesService from "../notes/notes.service.js";

// Path untuk file JSON rekon_wt_harian
const REKON_WT_HARIAN_JSON_PATH = path.join(process.cwd(), "data/rekon_wt_harian.json");

class RekonWtHarianService {
  constructor() {
    this.rekonData = [];
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
      const dir = path.dirname(REKON_WT_HARIAN_JSON_PATH);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(REKON_WT_HARIAN_JSON_PATH, "utf8");
        const rawData = JSON.parse(data);

        // Ensure numeric fields are numbers when loading from JSON
        this.rekonData = rawData.map(item => ({
          ...item,
          gross_wrc: Number(item.gross_wrc) || 0,
          gross_store: Number(item.gross_store) || 0,
          gross_idm_wrc: Number(item.gross_idm_wrc) || 0,
          gross_idm_store: Number(item.gross_idm_store) || 0,
          ppn_wrc: Number(item.ppn_wrc) || 0,
          ppn_store: Number(item.ppn_store) || 0,
          ppn_idm_wrc: Number(item.ppn_idm_wrc) || 0,
          ppn_idm_store: Number(item.ppn_idm_store) || 0,
          selisih_gross: Number(item.selisih_gross) || 0,
          selisih_ppn: Number(item.selisih_ppn) || 0,
          selisih_gross_idm: Number(item.selisih_gross_idm) || 0,
          selisih_ppn_idm: Number(item.selisih_ppn_idm) || 0,
        }));

        logger.info(`Loaded ${this.rekonData.length} rekon_wt_harian records from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.rekonData = [];
          await this.saveToFile();
          logger.info("Created new rekon_wt_harian.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize rekon_wt_harian service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save rekon_wt_harian data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(REKON_WT_HARIAN_JSON_PATH, JSON.stringify(this.rekonData, null, 2));
      logger.debug(`Saved ${this.rekonData.length} rekon_wt_harian records to JSON file`);
    } catch (error) {
      logger.error(`Failed to save rekon_wt_harian to file: ${error.message}`);
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
   * Invalidate cache manually (useful when database is updated)
   */
  invalidateCache() {
    this.rekonData = [];
    this.initialized = false;
    this.lastLoadTime = null;
    this.isLoading = false;
    logger.info("Cache invalidated manually");
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
      logger.info("Loading data from JSON file (cache expired or empty)");

      await this.initialize();
      this.lastLoadTime = Date.now();

      logger.info(`Data loaded successfully. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`);
    } finally {
      this.isLoading = false;
    }
  }



  /**
   * Synchronize data from database to JSON file
   */
  async syncToJsonFile() {
    try {
      // Get all data from database
      const dbData = await RekonWtHarian.findAll();

      // Convert to plain objects and ensure numeric fields are numbers
      this.rekonData = dbData.map(item => {
        const plainItem = item.get({ plain: true });

        // Convert numeric fields to numbers to prevent string conversion
        return {
          ...plainItem,
          gross_wrc: Number(plainItem.gross_wrc) || 0,
          gross_store: Number(plainItem.gross_store) || 0,
          gross_idm_wrc: Number(plainItem.gross_idm_wrc) || 0,
          gross_idm_store: Number(plainItem.gross_idm_store) || 0,
          ppn_wrc: Number(plainItem.ppn_wrc) || 0,
          ppn_store: Number(plainItem.ppn_store) || 0,
          ppn_idm_wrc: Number(plainItem.ppn_idm_wrc) || 0,
          ppn_idm_store: Number(plainItem.ppn_idm_store) || 0,
          selisih_gross: Number(plainItem.selisih_gross) || 0,
          selisih_ppn: Number(plainItem.selisih_ppn) || 0,
          selisih_gross_idm: Number(plainItem.selisih_gross_idm) || 0,
          selisih_ppn_idm: Number(plainItem.selisih_ppn_idm) || 0,
        };
      });

      // Save to file
      await this.saveToFile();

      // Update cache timestamp since we just loaded fresh data
      this.lastLoadTime = Date.now();
      this.initialized = true;

      logger.info(`Synchronized ${this.rekonData.length} rekon_wt_harian records to JSON file`);
      logger.info(`Cache refreshed. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`);
      return this.rekonData.length;
    } catch (error) {
      logger.error(`Failed to synchronize rekon_wt_harian data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper function to calculate differences between WRC and store data
   * @param {Object} wrcItem - WRC data item
   * @param {Object} storeItem - Store data item
   * @returns {Object} Object containing calculated differences and significance check
   */
  _calculateDifferences(wrcItem, storeItem) {
    // Calculate differences
    const grossDiff = (wrcItem.GROSS || 0) - (storeItem.GROSS || 0);
    const ppnDiff = (wrcItem.PPN || 0) - (storeItem.PPN || 0);
    const grossIdmDiff = (wrcItem.GROSS_IDM || 0) - (storeItem.GROSS_IDM || 0);
    const ppnIdmDiff = (wrcItem.PPN_IDM || 0) - (storeItem.PPN_IDM || 0);

    // Check if differences exceed threshold (using config.differenceThreshold)
    const hasSignificantDifference =
      Math.abs(grossDiff) > config.differenceThreshold ||
      Math.abs(ppnDiff) > config.differenceThreshold ||
      Math.abs(grossIdmDiff) > config.differenceThreshold ||
      Math.abs(ppnIdmDiff) > config.differenceThreshold;

    return {
      grossDiff,
      ppnDiff,
      grossIdmDiff,
      ppnIdmDiff,
      hasSignificantDifference,
    };
  }

  /**
   * Helper function to calculate differences for single item (backward compatibility)
   * @param {Object} item - Data item containing WRC and store values
   * @returns {Object} Object containing calculated differences
   */
  _calculateDifferencesLegacy(item) {
    return {
      selisihGross: item.selisih_gross || item.gross_wrc - item.gross_store || 0,
      selisihPpn: item.selisih_ppn || item.ppn_wrc - item.ppn_store || 0,
      selisihGrossIdm: item.selisih_gross_idm || item.gross_idm_wrc - item.gross_idm_store || 0,
      selisihPpnIdm: item.selisih_ppn_idm || item.ppn_idm_wrc - item.ppn_idm_store || 0,
    };
  }

  /**
   * Helper function to calculate summary statistics from filtered data
   * @param {Array} filteredData - Array of filtered reconciliation data
   * @returns {Object} Summary statistics object
   */
  _calculateSummaryStats(filteredData) {
    // Calculate summary statistics
    const uniqueShops = new Set(filteredData.map(item => item.shop));

    // Initialize summary object
    const summary = {
      jml_toko: uniqueShops.size,
      sel_gross: 0,
      sel_ppn: 0,
      sel_gross_idm: 0,
      sel_ppn_idm: 0,
      max_gross: Number.MIN_SAFE_INTEGER,
      min_gross: Number.MAX_SAFE_INTEGER,
      max_ppn: Number.MIN_SAFE_INTEGER,
      min_ppn: Number.MAX_SAFE_INTEGER,
      max_gross_idm: Number.MIN_SAFE_INTEGER,
      min_gross_idm: Number.MAX_SAFE_INTEGER,
      max_ppn_idm: Number.MIN_SAFE_INTEGER,
      min_ppn_idm: Number.MAX_SAFE_INTEGER,
    };

    // Calculate sums and find min/max values
    filteredData.forEach(item => {
      const differences = this._calculateDifferencesLegacy(item);

      // Sum values
      summary.sel_gross += differences.selisihGross;
      summary.sel_ppn += differences.selisihPpn;
      summary.sel_gross_idm += differences.selisihGrossIdm;
      summary.sel_ppn_idm += differences.selisihPpnIdm;

      // Find max/min values
      summary.max_gross = Math.max(summary.max_gross, differences.selisihGross);
      summary.min_gross = Math.min(summary.min_gross, differences.selisihGross);

      summary.max_ppn = Math.max(summary.max_ppn, differences.selisihPpn);
      summary.min_ppn = Math.min(summary.min_ppn, differences.selisihPpn);

      summary.max_gross_idm = Math.max(summary.max_gross_idm, differences.selisihGrossIdm);
      summary.min_gross_idm = Math.min(summary.min_gross_idm, differences.selisihGrossIdm);

      summary.max_ppn_idm = Math.max(summary.max_ppn_idm, differences.selisihPpnIdm);
      summary.min_ppn_idm = Math.min(summary.min_ppn_idm, differences.selisihPpnIdm);
    });

    // Handle edge cases where no data is found
    if (filteredData.length === 0) {
      summary.max_gross = 0;
      summary.min_gross = 0;
      summary.max_ppn = 0;
      summary.min_ppn = 0;
      summary.max_gross_idm = 0;
      summary.min_gross_idm = 0;
      summary.max_ppn_idm = 0;
      summary.min_ppn_idm = 0;
    }

    return summary;
  }

  /**
   * Helper function to calculate group statistics (type or branch)
   * @param {Array} data - Array of data to group
   * @param {string} groupKey - Key to group by ('tipe' or 'cab')
   * @returns {Array} Array of group statistics
   */
  _calculateGroupStats(data, groupKey) {
    const groupMap = new Map();

    data.forEach(item => {
      const groupValue = item[groupKey];
      if (!groupMap.has(groupValue)) {
        groupMap.set(groupValue, {
          [groupKey]: groupValue,
          count: 0,
          diffGross: 0,
          diffPpn: 0,
        });
      }

      const groupData = groupMap.get(groupValue);
      const differences = this._calculateDifferencesLegacy(item);

      groupData.count += 1;
      groupData.diffGross += differences.selisihGross;
      groupData.diffPpn += differences.selisihPpn;
    });

    return Array.from(groupMap.values());
  }

  /**
   * Reconcile data for all branches
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   * @param {number} totalStores - Total stores across all branches
   * @returns {Promise<Object>} Reconciliation results for all branches
   */
  async reconcileAllBranches(period, progressId, totalStores, force = false) {
    try {
      await storeService.ensureInitialized();

      const allStores = storeService.stores;
      const branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];

      logger.info(`Found ${branches.length} branches to process`);

      let processedStores = 0;
      let storesWithDifferences = 0;
      let totalDifferences = 0;

      const onStoreProcessed = (result, cab) => {
        if (result && result.errors.length === 0) {
          processedStores++;
        }
        if (result && result.differences && result.differences.length > 0) {
          storesWithDifferences++;
          totalDifferences += result.differences.length;
        }
        const percentage = totalStores > 0 ? Math.round((processedStores / totalStores) * 100) : 0;
        progressService.updateProgress(progressId, processedStores, {
          description: `🔍 ${result?.storeCode || ''} → Selesai (${processedStores}/${totalStores}) — Cabang: ${cab}`,
          status: "screening_stores",
          currentStore: result?.storeCode,
          currentBranch: cab,
          storesWithDifferences,
          totalDifferences,
        });
      };

      const results = {
        success: true,
        totalBranches: branches.length,
        processedBranches: 0,
        branchesWithDifferences: 0,
        totalDifferences: 0,
        details: [],
        progressId,
      };

      const BRANCH_CONCURRENCY_LIMIT = config.parallelProcessing?.branchConcurrencyLimit || 3;
      logger.info(`Processing ${branches.length} branches with concurrency limit of ${BRANCH_CONCURRENCY_LIMIT}`);

      const processConcurrentBranches = async (branchCodes, limit) => {
        const results = [];
        const executing = [];

        for (const cab of branchCodes) {
          const promise = this.processBranch(cab, period, progressId, onStoreProcessed, force).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
          });

          results.push(promise);
          executing.push(promise);

          if (executing.length >= limit) {
            await Promise.race(executing);
          }
        }

        return await Promise.allSettled(results);
      };

      logger.info(`Starting parallel processing of ${branches.length} branches...`);
      const branchStartTime = Date.now();

      const allBranchResults = await processConcurrentBranches(branches, BRANCH_CONCURRENCY_LIMIT);

      const branchEndTime = Date.now();
      logger.info(`Completed branch parallel processing in ${(branchEndTime - branchStartTime) / 1000} seconds`);

      let totalProcessedStores = 0;
      let totalStoresWithDifferences = 0;

      for (const result of allBranchResults) {
        if (result.status === "fulfilled" && result.value) {
          const branchResult = result.value;
          results.processedBranches++;

          totalProcessedStores += branchResult.processedStores || 0;
          totalStoresWithDifferences += branchResult.storesWithDifferences || 0;

          if (branchResult.storesWithDifferences > 0) {
            results.branchesWithDifferences++;
            results.totalDifferences += branchResult.totalDifferences;
            results.details.push({
              branch: branchResult.branch,
              storesWithDifferences: branchResult.storesWithDifferences,
              totalDifferences: branchResult.totalDifferences,
              storeDetails: branchResult.details,
            });
          }
        } else if (result.status === "rejected") {
          logger.error(`Branch processing error: ${result.reason}`);
        }
      }

      results.totalProcessedStores = totalProcessedStores;
      results.totalStoresWithDifferences = totalStoresWithDifferences;
      results.timestamp = new Date().toISOString();
      results.period = period;

      await progressService.completeProgress(progressId);

      logger.info(`Completed processing ${results.processedBranches}/${results.totalBranches} branches`);
      return results;
    } catch (error) {
      logger.error(`Error reconciling all branches: ${error.message}`);

      if (progressId) {
        await progressService.failProgress(progressId, {
          description: `Gagal memproses semua cabang: ${error.message}`,
          status: "failed",
        });
      }

      throw error;
    } finally {
      progressService.clearProcessingStores(progressId);
    }
  }

  /**
   * Process a single branch (extracted from reconcileAllBranches for parallel processing)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress ID for tracking reconciliation progress
   * @param {Function} onStoreProcessed - Callback invoked after each store is processed
   * @returns {Promise<Object>} Branch processing result
   */
  async processBranch(cab, period, progressId, onStoreProcessed, force = false) {
    try {
      logger.info(`Processing branch ${cab}`);
      const branchResult = await this.reconcileData(cab, period, progressId, onStoreProcessed, force);
      return branchResult;
    } catch (error) {
      logger.error(`Error processing branch ${cab}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reconcile all branches with progress tracking (non-blocking)
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   * @param {number} totalStores - Total stores across all branches
   */
  async reconcileAllBranchesWithProgress(period, progressId, totalStores, force = false) {
    try {
      setTimeout(async () => {
        try {
          await this.reconcileAllBranches(period, progressId, totalStores, force);
        } catch (error) {
          logger.error(`Error in background reconciliation: ${error.message}`);
        }
      }, 0);

      logger.info(`Started non-blocking reconciliation for all branches with progress ID: ${progressId}`);
    } catch (error) {
      logger.error(`Error starting non-blocking reconciliation: ${error.message}`);
      await progressService.failProgress(progressId, {
        description: `Gagal memulai rekonsiliasi: ${error.message}`,
        status: "failed",
      });
    }
  }

  /**
   * Reconcile data for a single branch with progress tracking (non-blocking)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   * @param {number} totalStores - Total stores in branch
   */
  async reconcileDataWithProgress(cab, period, progressId, totalStores, force = false) {
    try {
      setTimeout(async () => {
        try {
          await storeService.ensureInitialized();

          let processedStores = 0;
          let storesWithDifferences = 0;
          let totalDifferences = 0;

          const onStoreProcessed = (result) => {
            if (result && result.errors.length === 0) {
              processedStores++;
            }
            if (result && result.differences && result.differences.length > 0) {
              storesWithDifferences++;
              totalDifferences += result.differences.length;
            }
            const percentage = totalStores > 0 ? Math.round((processedStores / totalStores) * 100) : 0;
            progressService.updateProgress(progressId, processedStores, {
              description: `🔍 ${result?.storeCode || ''} → Selesai (${processedStores}/${totalStores})`,
              status: "screening_stores",
              currentStore: result?.storeCode,
              storesWithDifferences,
              totalDifferences,
            });
          };

          const result = await this.reconcileData(cab, period, progressId, onStoreProcessed, force);

          progressService.updateProgress(progressId, processedStores, {
            description: "📊 Proses simpan database...",
            status: "finalizing",
          });
          await this.saveDifferencesToDatabase(cab, period);

          progressService.updateProgress(progressId, processedStores, {
            description: "💾 Menyimpan hasil ke file...",
            status: "finalizing",
          });
          await this.syncToJsonFile();

          await progressService.completeProgress(progressId);

          logger.info(`Reconciliation completed for ${cab}: ${processedStores}/${totalStores} stores processed`);
          logger.info(
            `Completed reconciliation for ${cab}: ${storesWithDifferences}/${totalStores} stores with differences`
          );
        } catch (error) {
          logger.error(`Error in background reconciliation: ${error.message}`);
          await progressService.failProgress(progressId, {
            description: `Gagal rekonsiliasi: ${error.message}`,
            status: "failed",
          });
        }
      }, 0);

      logger.info(`Started non-blocking reconciliation for branch ${cab} with progress ID: ${progressId}`);
    } catch (error) {
      logger.error(`Error starting non-blocking reconciliation: ${error.message}`);
      await progressService.failProgress(progressId, {
        description: `Gagal memulai rekonsiliasi: ${error.message}`,
        status: "failed",
      });
    }
  }

  /**
   * Start reconciliation process for specific shop (non-blocking)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} toko - Shop code
   * @returns {Promise<Object>} Reconciliation result
   */
  async reconcileSpecificShop(cab, period, toko) {
    let wrcDataFile = null; // Declare outside try block for cleanup access

    try {
      // Get WRC data
      const shops = [toko]; // toko is a single shop code string, not an array
      wrcDataFile = await wrcUtils.getWrcData(cab, period, "wt", config.queries.wrc, shops);

      if (!wrcDataFile) {
        throw new Error("No WRC data found");
      }

      // Read WRC data from file
      const wrcDataRaw = await fs.readFile(wrcDataFile, "utf8");
      const wrcData = JSON.parse(wrcDataRaw);

      // Ensure storeService is initialized
      await storeService.ensureInitialized();

      // Get specific store by code
      const store = await storeService.getStoreByCode(toko);
      if (!store) {
        throw new Error(`Store with code ${toko} not found`);
      }

      // Validate that store belongs to the specified branch
      if (store.branch !== cab && store.cab !== cab) {
        throw new Error(`Store ${toko} does not belong to branch ${cab}`);
      }

      logger.info(`Starting reconciliation for specific shop: ${toko} in branch ${cab}`);

      // Update existing data to mark as reconciled (recid = 1) and update timestamp
      await RekonWtHarian.update(
        {
          recid: "1",
          updtime: new Date(),
        },
        {
          where: {
            cab: cab,
            periode: period,
            shop: toko,
          },
        }
      );
      logger.info(`Updated existing data to recid=1 for shop ${toko} in ${cab} for period ${period}`);

      // Process the specific store
      const result = await this.processStore(store, cab, period, wrcData);

      try {
        const saveLogResult = await RekapRemoteService.saveLogsToDatabase();
        logger.info(`Rekap_remote logs saved: ${JSON.stringify(saveLogResult)}`);
      } catch (error) {
        logger.error(`Error saving rekap_remote logs: ${error.message}`);
      }

      // Save differences to database for this specific shop (in-memory, no temp files)
      const singleStoreMap = new Map();
      if (result.differences && result.differences.length > 0) {
        singleStoreMap.set(toko, result.differences);
      }
      await this.saveDifferencesToDatabase(cab, period, null, singleStoreMap);
      await this.syncToJsonFile();

      // Clean up temporary WRC data file
      try {
        await fs.unlink(wrcDataFile);
        logger.info(`Temporary file ${wrcDataFile} cleaned up successfully`);
      } catch (cleanupError) {
        logger.warn(`Error deleting temporary file ${wrcDataFile}: ${cleanupError.message}`);
      }

      logger.info(`Completed reconciliation for shop ${toko} in branch ${cab}`);

      return {
        success: true,
        shop: toko,
        cab: cab,
        period: period,
        processedStores: 1,
        storesWithDifferences: result.hasDifferences ? 1 : 0,
        totalDifferences: result.totalDifferences || 0,
        message: `Rekonsiliasi selesai untuk toko ${toko}`,
      };
    } catch (error) {
      logger.error(`Error in shop reconciliation for ${toko}: ${error.message}`);

      // Clean up temporary WRC data file even on error
      if (wrcDataFile) {
        try {
          await fs.unlink(wrcDataFile);
          logger.info(`Temporary file ${wrcDataFile} cleaned up after error`);
        } catch (cleanupError) {
          logger.warn(`Error deleting temporary file ${wrcDataFile} after error: ${cleanupError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Get query for store data
   * @param {string} period - Period in YYMM format
   * @returns {string} SQL query
   */
  getStoreQuery(period) {
    const year = "20" + period.substring(0, 2);
    const month = period.substring(2, 4);
    const periodStr = `${year}-${month}`;

    return config.queries.store.replace("{period}", periodStr);
  }

  /**
   * Get data from WRC for a specific period
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} tableType - Table type (wt, dt, pr)
   * @returns {Promise<Array>} Array of WRC data
   */
  async getWrcData(cab, period, tableType = "wt") {
    return wrcUtils.getWrcData(cab, period, tableType, config.queries.wrc);
  }

  /**
   * Process a list of stores with wave-based retry (reusable, no progress coupling)
   * Pure screening logic — caller manages progress via onStoreProcessed callback.
   * @param {Array} stores - Array of store objects to process
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data for the branch
   * @param {Function} onStoreProcessed - Callback invoked after each store is processed
   * @param {Object} [options] - Additional options
   * @param {number} [options.concurrencyLimit] - Max concurrent stores (default from config)
   * @param {number} [options.maxWaves] - Max retry waves (default 3)
   * @param {boolean} [options.force] - Force re-screening even if already screened today
   * @param {string} [options.progressId] - Progress ID for abort checking only
   * @returns {Promise<Object>} Processing results
   */
  async processStoreList(stores, cab, period, wrcData, onStoreProcessed, options = {}) {
    const {
      concurrencyLimit = config.parallelProcessing?.concurrencyLimit || 5,
      maxWaves = 3,
      force = false,
      progressId = null, // Only for abort checking, NOT for progress updates
    } = options;

    const results = {
      success: true,
      totalStores: stores.length,
      processedStores: 0,
      storesWithDifferences: 0,
      totalDifferences: 0,
      details: [],
      waves: [], // Track wave processing
      differencesMap: new Map(), // Step 6: storeCode → differences[] (in-memory, no temp files)
    };

    logger.info(`Starting wave-based processing of ${stores.length} stores with ${maxWaves} waves max`);
    const totalStartTime = Date.now();

    // Process stores in waves, retrying timeout stores
    let currentStores = stores.slice(); // Copy of all stores
    let wave = 1;

    while (wave <= maxWaves && currentStores.length > 0) {
      logger.info(`\n🌊 Starting Wave ${wave} with ${currentStores.length} stores...`);
      const waveStartTime = Date.now();

      // Process current wave of stores (onStoreProcessed fires real-time per store inside processStoreWave)
      const waveResults = await this.processStoreWave(currentStores, cab, period, wrcData, concurrencyLimit, wave, force, progressId, onStoreProcessed);

      const waveEndTime = Date.now();
      const waveDuration = (waveEndTime - waveStartTime) / 1000;

      // Process wave results
      const timeoutStores = [];
      const completedStores = [];
      const storeErrors = [];

      for (const result of waveResults) {
        if (result.status === "fulfilled" && result.value) {
          const storeResult = result.value;

          // Handle skipped stores (screening guard) — progress already reported via real-time callback
          if (storeResult.skipped) {
            results.processedStores++;
            logger.info(`[Wave ${wave}] ${storeResult.storeCode}: Skipped — ${storeResult.skipReason}`);
            continue;
          }

          // Check if store timed out - be more specific about timeout detection
          const isTimeout =
            storeResult.errors &&
            storeResult.errors.some(
              error =>
                error.includes("Processing timeout after") ||
                error.includes("Query timeout") ||
                error.toLowerCase().includes("timeout")
            );

          logger.debug(
            `[Wave ${wave}] ${storeResult.storeCode}: isTimeout=${isTimeout}, errors=${JSON.stringify(storeResult.errors)}`
          );

          if (isTimeout && wave < maxWaves) {
            // Store timed out, add to retry list
            const store = currentStores.find(s => s.storeCode === storeResult.storeCode);
            if (store) {
              timeoutStores.push(store);
              const msg = `[Wave ${wave}] ${storeResult.storeCode} timeout - will retry in next wave`;
              logger.warn(`${msg}`);
              await RekapRemoteService.addToTemp(cab, storeResult.storeCode, "rekon_wt_harian", `${msg}`);
            }
          } else {
            // Collect non-timeout errors
            if (storeResult.errors && storeResult.errors.length > 0 && !isTimeout) {
              storeErrors.push({
                store: storeResult.storeCode,
                storeName: storeResult.storeName,
                errors: storeResult.errors,
              });
            } else {
              // Store completed (successfully or permanently failed)
              completedStores.push(storeResult);
              results.processedStores++;

              // Report progress for finalized stores WITH errors (not reported in .then())
              // Only for permanent timeout (last wave), NOT for connection errors
              if (onStoreProcessed && storeResult.errors && storeResult.errors.length > 0) {
                // Clear errors so callback counts this as finalized (no more retries)
                onStoreProcessed({ ...storeResult, errors: [] }, cab);
              }
            }

            // Count successful differences
            logger.debug(
              `[Wave ${wave}] ${storeResult.storeCode}: differences found = ${
                storeResult.differences ? storeResult.differences.length : "undefined"
              }`
            );

            if (storeResult.differences && storeResult.differences.length > 0) {
              results.storesWithDifferences += 1;
              results.totalDifferences += storeResult.differences.length;
              results.details.push({
                store: storeResult.storeCode,
                storeName: storeResult.storeName,
                differences: storeResult.differences.length,
              });
              // Step 6: accumulate full differences in memory (no temp files)
              results.differencesMap.set(storeResult.storeCode, storeResult.differences);
              logger.info(
                `[Wave ${wave}] ${storeResult.storeCode}: Added ${storeResult.differences.length} differences. Total: ${results.totalDifferences}, Stores with differences: ${results.storesWithDifferences}`
              );
            } else {
              logger.debug(`[Wave ${wave}] ${storeResult.storeCode}: No differences found`);
            }
          }
        } else if (result.status === "rejected") {
          logger.error(`Unexpected store processing rejection: ${result.reason}`);
          storeErrors.push({
            store: "unknown",
            storeName: "unknown",
            errors: [`Unexpected error: ${result.reason}`],
          });
        }
      }

      // Save wave results
      results.waves.push({
        wave: wave,
        duration: waveDuration,
        attempted: currentStores.length,
        completed: completedStores.length,
        timeouts: timeoutStores.length,
        errors: storeErrors.length,
      });

      logger.info(
        `🌊 Wave ${wave} completed in ${waveDuration}s: ${completedStores.length} completed, ${timeoutStores.length} timeouts, ${storeErrors.length} errors`
      );

      if (timeoutStores.length > 0) {
        logger.info(`⚠️ Timeout stores in wave ${wave}: ${timeoutStores.map(s => s.storeCode).join(", ")}`);
      }

      // Prepare for next wave with timeout stores
      currentStores = timeoutStores;
      wave++;

      // Add brief delay between waves to let resources recover
      if (currentStores.length > 0) {
        logger.info(`⏳ Waiting 2 seconds before next wave... (${currentStores.length} stores will be retried)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Handle any remaining timeout stores after max waves
    if (currentStores.length > 0) {
      logger.warn(`⚠️ ${currentStores.length} stores still timeout after ${maxWaves} waves, marking as failed`);
      const failedStores = currentStores.map(store => ({
        store: store.storeCode,
        storeName: store.storeName,
        errors: [`Failed after ${maxWaves} waves - persistent timeout`],
      }));

      // Log permanently failed stores to rekap_remote
      for (const store of currentStores) {
        await RekapRemoteService.addToTemp(
          cab,
          store.storeCode,
          "rekon_wt_harian",
          "failure",
          `Failed after ${maxWaves} waves - persistent timeout`
        );
      }

      if (!results.storeErrors) results.storeErrors = [];
      results.storeErrors.push(...failedStores);
    }

    const totalEndTime = Date.now();
    const totalDuration = (totalEndTime - totalStartTime) / 1000;

    logger.info(
      `\n🎯 All waves completed in ${totalDuration}s: ${results.processedStores}/${results.totalStores} stores processed`
    );

    // Add timestamp and summary to results
    results.timestamp = new Date().toISOString();
    results.branch = cab;
    results.period = period;
    results.totalDuration = totalDuration;

    return results;
  }

  /**
   * Get store data and compare with WRC data (wrapper that calls processStoreList)
   * Manages progress for pre/post phases only (fetching, saving, syncing).
   * Per-store progress is handled by the onStoreProcessed callback from the caller.
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress ID for tracking reconciliation progress
   * @param {Function} onStoreProcessed - Callback invoked after each store is processed
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcileData(cab, period, progressId, onStoreProcessed, force = false) {
    try {
      // Phase: Fetching WRC data
      if (progressId) {
        progressService.updateProgress(progressId, 0, {
          description: "📡 Mengambil data WRC...",
          status: "fetching_data",
        });
      }

      // Get WRC data
      const wrcDataFile = await this.getWrcData(cab, period);

      if (!wrcDataFile) {
        return { success: false, message: "No WRC data found" };
      }

      // Read WRC data from file
      const wrcDataRaw = await fs.readFile(wrcDataFile, "utf8");
      const wrcData = JSON.parse(wrcDataRaw);

      // Ensure storeService is initialized
      await storeService.ensureInitialized();

      // Get stores by branch code with notes='INDUK'
      const branchStores = await storeService.getStoresByBranch(cab, true);
      logger.info(`Found ${branchStores.length} INDUK stores for branch ${cab}`);

      // Set recid to '1' for all processed records to mark them in active history at the beginning of reconciliation
      await RekonWtHarian.update(
        {
          recid: "1",
          updtime: new Date(),
        },
        {
          where: {
            cab: cab,
            periode: period,
          },
        }
      );
      logger.info(`Updated recid to '1' and updtime for all existing records in ${cab} for period ${period}`);

      // Delegate wave-based processing to reusable processStoreList
      const results = await this.processStoreList(branchStores, cab, period, wrcData, onStoreProcessed, {
        progressId, // Only for abort checking
        force,
      });

      // Clean up temporary WRC file
      try {
        await fs.unlink(wrcDataFile);
      } catch (error) {
        logger.warn(`Error deleting temporary file ${wrcDataFile}: ${error.message}`);
      }

      // Phase: Saving to database
      if (progressId) {
        progressService.updateProgress(progressId, results.processedStores, {
          description: "📊 Proses simpan database...",
          status: "finalizing",
        });
      }

      // Save differences to database
      try {
        logger.info(`Saving differences to database for branch ${cab} and period ${period}`);
        const saveResult = await this.saveDifferencesToDatabase(cab, period, null, results.differencesMap);
        logger.info(`Save result: ${JSON.stringify(saveResult)}`);

        // Add save result to results
        results.saveResult = saveResult;
      } catch (error) {
        logger.error(`Error saving differences to database: ${error.message}`);
        results.saveError = error.message;
      }

      // Phase: Syncing logs
      if (progressId) {
        progressService.updateProgress(progressId, results.processedStores, {
          description: "💾 Menyimpan log rekap_remote...",
          status: "finalizing",
        });
      }

      // Save rekap_remote logs to database at the end of reconciliation process
      try {
        const saveLogResult = await RekapRemoteService.saveLogsToDatabase();
        logger.info(`Rekap_remote logs saved: ${JSON.stringify(saveLogResult)}`);
        results.rekapRemoteLogResult = saveLogResult;
      } catch (error) {
        logger.error(`Error saving rekap_remote logs: ${error.message}`);
        results.rekapRemoteLogError = error.message;
      }

      // Final progress update is handled by the caller (reconcileDataWithProgress / reconcileAllBranches)

      return results;
    } catch (error) {
      logger.error(`Error reconciling data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a wave of stores with controlled concurrency
   * @param {Array} stores - Array of store objects to process
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data for the branch
   * @param {number} concurrencyLimit - Maximum concurrent stores
   * @param {number} waveNumber - Current wave number for logging
   * @returns {Promise<Array>} Promise.allSettled results
   */
  async processStoreWave(stores, cab, period, wrcData, concurrencyLimit, waveNumber, force = false, progressId = null, onStoreProcessed = null) {
    // Use a semaphore-like approach to control concurrency
    const processConcurrentStores = async (stores, limit) => {
      const results = [];
      const executing = [];

      for (const store of stores) {
        if (progressId) {
          progressService.addProcessingStore(progressId, store.storeCode);
        }
        const promise = this.processStoreWithTimeout(store, cab, period, wrcData, waveNumber, force, progressId).then(result => {
          executing.splice(executing.indexOf(promise), 1);
          // Report progress REAL-TIME: only for stores WITHOUT errors (success, skip)
          // Timeout & error stores wait for post-wave loop (retry vs permanent failure)
          if (onStoreProcessed && result && (!result.errors || result.errors.length === 0)) {
            onStoreProcessed(result, cab);
          }
          return result;
        }).finally(() => {
          if (progressId) {
            progressService.removeProcessingStore(progressId, store.storeCode);
          }
        });

        results.push(promise);
        executing.push(promise);

        // If we've reached the concurrency limit, wait for one to complete
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }

      // Wait for all remaining promises to complete
      return await Promise.allSettled(results);
    };

    return await processConcurrentStores(stores, concurrencyLimit);
  }

  /**
   * Process a single store with timeout (for parallel processing)
   * @param {Object} store - Store object
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data for the branch
   * @param {number} waveNumber - Current wave number (optional, for logging)
   * @returns {Promise<Object>} Store processing result
   */
  async processStoreWithTimeout(store, cab, period, wrcData, waveNumber = 1, force = false, progressId = null) {
    const storeCode = store.storeCode;
    const STORE_TIMEOUT = config.parallelProcessing?.storeTimeoutMs || 10000;

    // Check if task was aborted
    if (progressId && progressService.isAborted(progressId)) {
      logger.info(`[Wave ${waveNumber}] [${storeCode}] Aborted — task dibatalkan`);
      return {
        storeCode,
        storeName: store.storeName || storeCode,
        differences: [],
        errors: [],
        skipped: true,
        skipReason: "Task dibatalkan",
      };
    }

    // Daily screening guard: skip store if already successfully screened today
    if (!force) {
      try {
        const guard = await screeningGuard.isSuccessToday("rekon_wt_harian", storeCode);
        if (guard.screened) {
          logger.info(`[Wave ${waveNumber}] [${storeCode}] Skip — sudah screen hari ini (${guard.updtime})`);
          return {
            storeCode,
            storeName: store.storeName || storeCode,
            differences: [],
            errors: [],
            skipped: true,
            skipReason: `Sudah screen ${guard.updtime}`,
          };
        }
      } catch (err) {
        logger.warn(`[Wave ${waveNumber}] [${storeCode}] Guard check error, proceeding: ${err.message}`);
      }
    }

    logger.info(`[Wave ${waveNumber}] [${storeCode}] Starting processing...`);

    // Progress is tracked via onStoreProcessed callback in the calling method

    // Create a timeout promise that returns error info instead of rejecting
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        const errorMsg = `Processing timeout after ${STORE_TIMEOUT}ms`;
        logger.error(`[Wave ${waveNumber}] [${storeCode}] ${errorMsg}`);
        resolve({
          storeCode,
          storeName: store.storeName,
          differences: [],
          errors: [errorMsg],
        });
      }, STORE_TIMEOUT);
    });

    // Create the actual processing promise
    const processingPromise = this.processStore(store, cab, period, wrcData);

    try {
      // Race between timeout and actual processing
      const result = await Promise.race([processingPromise, timeoutPromise]);

      // Check if result has errors (from timeout or processing)
      if (result.errors && result.errors.length > 0) {
        logger.info(`[Wave ${waveNumber}] [${storeCode}] Completed with errors: ${result.errors.join(", ")}`);
      } else {
        logger.info(`[Wave ${waveNumber}] [${storeCode}] Completed successfully`);
      }

      return result;
    } catch (error) {
      // This should rarely happen now, but keep as fallback
      const errorMsg = `Unexpected processing failure: ${error.message}`;
      logger.error(`[Wave ${waveNumber}] [${storeCode}] ${errorMsg}`);
      return {
        storeCode,
        storeName: store.storeName,
        differences: [],
        errors: [errorMsg],
      };
    }
  }

  /**
   * Process a single store (extracted from reconcileData for parallel processing)
   * @param {Object} store - Store object
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data for the branch
   * @returns {Promise<Object>} Store processing result
   */
  async processStore(store, cab, period, wrcData, sharedConnection = null) {
    const storeCode = store.storeCode;
    const storeInfo = {
      dbHost: store.dbHost,
      storeName: store.storeName,
    };
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const storeJsonDir = path.join(__dirname, "../../../data/rekon_wt_harian");
    const storeJsonFile = path.join(storeJsonDir, `${storeCode}_${period}.json`);

    let storeData = [];
    let connectionError = null;
    try {
      if (!storeInfo.dbHost) {
        connectionError = `No dbHost found in branch ${cab}`;
        logger.warn(`[${storeCode}] ${connectionError}`);
        await RekapRemoteService.addToTemp(cab, storeCode, "rekon_wt_harian", `${connectionError}`);
      } else {
        // Try connect to store database (use shared connection if provided)
        const storeConnection = sharedConnection || await dbStore.createDbStore(storeInfo.dbHost, 2);
        if (storeConnection) {
          try {
            // Get store data with timeout
            const storeQuery = this.getStoreQuery(period);
            logger.debug(`[${storeCode}] Executing query...`);
            const queryTimeout = config.parallelProcessing?.queryTimeoutMs || 15000;
            const queryPromise = storeConnection.query(storeQuery).catch(err => {
              // Suppress unhandled rejection when pool is closed before query completes
              // (e.g. timeoutPromise wins the race, pool.end() runs in finally,
              //  leaving the original query hanging with nowhere to go)
              logger.warn(`[${storeCode}] Query promise rejected after timeout/close: ${err.message}`);
            });

            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Query timeout")), queryTimeout);
            });

            [storeData] = await Promise.race([queryPromise, timeoutPromise]);

            const msg = `[${storeCode}] Query completed, got ${storeData.length} records`;
            logger.debug(`${msg}`);
            await RekapRemoteService.addToTemp(cab, storeCode, "rekon_wt_harian", `${msg}`);
            // Save store data to JSON file (delete old file first)
            try {
              await fs.mkdir(storeJsonDir, { recursive: true });
              try {
                await fs.unlink(storeJsonFile);
                logger.info(`[${storeCode}] Old store JSON file deleted: ${storeJsonFile}`);
              } catch (err) {
                if (err.code !== "ENOENT") {
                  logger.warn(`[${storeCode}] Error deleting old JSON file: ${err.message}`);
                }
              }
              await fs.writeFile(storeJsonFile, JSON.stringify(storeData));
              logger.info(`[${storeCode}] Store data saved to JSON: ${storeJsonFile}`);
            } catch (err) {
              logger.error(`[${storeCode}] Error saving store data to JSON: ${err.message}`);
            }
          } finally {
            // Properly close connection pool (only if we opened it)
            if (!sharedConnection && storeConnection) {
              try {
                if (storeConnection.end) {
                  await storeConnection.end();
                } else if (storeConnection.destroy) {
                  storeConnection.destroy();
                }
              } catch (closeError) {
                logger.warn(`[${storeCode}] Error closing connection: ${closeError.message}`);
              }
            }
          }
        } else {
          connectionError = `Could not connect to ${storeInfo.dbHost}`;
          logger.warn(`[${storeCode}] ${connectionError}`);
          await RekapRemoteService.addToTemp(cab, storeCode, "rekon_wt_harian", `${connectionError}`);
        }
      }
    } catch (error) {
      connectionError = `Processing error: ${error.message}`;
      logger.error(`[${storeCode}] ${connectionError}`);
      await RekapRemoteService.addToTemp(cab, storeCode, "rekon_wt_harian", `${connectionError}`);
    }

    // Jika koneksi gagal, coba baca file JSON lokal (sebagai cadangan)
    if (storeData.length === 0 && connectionError) {
      try {
        const fileContent = await fs.readFile(storeJsonFile, "utf8");
        storeData = JSON.parse(fileContent);
        logger.info(`[${storeCode}] Loaded store data from local file: ${storeJsonFile}`);
      } catch (err) {
        logger.warn(`[${storeCode}] No local store JSON file found: ${storeJsonFile}`);
        storeData = [];
      }
    }

    // Jika koneksi gagal, JANGAN lanjutkan comparation
    // Agar data lama di database tidak ter-overwrite oleh selisih palsu
    // (wrc ada data, toko offline → pasti dianggap selisih, padahal belum tentu)
    if (connectionError) {
      logger.info(`[${storeCode}] Connection error — skipping comparison, preserving existing DB state`);
      return {
        storeCode,
        storeName: storeInfo.storeName,
        differences: [],
        errors: [connectionError],
      };
    }

    // Filter WRC data for this store
    const storeWrcData = wrcData.filter(item => item.shop === storeCode);

    // Compare data
    if (storeWrcData.length === 0) {
      logger.debug(`[${storeCode}] No WRC data found`);
      return {
        storeCode,
        storeName: storeInfo.storeName,
        differences: [],
        errors: [],
      };
    }

    logger.debug(`[${storeCode}] Comparing ${storeWrcData.length} WRC records with ${storeData.length} store records`);
    const differences = await this.compareData(cab, period, storeWrcData, storeData, storeCode);
    logger.debug(`[${storeCode}] Found ${differences.length} differences`);
    return {
      storeCode,
      storeName: storeInfo.storeName,
      differences,
      errors: [],
    };
  }

  /**
   * Save differences from temporary files to database
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} toko - Store code (optional, filters to specific shop)
   * @returns {Promise<Object>} Result of database save operation
   */
  async saveDifferencesToDatabase(cab, period, toko = null, differencesMap = null) {
    // Step 6: If differencesMap provided, process in-memory (no temp file I/O)
    const isMemoryMode = differencesMap instanceof Map && differencesMap.size > 0;
    const label = toko ? `shop ${toko} in ${cab}` : `${cab}`;

    if (isMemoryMode) {
      logger.info(`Saving differences for ${label} ${period} from in-memory Map (${differencesMap.size} stores)`);
      return await this._saveFromMemoryMap(cab, period, differencesMap, label);
    }

    // Fallback: scan temp files (backward compat for callers that still use files)
    try {
      logger.info(`Saving differences for ${label} ${period} from temporary files to database`);

      const tempDir = os.tmpdir();
      const files = await fs.readdir(tempDir);
      const prefix = toko
        ? `differences_wtharian_${cab}_${period}_${toko}`
        : `differences_wtharian_${cab}_${period}_`;
      const differenceFiles = files.filter(file => {
        return file.startsWith(prefix) && file.endsWith(".json");
      });

      if (differenceFiles.length === 0) {
        logger.info(`No difference files found for ${label} ${period}`);
        return { success: true, message: "No differences to save", savedCount: 0 };
      }

      logger.info(`Found ${differenceFiles.length} difference files for ${label} ${period}`);

      let totalDifferences = 0;
      let totalSaved = 0;
      let totalErrors = 0;

      // Step 4+5: Raw INSERT ... ON DUPLICATE KEY UPDATE dalam 1 transaction
      const model = await RekonWtHarian.getModel();
      const sequelize = model.sequelize;
      let transaction = null;
      const savedFilePaths = []; // Temp files to clean up after commit

      try {
        transaction = await sequelize.transaction();
        for (const file of differenceFiles) {
          const filePath = path.join(tempDir, file);
          const fileContent = await fs.readFile(filePath, "utf8");
          const differences = JSON.parse(fileContent);

          if (differences.length === 0) {
            continue;
          }

          totalDifferences += differences.length;
          logger.info(`Processing ${differences.length} differences from ${file}`);

          const BATCH_SIZE = 1000;
          for (let i = 0; i < differences.length; i += BATCH_SIZE) {
            const batch = differences.slice(i, i + BATCH_SIZE);

            // Build raw INSERT ... ON DUPLICATE KEY UPDATE
            const columns = [
              "cab", "periode", "tipe", "toko", "shop", "tgl1",
              "gross_wrc", "ppn_wrc", "gross_idm_wrc", "ppn_idm_wrc",
              "gross_store", "ppn_store", "gross_idm_store", "ppn_idm_store",
              "selisih_gross", "selisih_ppn", "selisih_gross_idm", "selisih_ppn_idm",
              "recid", "addtime", "updtime",
            ];
            const updateColumns = columns.filter(
              c => !["cab", "periode", "tipe", "toko", "shop", "tgl1", "addtime"].includes(c)
            );

            const placeholders = batch
              .map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`)
              .join(", ");

            const values = batch.flatMap(d => [
              d.cab, d.periode, d.tipe, d.toko, d.shop, d.tgl1,
              d.gross_wrc || 0, d.ppn_wrc || 0, d.gross_idm_wrc || 0, d.ppn_idm_wrc || 0,
              d.gross_store || 0, d.ppn_store || 0, d.gross_idm_store || 0, d.ppn_idm_store || 0,
              d.selisih_gross || 0, d.selisih_ppn || 0, d.selisih_gross_idm || 0, d.selisih_ppn_idm || 0,
              "*",
            ]);

            const updateSet = updateColumns.map(c => `${c} = VALUES(${c})`).join(", ");

            await sequelize.query(
              `INSERT INTO rekon_wt_harian (${columns.join(", ")})
               VALUES ${placeholders}
               ON DUPLICATE KEY UPDATE ${updateSet}`,
              { replacements: values, transaction }
            );

            totalSaved += batch.length;
          }

          savedFilePaths.push(filePath); // Hapus file setelah commit sukses
          logger.info(`Processed ${differences.length} differences from ${file}`);
        }

        await transaction.commit();
        logger.info(`Transaction committed for ${label}: ${totalSaved} records saved`);

        // Clean up temp files only after successful commit
        for (const fp of savedFilePaths) {
          try {
            await fs.unlink(fp);
            logger.info(`Deleted temporary file ${path.basename(fp)}`);
          } catch (e) {
            logger.warn(`Error deleting temp file ${fp}: ${e.message}`);
          }
        }
      } catch (error) {
        if (transaction) {
          await transaction.rollback();
        }
        totalErrors = totalDifferences - totalSaved;
        logger.error(`Transaction rolled back for ${label}: ${error.message}`);

        return {
          success: false,
          message: `Transaction failed: ${error.message}`,
          error: error.message,
          savedCount: 0,
          errorCount: totalErrors,
          totalCount: totalDifferences,
        };
      }

      // Sync JSON file ONCE after all files are processed (was inside loop = N+1 calls)
      await this.syncToJsonFile();

      logger.info(`Completed saving differences for ${label}: ${totalSaved} saved, ${totalErrors} errors out of ${totalDifferences}`);

      return {
        success: true,
        message: `Saved ${totalSaved} differences for ${label}`,
        savedCount: totalSaved,
        errorCount: totalErrors,
        totalCount: totalDifferences,
      };
    } catch (error) {
      logger.error(`Error saving differences to database: ${error.message}`);
      return {
        success: false,
        message: `Error saving differences to database: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Save differences from in-memory Map directly to DB (Step 6 — no temp file I/O)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Map<string, Array>} differencesMap - storeCode → differences[]
   * @param {string} label - Logging label
   * @returns {Promise<Object>} Result object
   */
  async _saveFromMemoryMap(cab, period, differencesMap, label) {
    const model = await RekonWtHarian.getModel();
    const sequelize = model.sequelize;
    let transaction = null;

    try {
      transaction = await sequelize.transaction();

      let totalSaved = 0;
      let totalDifferences = 0;

      // Count total differences across all stores
      for (const [, differences] of differencesMap) {
        totalDifferences += differences.length;
      }

      // Step 6: Flush per-store (avoid large batchAccumulator that doubles memory)
      const BATCH_SIZE = 1000;
      for (const [, differences] of differencesMap) {
        for (let i = 0; i < differences.length; i += BATCH_SIZE) {
          const batch = differences.slice(i, i + BATCH_SIZE);
          await this._batchInsertRaw(sequelize, batch, transaction);
          totalSaved += batch.length;
        }
      }

      await transaction.commit();
      logger.info(`Transaction committed for ${label}: ${totalSaved} differences saved (in-memory mode)`);

      // Sync JSON file after commit
      await this.syncToJsonFile();

      logger.info(`Completed saving differences for ${label}: ${totalSaved} saved out of ${totalDifferences}`);

      return {
        success: true,
        message: `Saved ${totalSaved} differences for ${label}`,
        savedCount: totalSaved,
        errorCount: 0,
        totalCount: totalDifferences,
      };
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      logger.error(`Transaction rolled back for ${label} (in-memory): ${error.message}`);
      return {
        success: false,
        message: `Transaction failed: ${error.message}`,
        error: error.message,
        savedCount: 0,
        errorCount: 0,
        totalCount: 0,
      };
    }
  }

  /**
   * Execute a single batch INSERT ... ON DUPLICATE KEY UPDATE
   * @param {Object} sequelize - Sequelize instance
   * @param {Array} batch - Array of difference records
   * @param {Object} transaction - Sequelize transaction
   */
  async _batchInsertRaw(sequelize, batch, transaction) {
    const columns = [
      "cab", "periode", "tipe", "toko", "shop", "tgl1",
      "gross_wrc", "ppn_wrc", "gross_idm_wrc", "ppn_idm_wrc",
      "gross_store", "ppn_store", "gross_idm_store", "ppn_idm_store",
      "selisih_gross", "selisih_ppn", "selisih_gross_idm", "selisih_ppn_idm",
      "recid", "addtime", "updtime",
    ];
    const updateColumns = columns.filter(
      c => !["cab", "periode", "tipe", "toko", "shop", "tgl1", "addtime"].includes(c)
    );

    const placeholders = batch
      .map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`)
      .join(", ");

    const values = batch.flatMap(d => [
      d.cab, d.periode, d.tipe, d.toko, d.shop, d.tgl1,
      d.gross_wrc || 0, d.ppn_wrc || 0, d.gross_idm_wrc || 0, d.ppn_idm_wrc || 0,
      d.gross_store || 0, d.ppn_store || 0, d.gross_idm_store || 0, d.ppn_idm_store || 0,
      d.selisih_gross || 0, d.selisih_ppn || 0, d.selisih_gross_idm || 0, d.selisih_ppn_idm || 0,
      "*",
    ]);

    const updateSet = updateColumns.map(c => `${c} = VALUES(${c})`).join(", ");

    await sequelize.query(
      `INSERT INTO rekon_wt_harian (${columns.join(", ")})
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE ${updateSet}`,
      { replacements: values, transaction }
    );
  }

  /**
   * Get reconciliation results
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} toko - Store code
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Reconciliation results
   */
  async getResults(cab, period, toko, options = {}) {
    try {
      const {
        page = 1,
        limit = config.pagination.defaultLimit,
        tipe,
        tgl1,
        searchQuery,
        sortColumn,
        sortOrder,
        toleranceAmount = 0,
      } = options;

      // Ensure limit doesn't exceed maximum
      const validLimit = Math.min(limit, config.pagination.maxLimit);
      const offset = (page - 1) * validLimit;

      // Ensure data is loaded with TTL-based lazy loading
      await this.ensureDataLoaded();

      // Filter data from JSON file
      let filteredData = this.rekonData.filter(item => {
        // Wajib: hanya tampilkan data dengan recid '*' (masih ada selisih)
        if (item.recid !== "*") return false;

        // Wajib: periode harus cocok
        if (String(item.periode) !== String(period)) return false;

        // Cab fleksibel: jika "All"/null/undefined/"" -> jangan filter cab
        const isAllCab = !cab || String(cab).trim().toLowerCase() === "all";
        if (!isAllCab) {
          const itemCab = (item.cab ?? "").toString().trim().toUpperCase();
          const cabNorm = String(cab).trim().toUpperCase();
          if (itemCab !== cabNorm) return false;
        }

        // Wajib: toko harus cocok (exact match)
        if (!toko) return false; // toko wajib ada
        const itemToko = (item.shop ?? "").toString().trim().toUpperCase();
        const tokoNorm = String(toko).trim().toUpperCase();
        if (itemToko !== tokoNorm) return false;

        // Filter tambahan (opsional)
        if (tipe && item.tipe !== tipe) return false;

        if (tgl1) {
          // Samakan ke tanggal (YYYY-MM-DD)
          const itemDate = new Date(item.tgl1).toISOString().split("T")[0];
          const filterDate = new Date(tgl1).toISOString().split("T")[0];
          if (itemDate !== filterDate) return false;
        }

        // Pencarian global (opsional)
        const q = (searchQuery ?? "").toString().trim().toLowerCase();
        if (q) {
          const haystack = [
            item.shop,
            item.toko,
            item.tipe,
            item.tgl1,
            item.cab,
            item.gross_wrc,
            item.gross_store,
            item.gross_idm_wrc,
            item.gross_idm_store,
            item.ppn_wrc,
            item.ppn_store,
            item.ppn_idm_wrc,
            item.ppn_idm_store,
          ]
            .map(v => (v === null || v === undefined ? "" : String(v).toLowerCase()))
            .join(" ");

          if (!haystack.includes(q)) return false;
        }

        // Filter berdasarkan toleransi selisih
        if (toleranceAmount > 0) {
          const selisihGross = Math.abs(parseFloat(item.gross_wrc || 0) - parseFloat(item.gross_store || 0));
          const selisihPpn = Math.abs(parseFloat(item.ppn_wrc || 0) - parseFloat(item.ppn_store || 0));
          const selisihGrossIdm = Math.abs(parseFloat(item.gross_idm_wrc || 0) - parseFloat(item.gross_idm_store || 0));
          const selisihPpnIdm = Math.abs(parseFloat(item.ppn_idm_wrc || 0) - parseFloat(item.ppn_idm_store || 0));

          // Jika semua selisih di bawah toleransi, jangan tampilkan data
          if (
            selisihGross <= toleranceAmount &&
            selisihPpn <= toleranceAmount &&
            selisihGrossIdm <= toleranceAmount &&
            selisihPpnIdm <= toleranceAmount
          ) {
            return false;
          }
        }

        return true;
      });

      // Sort data
      filteredData.sort((a, b) => {
        // Primary sort by provided column and order
        if (sortColumn && sortOrder) {
          const order = sortOrder.toUpperCase() === "DESC" ? -1 : 1;

          if (a[sortColumn] < b[sortColumn]) return -1 * order;
          if (a[sortColumn] > b[sortColumn]) return 1 * order;
        }

        // Secondary sort by default columns
        if (a.tgl1 < b.tgl1) return -1;
        if (a.tgl1 > b.tgl1) return 1;

        if (a.shop < b.shop) return -1;
        if (a.shop > b.shop) return 1;

        if (a.tipe < b.tipe) return -1;
        if (a.tipe > b.tipe) return 1;

        return 0;
      });

      // Apply pagination
      const total = filteredData.length;
      const paginatedData = filteredData.slice(offset, offset + validLimit);

      return {
        total,
        page,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit),
        data: paginatedData,
      };
    } catch (error) {
      logger.error(`Error getting results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete reconciliation results for all branches
   * @param {string} period - Period in YYMM format
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteAllCabangResults(period) {
    try {
      const deletedCount = await RekonWtHarian.destroy({
        where: { periode: period },
      });

      logger.info(`Deleted ${deletedCount} records for all branches in period ${period}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error in deleteAllCabangResults: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete reconciliation results
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteResults(cab, period) {
    try {
      const deletedCount = await RekonWtHarian.destroy({
        where: {
          cab,
          periode: period,
        },
      });

      // Sync to JSON file after delete
      await this.syncToJsonFile();

      return deletedCount;
    } catch (error) {
      logger.error(`Error deleting results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: count how many distinct shops have differences exceeding tolerance
   * @param {Array} filteredData - Data filtered by period + recid, still at transaction level


  /**
   * Get summary of reconciliation results for all branches
   * Sama dengan logika getDailyShopSummary: group by shop, aggregated sum, filter tolerance.
   * @param {string} period - Period in YYMM format
   * @param {number} [toleranceAmount] - Tolerance in IDR (default from config)
   * @returns {Promise<Object>} Summary of reconciliation results for all branches
   */
  async getAllCabangSummary(period, toleranceAmount) {
    try {
      await this.ensureDataLoaded();

      const tol = toleranceAmount ?? config.toleranceAmount ?? 50;

      // Filter: recid '*' + periode (all branches)
      const filteredData = this.rekonData.filter(item => item.periode === period && item.recid === "*");

      // Group by shop (aggregated sum) — persis seperti getDailyShopSummary
      const summaryMap = new Map();
      for (const item of filteredData) {
        const key = `${item.cab}-${item.shop}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            shop: item.shop,
            cab: item.cab,
            sum_sel_gross: 0,
            sum_sel_ppn: 0,
            sum_sel_gross_idm: 0,
            sum_sel_ppn_idm: 0,
          });
        }
        const agg = summaryMap.get(key);
        agg.sum_sel_gross += parseFloat(item.selisih_gross || 0);
        agg.sum_sel_ppn += parseFloat(item.selisih_ppn || 0);
        agg.sum_sel_gross_idm += parseFloat(item.selisih_gross_idm || 0);
        agg.sum_sel_ppn_idm += parseFloat(item.selisih_ppn_idm || 0);
      }

      const aggregatedShops = Array.from(summaryMap.values());

      // Hitung total_stores dari data INDUK storeService (m_toko),
      // bukan dari aggregatedShops (yang hanya berisi toko dengan selisih).
      await storeService.ensureInitialized();
      const total_stores = storeService.stores.filter(s => s.notes === "INDUK").length;

      // Terapkan tolerance filter dengan logika SAMA persis seperti getDailyShopSummary
      let diffList;
      if (tol && tol > 0) {
        diffList = aggregatedShops.filter(item => {
          const absGross = Math.abs(item.sum_sel_gross);
          const absPpn = Math.abs(item.sum_sel_ppn);
          const absGrossIdm = Math.abs(item.sum_sel_gross_idm);
          const absPpnIdm = Math.abs(item.sum_sel_ppn_idm);
          return absGross > tol || absPpn > tol || absGrossIdm > tol || absPpnIdm > tol;
        });
      } else {
        diffList = [...aggregatedShops];
      }
      const storesWithDiff = diffList.length;

      // Kurangi toko yang sudah di-note (sudah di-follow up)
      // Note unixKey = `${shop}${periode}`, tableName = "rekon_wt_harian"
      let storesToFollowUp = storesWithDiff;
      try {
        const allNotes = await notesService.getAll();
        const periodNotes = new Set();
        for (const note of allNotes) {
          if (note.tableName === "rekon_wt_harian" && note.unixKey && note.unixKey.endsWith(period)) {
            periodNotes.add(note.unixKey.slice(0, -period.length));
          }
        }
        const notedInDiff = diffList.filter(item => periodNotes.has(item.shop)).length;
        storesToFollowUp = Math.max(0, storesWithDiff - notedInDiff);
      } catch (noteError) {
        logger.warn(`Error fetching notes for summary: ${noteError.message}`);
      }

      // Gunakan helper yang sudah ada untuk statistik utama
      const mainSummary = this._calculateSummaryStats(filteredData);
      const typeStats = this._calculateGroupStats(filteredData, "tipe");
      const branchStats = this._calculateGroupStats(filteredData, "cab");

      const summary = {
        ...mainSummary,
        typeStats,
        branchStats,
        total_stores,
        stores_with_diff: storesWithDiff,
        stores_to_follow_up: storesToFollowUp,
        stores_matched: Math.max(0, total_stores - storesWithDiff),
        toleranceAmount: tol,
        jml_toko: storesToFollowUp,
      };

      return summary;
    } catch (error) {
      logger.error(`Error in getAllCabangSummary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary of reconciliation results
   * Sama dengan logika getDailyShopSummary: group by shop, aggregated sum, filter tolerance.
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {number} [toleranceAmount] - Tolerance in IDR (default from config)
   * @returns {Promise<Object>} Summary of reconciliation results
   */
  async getSummary(cab, period, toleranceAmount) {
    try {
      await this.ensureDataLoaded();

      const tol = toleranceAmount ?? config.toleranceAmount ?? 50;

      // Filter: recid '*' + periode + cabang
      const filteredData = this.rekonData.filter(
        item => item.cab === cab && item.periode === period && item.recid === "*"
      );

      // Group by shop (aggregated sum) — persis seperti getDailyShopSummary
      const summaryMap = new Map();
      for (const item of filteredData) {
        const key = item.shop;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            shop: item.shop,
            sum_sel_gross: 0,
            sum_sel_ppn: 0,
            sum_sel_gross_idm: 0,
            sum_sel_ppn_idm: 0,
          });
        }
        const agg = summaryMap.get(key);
        agg.sum_sel_gross += parseFloat(item.selisih_gross || 0);
        agg.sum_sel_ppn += parseFloat(item.selisih_ppn || 0);
        agg.sum_sel_gross_idm += parseFloat(item.selisih_gross_idm || 0);
        agg.sum_sel_ppn_idm += parseFloat(item.selisih_ppn_idm || 0);
      }

      const aggregatedShops = Array.from(summaryMap.values());

      // Hitung total_stores dari data INDUK storeService (m_toko) untuk cabang ini,
      // bukan dari aggregatedShops (yang hanya berisi toko dengan selisih).
      await storeService.ensureInitialized();
      const branchStores = await storeService.getStoresByBranch(cab, true);
      const total_stores = branchStores.length;

      // Terapkan tolerance filter dengan logika SAMA persis seperti getDailyShopSummary
      let diffList;
      if (tol && tol > 0) {
        diffList = aggregatedShops.filter(item => {
          const absGross = Math.abs(item.sum_sel_gross);
          const absPpn = Math.abs(item.sum_sel_ppn);
          const absGrossIdm = Math.abs(item.sum_sel_gross_idm);
          const absPpnIdm = Math.abs(item.sum_sel_ppn_idm);
          return absGross > tol || absPpn > tol || absGrossIdm > tol || absPpnIdm > tol;
        });
      } else {
        diffList = [...aggregatedShops];
      }
      const storesWithDiff = diffList.length;

      // Kurangi toko yang sudah di-note (sudah di-follow up)
      // Note unixKey = `${shop}${periode}`, tableName = "rekon_wt_harian"
      let storesToFollowUp = storesWithDiff;
      try {
        const allNotes = await notesService.getAll();
        const periodNotes = new Set();
        for (const note of allNotes) {
          if (note.tableName === "rekon_wt_harian" && note.unixKey && note.unixKey.endsWith(period)) {
            periodNotes.add(note.unixKey.slice(0, -period.length));
          }
        }
        const notedInDiff = diffList.filter(item => periodNotes.has(item.shop)).length;
        storesToFollowUp = Math.max(0, storesWithDiff - notedInDiff);
      } catch (noteError) {
        logger.warn(`Error fetching notes for summary: ${noteError.message}`);
      }

      // Gunakan helper yang sudah ada untuk statistik utama
      const mainSummary = this._calculateSummaryStats(filteredData);

      const summary = {
        ...mainSummary,
        total_stores,
        stores_with_diff: storesWithDiff,
        stores_to_follow_up: storesToFollowUp,
        stores_matched: Math.max(0, total_stores - storesWithDiff),
        toleranceAmount: tol,
        jml_toko: storesToFollowUp,
      };

      return summary;
    } catch (error) {
      logger.error(`Error getting summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare WRC and store data
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data (already filtered for specific store)
   * @param {Array} storeData - Store data
   * @returns {Promise<Array>} Array of differences
   */
  async compareData(cab, period, wrcData, storeData, storeCode) {
    try {
      const differences = [];

      // Buat struktur data untuk mempercepat lookup
      const wrcMap = new Map();
      const storeMap = new Map();

      // Normalisasi data WRC dan simpan ke Map
      const taskWrc = wrcData.map(async item => {
        const normalizedItem = {
          ...item,
          GROSS: parseFloat(item.GROSS) || 0,
          PPN: parseFloat(item.PPN) || 0,
          GROSS_IDM: parseFloat(item.GROSS_IDM) || 0,
          PPN_IDM: parseFloat(item.PPN_IDM) || 0,
        };

        const key = `${item.TIPE}|${item.TOKO}|${item.shop}|${item.TGL1}`;
        wrcMap.set(key, normalizedItem);
      });

      await Promise.all(taskWrc);

      // Normalisasi data store dan simpan ke Map
      const taskStore = storeData.map(async item => {
        const normalizedItem = {
          ...item,
          GROSS: parseFloat(item.GROSS) || 0,
          PPN: parseFloat(item.PPN) || 0,
          GROSS_IDM: parseFloat(item.GROSS_IDM) || 0,
          PPN_IDM: parseFloat(item.PPN_IDM) || 0,
        };

        const key = `${item.TIPE}|${item.TOKO}|${item.shop}|${item.TGL1}`;
        storeMap.set(key, normalizedItem);
      });

      await Promise.all(taskStore);

      // Log jumlah data yang akan dibandingkan
      logger.info(
        `Comparing ${wrcData.length} WRC records with ${storeData.length} store records of ${storeCode} for cab ${cab} and period ${period}`
      );

      // Kumpulkan semua key unik dari kedua sumber data
      const allKeys = new Set([...wrcMap.keys(), ...storeMap.keys()]);

      // Proses semua data sekaligus
      for (const key of allKeys) {
        const wrcItem = wrcMap.get(key) || {
          GROSS: 0,
          PPN: 0,
          GROSS_IDM: 0,
          PPN_IDM: 0,
          TIPE: key.split("|")[0],
          TOKO: key.split("|")[1],
          shop: key.split("|")[2],
          TGL1: key.split("|")[3],
        };

        const storeItem = storeMap.get(key) || {
          GROSS: 0,
          PPN: 0,
          GROSS_IDM: 0,
          PPN_IDM: 0,
          TIPE: key.split("|")[0],
          TOKO: key.split("|")[1],
          shop: key.split("|")[2],
          TGL1: key.split("|")[3],
        };

        // Use helper function to calculate differences
        const { grossDiff, ppnDiff, grossIdmDiff, ppnIdmDiff, hasSignificantDifference } = this._calculateDifferences(
          wrcItem,
          storeItem
        );

        // Simpan jika ada selisih signifikan
        if (hasSignificantDifference) {
          logger.info(`Difference found for ${wrcItem.TOKO} on ${wrcItem.TGL1} with type ${wrcItem.TIPE}`);

          const difference = {
            cab,
            periode: period,
            tipe: wrcItem.TIPE,
            toko: wrcItem.TOKO,
            shop: wrcItem.shop,
            tgl1: wrcItem.TGL1,
            gross_store: storeItem.GROSS,
            ppn_store: storeItem.PPN,
            gross_idm_store: storeItem.GROSS_IDM,
            ppn_idm_store: storeItem.PPN_IDM,
            gross_wrc: wrcItem.GROSS,
            ppn_wrc: wrcItem.PPN,
            gross_idm_wrc: wrcItem.GROSS_IDM,
            ppn_idm_wrc: wrcItem.PPN_IDM,
            selisih_gross: grossDiff,
            selisih_ppn: ppnDiff,
            selisih_gross_idm: grossIdmDiff,
            selisih_ppn_idm: ppnIdmDiff,
          };

          differences.push(difference);
        }
      }

      // Step 6: No more temp file I/O — differences kept in memory
      // (accumulated at processStoreList level, passed directly to saveDifferencesToDatabase)

      if (differences.length > 0) {
        logger.info(`[${storeCode}] Found ${differences.length} differences (in-memory)`);
      } else {
        logger.info(`No significant differences found from ${storeCode}`);
      }

      return differences;
    } catch (error) {
      logger.error(`Error comparing data ${storeCode} : ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up old temporary difference files
   * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupTempFiles() {
    try {
      const tempDir = os.tmpdir();
      const files = await fs.readdir(tempDir);

      // Filter for difference files
      const differenceFiles = files.filter(file => {
        return file.startsWith("differences_wtharian_") && file.endsWith(".json");
      });

      if (differenceFiles.length === 0) {
        return;
      }

      logger.info(`Found ${differenceFiles.length} difference files to cleanup`);
      let deletedCount = 0;

      for (const file of differenceFiles) {
        try {
          const filePath = path.join(tempDir, file);

          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old temporary file: ${file}`);
        } catch (error) {
          logger.error(`Error cleaning up file ${file}: ${error.message}`);
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old temporary difference files`);
      }

      return {
        success: true,
        message: `Cleaned up ${deletedCount} old temporary difference files`,
        deletedCount,
        totalChecked: differenceFiles.length,
      };
    } catch (error) {
      logger.error(`Error in cleanupTempFiles: ${error.message}`);
      return {
        success: false,
        message: `Error cleaning up temporary files: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Get daily shop summary - rekap data per toko per tanggal
   * @param {string} cab - Branch code (optional, "All" untuk semua cabang)
   * @param {string} period - Period in YYMM format
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Daily shop summary results
   */
  async getDailyShopSummary(cab, period, options = {}) {
    try {
      const {
        page = 1,
        limit = config.pagination.defaultLimit,
        toko,
        tgl1,
        searchQuery,
        sortColumn = "tgl1",
        sortOrder = "asc",
        toleranceAmount,
      } = options;

      // Ensure limit doesn't exceed maximum
      const validLimit = Math.min(limit, config.pagination.maxLimit);
      const offset = (page - 1) * validLimit;

      // Ensure data is loaded
      await this.ensureDataLoaded();

      // Filter data from JSON file
      let filteredData = this.rekonData.filter(item => {
        // Wajib: hanya tampilkan data dengan recid '*' (masih ada selisih)
        if (item.recid !== "*") return false;

        // Wajib: periode harus cocok
        if (String(item.periode) !== String(period)) return false;

        // Cab fleksibel: jika "All"/null/undefined/"" -> jangan filter cab
        const isAllCab = !cab || String(cab).trim().toLowerCase() === "all";
        if (!isAllCab) {
          const itemCab = (item.cab ?? "").toString().trim().toUpperCase();
          const cabNorm = String(cab).trim().toUpperCase();
          if (itemCab !== cabNorm) return false;
        }

        // Filter tambahan (opsional)
        if (
          toko &&
          !String(item.toko ?? "")
            .toLowerCase()
            .includes(String(toko).toLowerCase())
        ) {
          return false;
        }
        /*
        if (tgl1) {
          // Samakan ke tanggal (YYYY-MM-DD)
          const itemDate = new Date(item.tgl1).toISOString().split("T")[0];
          const filterDate = new Date(tgl1).toISOString().split("T")[0];
          if (itemDate !== filterDate) return false;
        }
          */

        return true;
      });

      // Build store name lookup for enrichment
      await storeService.ensureInitialized();
      const storeNameMap = new Map();
      for (const s of storeService.stores) {
        if (s.storeCode) {
          storeNameMap.set(s.storeCode, s.storeName || s.storeCode);
        }
      }

      // Group data by cab, tanggal, shop untuk membuat summary
      const summaryMap = new Map();

      filteredData.forEach(item => {
        // Create unique key: cab-shop
        const key = `${item.cab}-${item.shop}`;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            cab: item.cab,
            shop: item.shop,
            store_name: storeNameMap.get(item.shop) || item.shop,
            sum_sel_gross: 0,
            sum_sel_ppn: 0,
            sum_sel_gross_idm: 0,
            sum_sel_ppn_idm: 0,
            updtime: item.updtime,
            record_count: 0,
          });
        }

        const summary = summaryMap.get(key);

        // Sum selisih values
        summary.sum_sel_gross += parseFloat(item.selisih_gross || 0);
        summary.sum_sel_ppn += parseFloat(item.selisih_ppn || 0);
        summary.sum_sel_gross_idm += parseFloat(item.selisih_gross_idm || 0);
        summary.sum_sel_ppn_idm += parseFloat(item.selisih_ppn_idm || 0);
        summary.record_count += 1;

        // Update updtime to latest
        if (item.updtime && item.updtime > summary.updtime) {
          summary.updtime = item.updtime;
        }
      });

      // Convert Map to Array
      let summaryData = Array.from(summaryMap.values());

      // Apply tolerance filter: remove shops where all aggregated differences <= toleranceAmount
      if (toleranceAmount && toleranceAmount > 0) {
        const tol = toleranceAmount;
        summaryData = summaryData.filter(item => {
          const absGross = Math.abs(parseFloat(item.sum_sel_gross || 0));
          const absPpn = Math.abs(parseFloat(item.sum_sel_ppn || 0));
          const absGrossIdm = Math.abs(parseFloat(item.sum_sel_gross_idm || 0));
          const absPpnIdm = Math.abs(parseFloat(item.sum_sel_ppn_idm || 0));
          // Keep shop if ANY aggregated difference exceeds tolerance
          return absGross > tol || absPpn > tol || absGrossIdm > tol || absPpnIdm > tol;
        });
      }

      // Apply search filter on summary data
      if (searchQuery) {
        const q = searchQuery.toString().trim().toLowerCase();
        summaryData = summaryData.filter(item => {
          const haystack = [
            item.cab,
            item.shop,
            item.sum_sel_gross,
            item.sum_sel_ppn,
            item.sum_sel_gross_idm,
            item.sum_sel_ppn_idm,
          ]
            .map(v => (v === null || v === undefined ? "" : String(v).toLowerCase()))
            .join(" ");

          return haystack.includes(q);
        });
      }

      // Sort data
      summaryData.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        // Handle numeric columns
        if (
          ["sum_sel_gross", "sum_sel_ppn", "sum_sel_gross_idm", "sum_sel_ppn_idm", "record_count"].includes(sortColumn)
        ) {
          aVal = parseFloat(aVal || 0);
          bVal = parseFloat(bVal || 0);
        } else {
          aVal = String(aVal || "").toLowerCase();
          bVal = String(bVal || "").toLowerCase();
        }

        if (sortOrder === "desc") {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        } else {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
      });

      // Get rekap_remote data for status information
      let rekapRemoteData = [];
      try {
        rekapRemoteData = await RekapRemoteStagingService.getAllRekapData({
          moduleName: "rekon_wt_harian",
        });
        logger.info(`Retrieved ${rekapRemoteData.length} records from rekap_remote for status mapping`);
      } catch (error) {
        logger.warn(`Failed to get rekap_remote data: ${error.message}`);
        // Continue without status data if rekap_remote is unavailable
      }

      // Create a map for quick status lookup by kdtk
      const statusMap = new Map();
      rekapRemoteData.forEach(item => {
        if (item.kdtk) {
          statusMap.set(item.kdtk, {
            status: item.status || "unknown",
            updtime: item.updtime, // Include updtime in the map value
          });
        }
      });

      // Add status and updtime from rekap_remote to summary data by matching kdtk with shop
      summaryData = summaryData.map(item => {
        const rekapInfo = statusMap.get(item.shop) || { status: "no_data", updtime: null };
        return {
          ...item,
          status: rekapInfo.status,
          updtime: rekapInfo.updtime || item.updtime, // Use rekap_remote updtime if available, otherwise keep original
        };
      });

      // ── Enrich each item with note from notesService ─────────────────
      try {
        const allNotes = await notesService.getAll();
        const TABLE_NAME = "rekon_wt_harian";
        // Build note lookup: unixKey = shop + periode (sama seperti di controller updateNote)
        const noteMap = new Map();
        for (const note of allNotes) {
          if (note.tableName === TABLE_NAME) {
            noteMap.set(note.unixKey, {
              noteText: note.noteText,
              updatedAt: note.updated_at || note.updtime,
              pic: note.pic,
              fullName: note.fullName,
            });
          }
        }
        summaryData = summaryData.map(item => {
          const unixKey = `${item.shop}${period}`;
          const note = noteMap.get(unixKey) || null;
          return { ...item, note };
        });
      } catch (error) {
        logger.warn(`[rekon_wt_harian] Failed to enrich notes in getDailyShopSummary: ${error.message}`);
        // Graceful fallback: continue tanpa note
        summaryData = summaryData.map(item => ({ ...item, note: null }));
      }

      // Apply pagination
      const paginatedData = summaryData.slice(offset, offset + validLimit);

      // Calculate summary statistics
      const totalDetailRecords = summaryData.reduce((sum, item) => sum + parseInt(item.record_count || 0), 0);

      // Calculate totals
      const totalRecords = summaryData.length;

      logger.info(
        `getDailyShopSummary completed: ${totalRecords} summary records, ${totalDetailRecords} detail records, ${statusMap.size} status mappings`
      );

      return {
        total: totalRecords,
        page,
        limit: validLimit,
        totalPages: Math.ceil(totalRecords / validLimit),
        data: paginatedData,
      };
    } catch (error) {
      logger.error(`Error in getDailyShopSummary: ${error.message}`);
      throw new Error(`Failed to get daily shop summary: ${error.message}`);
    }
  }
}

export default new RekonWtHarianService();
