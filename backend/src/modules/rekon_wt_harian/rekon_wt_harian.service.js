/**
 * Service for WT reconciliation
 */
const fs = require("fs").promises;
const path = require("path");
const mysql = require("mysql2/promise");
const logger = require("../../config/logger");
const wrcService = require("../../services/wrc.service");
const dbStore = require("../../config/db_store");
const RekonWtHarian = require("../../models/rekon_wt_harian.model");
const { sequelize } = require("../../config/database");
const { Op } = require("sequelize");
const config = require("../../config/rekon_wt_harian.config");

class RekonWtHarianService {
  /**
   * Reconcile data for all branches
   * @param {string} period - Period in YYMM format
   * @returns {Promise<Object>} Reconciliation results for all branches
   */
  async reconcileAllBranches(period) {
    try {
      // Import storeService directly from the singleton instance
      const storeService = require("../../modules/store/storeService");

      // Ensure storeService is initialized
      await storeService.ensureInitialized();

      // Get all unique branch codes
      const allStores = storeService.stores;
      const branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];
      
      logger.info(`Found ${branches.length} branches to process`);

      const results = {
        success: true,
        totalBranches: branches.length,
        processedBranches: 0,
        branchesWithDifferences: 0,
        totalDifferences: 0,
        details: [],
      };

      // TRULY PARALLEL PROCESSING: Process branches with controlled concurrency
      const BRANCH_CONCURRENCY_LIMIT = config.parallelProcessing?.branchConcurrencyLimit || 3;
      logger.info(`Processing ${branches.length} branches with concurrency limit of ${BRANCH_CONCURRENCY_LIMIT}`);

      // Use semaphore-like approach for branches too
      const processConcurrentBranches = async (branchCodes, limit) => {
        const results = [];
        const executing = [];

        for (const cab of branchCodes) {
          const promise = this.processBranch(cab, period).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
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

      logger.info(`Starting parallel processing of ${branches.length} branches...`);
      const branchStartTime = Date.now();
      
      // Process all branches with controlled concurrency
      const allBranchResults = await processConcurrentBranches(branches, BRANCH_CONCURRENCY_LIMIT);
      
      const branchEndTime = Date.now();
      logger.info(`Completed branch parallel processing in ${(branchEndTime - branchStartTime) / 1000} seconds`);
      
      // Process branch results
      for (const result of allBranchResults) {
        if (result.status === 'fulfilled' && result.value) {
          const branchResult = result.value;
          results.processedBranches++;
          
          if (branchResult.storesWithDifferences > 0) {
            results.branchesWithDifferences++;
            results.totalDifferences += branchResult.totalDifferences;
            results.details.push({
              branch: branchResult.branch,
              storesWithDifferences: branchResult.storesWithDifferences,
              totalDifferences: branchResult.totalDifferences,
              storeDetails: branchResult.details
            });
          }
        } else if (result.status === 'rejected') {
          logger.error(`Branch processing error: ${result.reason}`);
        }
      }

      // Add timestamp to results
      results.timestamp = new Date().toISOString();
      results.period = period;

      logger.info(`Completed processing ${results.processedBranches}/${results.totalBranches} branches`);
      return results;
    } catch (error) {
      logger.error(`Error reconciling all branches: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a single branch (extracted from reconcileAllBranches for parallel processing)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @returns {Promise<Object>} Branch processing result
   */
  async processBranch(cab, period) {
    try {
      logger.info(`Processing branch ${cab}`);
      const branchResult = await this.reconcileData(cab, period);
      return branchResult;
    } catch (error) {
      logger.error(`Error processing branch ${cab}: ${error.message}`);
      throw error; // Let Promise.allSettled handle the rejection
    }
  }

  /**
   * Get all dates in a month
   * @param {string} year - Year in YYYY format
   * @param {string} month - Month in MM format
   * @param {boolean} untilYesterday - If true, get dates until yesterday
   * @returns {Array} Array of dates in YYYY-MM-DD format
   */
  getAllDatesInMonth(year, month, untilYesterday = false) {
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    let lastDay = daysInMonth;
    if (untilYesterday) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      if (parseInt(year) === currentYear && parseInt(month) === currentMonth) {
        lastDay = today.getDate() - 1;
        if (lastDay <= 0) {
          return [];
        }
      }
    }

    for (let i = 1; i <= lastDay; i++) {
      const day = i.toString().padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }

    return dates;
  }

  /**
   * Get query for WRC data
   * @param {string} tableName - WT table name
   * @returns {string} SQL query
   */
  getWrcQuery(tableName) {
    return config.queries.wrc.replace("{date}", tableName.substring(3));
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
   * @returns {Promise<Array>} Array of WRC data
   */
  async getWrcData(cab, period) {
    const wrcInstance = new wrcService();
    const wrcConfig = await wrcInstance.getConnWRC(cab);
    const connection = await mysql.createConnection(wrcConfig);

    try {
      logger.info(`Getting WRC data for cab: ${cab}, period: ${period} ...`);
      const year = "20" + period.substring(0, 2);
      const month = period.substring(2, 4);

      // Get all dates in the month
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const isCurrentMonth = parseInt(year) === currentYear && parseInt(month) === currentMonth;

      const dates = this.getAllDatesInMonth(year, month, isCurrentMonth);

      if (dates.length === 0) {
        return [];
      }

      // Create temporary file to store WRC data
      const tempDir = path.join(process.cwd(), config.tempStorage.filePath, "..");
      const tempFile = path.join(
        process.cwd(),
        config.tempStorage.filePath.replace("wrc_data.json", `wrc_data_${cab}_${period}.json`)
      );

      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }

      // Initialize empty array for all WRC data
      const allWrcData = [];

      // Query each WT table for each date
      for (const date of dates) {
        const dateParts = date.split("-");
        const tableDate = dateParts[0].substring(2) + dateParts[1] + dateParts[2];
        const tableName = `wt_${tableDate}`;

        try {
          const query = this.getWrcQuery(tableName);
          const [rows] = await connection.execute(query);

          if (rows && rows.length > 0) {
            allWrcData.push(...rows);
          }
        } catch (error) {
          logger.error(`Error querying ${tableName}: ${error.message}`);
          // Continue with next date even if there's an error
        }
      }

      // Save data to temporary file
      await fs.writeFile(tempFile, JSON.stringify(allWrcData));

      return tempFile;
    } catch (error) {
      logger.error(`Error getting WRC data: ${error.message}`);
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Get store data and compare with WRC data
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcileData(cab, period) {
    try {
      // Get WRC data
      const wrcDataFile = await this.getWrcData(cab, period);

      if (!wrcDataFile) {
        return { success: false, message: "No WRC data found" };
      }

      // Read WRC data from file
      const wrcDataRaw = await fs.readFile(wrcDataFile, "utf8");
      const wrcData = JSON.parse(wrcDataRaw);

      // Import storeService directly from the singleton instance
      const storeService = require("../../modules/store/storeService");

      // Ensure storeService is initialized
      await storeService.ensureInitialized();

      // Get stores by branch code with notes='INDUK'
      const branchStores = await storeService.getStoresByBranch(cab, true);
      logger.info(`Found ${branchStores.length} INDUK stores for branch ${cab}`);

      // Get store connection and data for each store
      const results = {
        success: true,
        totalStores: branchStores.length,
        processedStores: 0,
        storesWithDifferences: 0,
        totalDifferences: 0,
        details: [],
      };

      // TRULY PARALLEL PROCESSING: Process stores with controlled concurrency using Promise.allSettled
      const CONCURRENCY_LIMIT = config.parallelProcessing?.concurrencyLimit || 5;
      logger.info(`Processing ${branchStores.length} stores with concurrency limit of ${CONCURRENCY_LIMIT}`);

      // Use a semaphore-like approach to control concurrency
      const processConcurrentStores = async (stores, limit) => {
        const results = [];
        const executing = [];

        for (const store of stores) {
          const promise = this.processStoreWithTimeout(store, cab, period, wrcData).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
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

      logger.info(`Starting parallel processing of ${branchStores.length} stores...`);
      const startTime = Date.now();
      
      // Process all stores with controlled concurrency
      const allResults = await processConcurrentStores(branchStores, CONCURRENCY_LIMIT);
      
      const endTime = Date.now();
      logger.info(`Completed parallel processing in ${(endTime - startTime) / 1000} seconds`);
      
      // Process results and collect errors
      const storeErrors = [];
      
      for (const result of allResults) {
        if (result.status === 'fulfilled' && result.value) {
          const storeResult = result.value;
          results.processedStores++;
          
          // Collect errors from individual stores
          if (storeResult.errors && storeResult.errors.length > 0) {
            storeErrors.push({
              store: storeResult.storeCode,
              storeName: storeResult.storeName,
              errors: storeResult.errors
            });
          }
          
          if (storeResult.differences && storeResult.differences.length > 0) {
            results.storesWithDifferences++;
            results.totalDifferences += storeResult.differences.length;
            results.details.push({
              store: storeResult.storeCode,
              storeName: storeResult.storeName,
              differences: storeResult.differences.length,
            });
          }
        } else if (result.status === 'rejected') {
          // This should rarely happen now since we handle errors in processStore
          logger.error(`Unexpected store processing rejection: ${result.reason}`);
          storeErrors.push({
            store: 'unknown',
            storeName: 'unknown', 
            errors: [`Unexpected error: ${result.reason}`]
          });
        }
      }
      
      // Add store errors to results if any
      if (storeErrors.length > 0) {
        results.storeErrors = storeErrors;
        logger.info(`Found errors in ${storeErrors.length} stores, but processing completed`);
      }

      // Clean up temporary file
      try {
        await fs.unlink(wrcDataFile);
      } catch (error) {
        logger.warn(`Error deleting temporary file ${wrcDataFile}: ${error.message}`);
      }

      // Add timestamp to results
      results.timestamp = new Date().toISOString();
      results.branch = cab;
      results.period = period;

      logger.info(`Completed processing ${results.processedStores}/${results.totalStores} stores for branch ${cab}`);
      return results;
    } catch (error) {
      logger.error(`Error reconciling data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a single store with timeout (for parallel processing)
   * @param {Object} store - Store object
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data for the branch
   * @returns {Promise<Object>} Store processing result
   */
  async processStoreWithTimeout(store, cab, period, wrcData) {
    const storeCode = store.storeCode;
    const STORE_TIMEOUT = config.parallelProcessing?.storeTimeoutMs || 30000; // 30 seconds timeout
    
    logger.info(`[${storeCode}] Starting processing...`);
    
    // Create a timeout promise that returns error info instead of rejecting
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        const errorMsg = `Processing timeout after ${STORE_TIMEOUT}ms`;
        logger.error(`[${storeCode}] ${errorMsg}`);
        resolve({
          storeCode,
          storeName: store.storeName,
          differences: [],
          errors: [errorMsg]
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
        logger.info(`[${storeCode}] Completed with errors: ${result.errors.join(', ')}`);
      } else {
        logger.info(`[${storeCode}] Completed successfully`);
      }
      
      return result;
    } catch (error) {
      // This should rarely happen now, but keep as fallback
      const errorMsg = `Unexpected processing failure: ${error.message}`;
      logger.error(`[${storeCode}] ${errorMsg}`);
      return {
        storeCode,
        storeName: store.storeName,
        differences: [],
        errors: [errorMsg]
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
  async processStore(store, cab, period, wrcData) {
    const storeCode = store.storeCode;
    const storeInfo = {
      dbHost: store.dbHost,
      storeName: store.storeName,
    };

    try {
      if (!storeInfo.dbHost) {
        const errorMsg = `No dbHost found in branch ${cab}`;
        logger.warn(`[${storeCode}] ${errorMsg}`);
        return {
          storeCode,
          storeName: storeInfo.storeName,
          differences: [],
          errors: [errorMsg]
        };
      }

      // Connect to store database with reduced retry for faster parallel processing
      const storeConnection = await dbStore.createDbStore(storeInfo.dbHost, 1); // Only 1 retry attempt

      if (!storeConnection) {
        const errorMsg = `Could not connect to ${storeInfo.dbHost}`;
        logger.warn(`[${storeCode}] ${errorMsg}`);
        return {
          storeCode,
          storeName: storeInfo.storeName,
          differences: [],
          errors: [errorMsg]
        };
      }

      try {
        // Get store data with timeout
        const storeQuery = this.getStoreQuery(period);
        logger.debug(`[${storeCode}] Executing query...`);
        
        // Execute query with timeout
        const queryTimeout = config.parallelProcessing?.queryTimeoutMs || 15000; // 15 seconds
        const queryPromise = storeConnection.query(storeQuery);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), queryTimeout);
        });
        
        const [storeData] = await Promise.race([queryPromise, timeoutPromise]);
        logger.debug(`[${storeCode}] Query completed, got ${storeData.length} records`);

        // Filter WRC data for this store
        const storeWrcData = wrcData.filter(item => item.shop === storeCode);
        
        if (storeWrcData.length === 0) {
          logger.debug(`[${storeCode}] No WRC data found`);
          return {
            storeCode,
            storeName: storeInfo.storeName,
            differences: [],
            errors: []
          };
        }

        // Compare data
        logger.debug(`[${storeCode}] Comparing ${storeWrcData.length} WRC records with ${storeData.length} store records`);
        const differences = await this.compareData(cab, period, storeWrcData, storeData, storeCode);
        
        logger.debug(`[${storeCode}] Found ${differences.length} differences`);
        return {
          storeCode,
          storeName: storeInfo.storeName,
          differences,
          errors: []
        };
      } finally {
        // Properly close connection pool
        if (storeConnection) {
          try {
            if (storeConnection.end) {
              await storeConnection.end();
            } else if (storeConnection.destroy) {
              storeConnection.destroy();
            }
          } catch (closeError) {
            // Log connection close error but don't throw
            logger.warn(`[${storeCode}] Error closing connection: ${closeError.message}`);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Processing error: ${error.message}`;
      logger.error(`[${storeCode}] ${errorMsg}`);
      
      // Don't throw - return error info instead to prevent premature response
      return {
        storeCode,
        storeName: storeInfo.storeName,
        differences: [],
        errors: [errorMsg]
      };
    }
  }

  /**
   * Get store IP address
   * @param {string} storeCode - Store code
   * @param {string} cab - Branch code
   * @returns {Promise<Object>} Store information
   */
  async getStoreIp(storeCode, cab) {
    try {
      // Import storeService directly from the singleton instance
      const storeService = require("../../modules/store/storeService");

      // Ensure storeService is initialized
      await storeService.ensureInitialized();

      // Get all stores and filter by store code, branch code, and notes = 'INDUK'
      const allStores = storeService.stores;
      const store = allStores.find(
        s => s.storeCode === storeCode && s.notes === "INDUK" && (s.branch === cab || s.cab === cab) // Check both branch and cab fields for compatibility
      );

      if (!store) {
        logger.warn(`Store not found or not an INDUK store for branch ${cab}: ${storeCode}`);
        return null;
      }

      logger.info(`Found INDUK store for branch ${cab}: ${storeCode} (${store.storeName}) at ${store.dbHost}`);

      return {
        dbHost: store.dbHost,
        storeName: store.storeName,
      };
    } catch (error) {
      logger.error(`Error getting store IP for branch ${cab}: ${error.message}`);
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

        // Hitung selisih
        const grossDiff = storeItem.GROSS - wrcItem.GROSS;
        const ppnDiff = storeItem.PPN - wrcItem.PPN;
        const grossIdmDiff = storeItem.GROSS_IDM - wrcItem.GROSS_IDM;
        const ppnIdmDiff = storeItem.PPN_IDM - wrcItem.PPN_IDM;

        // Cek apakah selisih melebihi threshold
        const hasSignificantDifference =
          Math.abs(grossDiff) > config.differenceThreshold ||
          Math.abs(ppnDiff) > config.differenceThreshold ||
          Math.abs(grossIdmDiff) > config.differenceThreshold ||
          Math.abs(ppnIdmDiff) > config.differenceThreshold;

        // Simpan jika ada selisih signifikan
        if (hasSignificantDifference) {
          logger.info(`Difference found for ${wrcItem.TOKO} on ${wrcItem.TGL1} with type ${wrcItem.TIPE}`);
          logger.debug(`  GROSS: Store=${storeItem.GROSS}, WRC=${wrcItem.GROSS}, Diff=${grossDiff}`);
          logger.debug(`  PPN: Store=${storeItem.PPN}, WRC=${wrcItem.PPN}, Diff=${ppnDiff}`);

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

      // Simpan semua perbedaan sekaligus jika ada
      if (differences.length > 0) {
        logger.info(`Saving ${differences.length} differences of ${storeCode} to database`);
        await RekonWtHarian.bulkCreate(differences);
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
   * Save difference to database
   * @param {Object} difference - Difference data
   * @returns {Promise<Object>} Saved record
   * @deprecated This method is no longer used. Use bulkCreate for better performance.
   */
  async saveDifference(difference) {
    try {
      return await RekonWtHarian.create(difference);
    } catch (error) {
      logger.error(`Error saving difference: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get reconciliation results for all branches
   * @param {string} period - Period in YYMM format
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Reconciliation results for all branches
   */
  async getAllCabangResults(period, options = {}) {
    try {
      const { page = 1, limit = config.pagination.defaultLimit, tipe, toko, tgl1 } = options;
      
      // Ensure limit doesn't exceed maximum
      const validLimit = Math.min(limit, config.pagination.maxLimit);
      const offset = (page - 1) * validLimit;
      
      // Build the query
      const query = {
        periode: period
      };
      
      // Add filters if provided
      if (tipe) query.tipe = tipe;
      if (toko) query.toko = { [Op.like]: `%${toko}%` };
      if (tgl1) query.tgl1 = tgl1;
      
      // Get total count and results
      const { count, rows } = await RekonWtHarian.findAndCountAll({
        where: query,
        limit: validLimit,
        offset,
        order: [
          ["tgl1", "ASC"],
          ["toko", "ASC"],
          ["tipe", "ASC"],
        ],
      });
      
      // Return in the same format as getResults method
      return {
        total: count,
        page,
        limit: validLimit,
        totalPages: Math.ceil(count / validLimit),
        data: rows,
      };
    } catch (error) {
      logger.error(`Error in getAllCabangResults: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get reconciliation results
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Reconciliation results
   */
  async getResults(cab, period, options = {}) {
    try {
      const { page = 1, limit = config.pagination.defaultLimit, tipe, toko, tgl1 } = options;

      // Ensure limit doesn't exceed maximum
      const validLimit = Math.min(limit, config.pagination.maxLimit);
      const offset = (page - 1) * validLimit;

      const whereClause = {
        cab,
        periode: period,
      };

      if (tipe) {
        whereClause.tipe = tipe;
      }

      if (toko) {
        whereClause.toko = toko;
      }

      if (tgl1) {
        whereClause.tgl1 = tgl1;
      }

      const { count, rows } = await RekonWtHarian.findAndCountAll({
        where: whereClause,
        limit: validLimit,
        offset,
        order: [
          ["tgl1", "ASC"],
          ["toko", "ASC"],
          ["tipe", "ASC"],
        ],
      });

      return {
        total: count,
        page,
        limit: validLimit,
        totalPages: Math.ceil(count / validLimit),
        data: rows,
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
        where: { periode: period }
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
      return await RekonWtHarian.destroy({
        where: {
          cab,
          periode: period,
        },
      });
    } catch (error) {
      logger.error(`Error deleting results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary of reconciliation results for all branches
   * @param {string} period - Period in YYMM format
   * @returns {Promise<Object>} Summary of reconciliation results for all branches
   */
  async getAllCabangSummary(period) {
    try {
      // Use a similar query as getSummary but without the cab filter
      const result = await sequelize.query(
        `
        SELECT 
          COUNT(*) as total_records,
          SUM(ABS(selisih_gross)) as total_selisih_gross,
          SUM(ABS(selisih_ppn)) as total_selisih_ppn,
          SUM(ABS(selisih_gross_idm)) as total_selisih_gross_idm,
          SUM(ABS(selisih_ppn_idm)) as total_selisih_ppn_idm
        FROM rekon_wt_harian
        WHERE periode = ?
      `,
        {
          replacements: [period],
          type: sequelize.QueryTypes.SELECT,
        }
      );

      // Get additional statistics for detailed reporting
      const typeStats = await RekonWtHarian.findAll({
        attributes: [
          'tipe',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('selisih_gross')), 'diffGross'],
          [sequelize.fn('SUM', sequelize.col('selisih_ppn')), 'diffPpn']
        ],
        where: {
          periode: period
        },
        group: ['tipe'],
        raw: true
      });
      
      // Get count by branch
      const branchStats = await RekonWtHarian.findAll({
        attributes: [
          'cab',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('selisih_gross')), 'diffGross'],
          [sequelize.fn('SUM', sequelize.col('selisih_ppn')), 'diffPpn']
        ],
        where: {
          periode: period
        },
        group: ['cab'],
        raw: true
      });
      
      // Combine the main summary with additional stats
      const summary = {
        ...result[0],
        typeStats,
        branchStats
      };
      
      return summary;
    } catch (error) {
      logger.error(`Error in getAllCabangSummary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary of reconciliation results
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @returns {Promise<Object>} Summary of reconciliation results
   */
  async getSummary(cab, period) {
    try {
      const result = await sequelize.query(
        `
        SELECT 
          COUNT(*) as total_records,
          SUM(ABS(selisih_gross)) as total_selisih_gross,
          SUM(ABS(selisih_ppn)) as total_selisih_ppn,
          SUM(ABS(selisih_gross_idm)) as total_selisih_gross_idm,
          SUM(ABS(selisih_ppn_idm)) as total_selisih_ppn_idm
        FROM rekon_wt_harian
        WHERE cab = ? AND periode = ?
      `,
        {
          replacements: [cab, period],
          type: sequelize.QueryTypes.SELECT,
        }
      );

      return result[0];
    } catch (error) {
      logger.error(`Error getting summary: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RekonWtHarianService();
