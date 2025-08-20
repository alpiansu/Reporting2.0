/**
 * Service for WT reconciliation
 */
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const mysql = require("mysql2/promise");
const logger = require("../../config/logger");
const wrcService = require("../../services/wrc.service");
const dbStore = require("../../config/db_store");
const RekonWtHarian = require("../../models/rekon_wt_harian.model");
const { sequelize } = require("../../config/database");
const { Op } = require("sequelize");
const config = require("../../config/rekon_wt_harian.config");
const rekonProgressService = require("./rekon_progress.service");

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

      // Initialize progress tracking
      const progressId = rekonProgressService.initProgress('All', period, branches.length);
      logger.info(`Initialized progress tracking with ID: ${progressId}`);

      const results = {
        success: true,
        totalBranches: branches.length,
        processedBranches: 0,
        branchesWithDifferences: 0,
        totalDifferences: 0,
        details: [],
        progressId, // Include progress ID in results
      };

      // TRULY PARALLEL PROCESSING: Process branches with controlled concurrency
      const BRANCH_CONCURRENCY_LIMIT = config.parallelProcessing?.branchConcurrencyLimit || 3;
      logger.info(`Processing ${branches.length} branches with concurrency limit of ${BRANCH_CONCURRENCY_LIMIT}`);

      // Use semaphore-like approach for branches too
      const processConcurrentBranches = async (branchCodes, limit) => {
        const results = [];
        const executing = [];
        let processedCount = 0;

        for (const cab of branchCodes) {
          const promise = this.processBranch(cab, period, progressId).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            
            // Update progress after each branch is processed
            processedCount++;
            rekonProgressService.updateProgress(progressId, {
              processedItems: processedCount,
              details: { lastProcessedBranch: cab }
            });
            
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
        if (result.status === "fulfilled" && result.value) {
          const branchResult = result.value;
          results.processedBranches++;

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

      // Add timestamp to results
      results.timestamp = new Date().toISOString();
      results.period = period;

      // Mark progress as completed
      rekonProgressService.updateProgress(progressId, {
        processedItems: results.totalBranches,
        completedItems: results.totalBranches,
        status: 'completed',
        details: {
          branchesWithDifferences: results.branchesWithDifferences,
          totalDifferences: results.totalDifferences
        }
      });

      logger.info(`Completed processing ${results.processedBranches}/${results.totalBranches} branches`);
      return results;
    } catch (error) {
      logger.error(`Error reconciling all branches: ${error.message}`);
      
      // Mark progress as failed
      if (progressId) {
        rekonProgressService.updateProgress(progressId, {
          status: 'failed',
          errors: [error.message]
        });
      }
      
      throw error;
    }
  }

  /**
   * Process a single branch (extracted from reconcileAllBranches for parallel processing)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress ID for tracking reconciliation progress
   * @returns {Promise<Object>} Branch processing result
   */
  async processBranch(cab, period, progressId) {
    try {
      logger.info(`Processing branch ${cab}`);
      const branchResult = await this.reconcileData(cab, period, progressId);
      return branchResult;
    } catch (error) {
      logger.error(`Error processing branch ${cab}: ${error.message}`);
      throw error; // Let Promise.allSettled handle the rejection
    }
  }

  /**
   * Reconcile all branches with progress tracking (non-blocking)
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   */
  async reconcileAllBranchesWithProgress(period, progressId) {
    try {
      // Run in background (non-blocking)
      setTimeout(async () => {
        try {
          await this.reconcileAllBranches(period);
        } catch (error) {
          logger.error(`Error in background reconciliation: ${error.message}`);
          // Progress status will be updated to 'failed' by reconcileAllBranches
        }
      }, 0);
      
      logger.info(`Started non-blocking reconciliation for all branches with progress ID: ${progressId}`);
    } catch (error) {
      logger.error(`Error starting non-blocking reconciliation: ${error.message}`);
      rekonProgressService.updateProgress(progressId, {
        status: 'failed',
        errors: [error.message]
      });
    }
  }

  /**
   * Reconcile data for a single branch with progress tracking (non-blocking)
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   */
  async reconcileDataWithProgress(cab, period, progressId) {
    try {
      // Run in background (non-blocking)
      setTimeout(async () => {
        try {
          // Get stores for this branch to track progress
          const storeService = require("../../modules/store/storeService");
          await storeService.ensureInitialized();
          const branchStores = await storeService.getStoresByBranch(cab, true);
          const totalStores = branchStores.length;
          
          // Inisialisasi progress dengan nilai awal yang benar
          rekonProgressService.updateProgress(progressId, {
            totalItems: totalStores,
            processedItems: 0,
            percentage: 0, // Explicitly set initial percentage to 0
            message: `Memulai proses rekonsiliasi untuk ${totalStores} toko`,
            details: {
              totalStores: totalStores,
              processedStores: 0
            }
          });
          
          // Log initialization with explicit percentage
          logger.info(`Starting reconciliation for ${cab} with ${totalStores} stores (0%)`);
          
          // Set up progress tracking variables
          let processedStores = 0;
          let storesWithDifferences = 0;
          let totalDifferences = 0;
          
          // Set up progress update interval - update every 2 seconds
          const PROGRESS_UPDATE_INTERVAL = 2000;
          const progressInterval = setInterval(() => {
            // Calculate percentage directly here
            const percentage = totalStores > 0 ? Math.round((processedStores / totalStores) * 100) : 0;
            
            // Update progress even if no new stores have been processed
            rekonProgressService.updateProgress(progressId, {
              processedItems: processedStores,
              totalItems: totalStores,
              percentage: percentage, // Explicitly set percentage
              message: `Memproses toko: ${processedStores}/${totalStores} (${percentage}%)`,
              details: {
                currentProgress: `${processedStores}/${totalStores} toko`,
                percentage: percentage,
                storesWithDifferences: storesWithDifferences,
                totalDifferences: totalDifferences
              }
            });
            
            logger.debug(`Progress update: ${processedStores}/${totalStores} stores processed (${percentage}%)`);
          }, PROGRESS_UPDATE_INTERVAL);
          
          // Override the processStore method to track progress
          const originalProcessStore = this.processStore;
          this.processStore = async (store, wrcData) => {
            logger.debug(`Processing store ${store.storeCode}`);
            
            // Process the store
            const result = await originalProcessStore.apply(this, [store, wrcData]);
            
            // Update progress tracking variables
            processedStores++;
            
            // Update differences if any
            if (result && result.differences && result.differences.length > 0) {
              storesWithDifferences++;
              totalDifferences += result.differences.length;
            }
            
            // Calculate percentage directly
            const percentage = totalStores > 0 ? Math.round((processedStores / totalStores) * 100) : 0;
            
            // Update progress immediately for each store
            rekonProgressService.updateProgress(progressId, {
              processedItems: processedStores,
              totalItems: totalStores,
              percentage: percentage, // Explicitly set percentage
              message: `Memproses toko: ${processedStores}/${totalStores} (${percentage}%)`,
              details: {
                currentStore: store.storeCode,
                currentProgress: `${processedStores}/${totalStores} toko`,
                percentage: percentage,
                storesWithDifferences: storesWithDifferences,
                totalDifferences: totalDifferences
              }
            });
            
            // Log detailed progress information
            logger.debug(`Store ${store.storeCode} processed. Progress: ${processedStores}/${totalStores} (${percentage}%)`);
            
            return result;
          };
          
          // Run the reconciliation
          const result = await this.reconcileData(cab, period, progressId);
          
          // Restore original method
          this.processStore = originalProcessStore;
          
          // Clear the interval
          clearInterval(progressInterval);
          
          // Simpan semua perbedaan dari file temporary ke database
          await this.saveDifferencesToDatabase(cab, period);
          
          // Final progress update
          rekonProgressService.updateProgress(progressId, {
            processedItems: totalStores,
            totalItems: totalStores,
            completedItems: totalStores,
            percentage: 100, // Explicitly set to 100% when completed
            status: 'completed',
            message: `Rekonsiliasi selesai: ${result.storesWithDifferences} dari ${totalStores} toko memiliki perbedaan`,
            details: {
              storesWithDifferences: result.storesWithDifferences,
              totalDifferences: result.totalDifferences,
              percentage: 100,
              completed: true,
              // Include wave information in final update
              totalWaves: result.waves ? result.waves.length : 1,
              waveDetails: result.waves || []
            }
          });
          
          // Log final progress
          logger.info(`Reconciliation completed for ${cab}: ${totalStores}/${totalStores} stores processed (100%)`);
          
          logger.info(`Completed reconciliation for ${cab}: ${result.storesWithDifferences}/${totalStores} stores with differences`);
        } catch (error) {
          logger.error(`Error in background reconciliation: ${error.message}`);
          rekonProgressService.updateProgress(progressId, {
            status: 'failed',
            message: `Error: ${error.message}`,
            errors: [error.message]
          });
        }
      }, 0);
      
      logger.info(`Started non-blocking reconciliation for branch ${cab} with progress ID: ${progressId}`);
    } catch (error) {
      logger.error(`Error starting non-blocking reconciliation: ${error.message}`);
      rekonProgressService.updateProgress(progressId, {
        status: 'failed',
        message: `Error: ${error.message}`,
        errors: [error.message]
      });
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
      const tempDir = path.join(os.tmpdir());
      const tempFile = path.join(
        tempDir,
        `wrc_data_${cab}_${period}_${Date.now()}.json`
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
   * @param {string} progressId - Progress ID for tracking reconciliation progress
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcileData(cab, period, progressId) {
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
        waves: [], // Track wave processing
      };

      // WAVE-BASED PROCESSING with retry for timeouts
      const MAX_WAVES = 3;
      const CONCURRENCY_LIMIT = config.parallelProcessing?.concurrencyLimit || 5;

      logger.info(`Starting wave-based processing of ${branchStores.length} stores with ${MAX_WAVES} waves max`);
      const totalStartTime = Date.now();

      // Process stores in waves, retrying timeout stores
      let currentStores = branchStores.slice(); // Copy of all stores
      let wave = 1;

      while (wave <= MAX_WAVES && currentStores.length > 0) {
        logger.info(`\n🌊 Starting Wave ${wave} with ${currentStores.length} stores...`);
        const waveStartTime = Date.now();
        
        // Update progress without wave information
        if (progressId) {
          const progress = rekonProgressService.getProgress(progressId);
          if (progress) {
            rekonProgressService.updateProgress(progressId, {
              details: {
                ...progress.details,
                // Removed wave information
                storeProgress: `${currentStores.length} toko`
              }
            });
          }
        }

        // Process current wave of stores
        const waveResults = await this.processStoreWave(currentStores, cab, period, wrcData, CONCURRENCY_LIMIT, wave);

        const waveEndTime = Date.now();
        const waveDuration = (waveEndTime - waveStartTime) / 1000;

        // Process wave results
        const timeoutStores = [];
        const completedStores = [];
        const storeErrors = [];

        for (const result of waveResults) {
          if (result.status === "fulfilled" && result.value) {
            const storeResult = result.value;

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
              `[Wave ${wave}] ${storeResult.storeCode}: isTimeout=${isTimeout}, errors=${JSON.stringify(
                storeResult.errors
              )}`
            );

            if (isTimeout && wave < MAX_WAVES) {
              // Store timed out, add to retry list
              const store = currentStores.find(s => s.storeCode === storeResult.storeCode);
              if (store) {
                timeoutStores.push(store);
                logger.warn(`[Wave ${wave}] ${storeResult.storeCode} timeout - will retry in next wave`);
              }
            } else {
              // Store completed (successfully or permanently failed)
              completedStores.push(storeResult);
              results.processedStores++;

              // Collect non-timeout errors
              if (storeResult.errors && storeResult.errors.length > 0 && !isTimeout) {
                storeErrors.push({
                  store: storeResult.storeCode,
                  storeName: storeResult.storeName,
                  errors: storeResult.errors,
                });
              }

              // Count successful differences
              if (storeResult.differences && storeResult.differences.length > 0) {
                results.storesWithDifferences++;
                results.totalDifferences += storeResult.differences.length;
                results.details.push({
                  store: storeResult.storeCode,
                  storeName: storeResult.storeName,
                  differences: storeResult.differences.length,
                });
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
          logger.info(`⏳ Waiting 2 seconds before next wave...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Handle any remaining timeout stores after max waves
      if (currentStores.length > 0) {
        logger.warn(`⚠️ ${currentStores.length} stores still timeout after ${MAX_WAVES} waves, marking as failed`);
        const failedStores = currentStores.map(store => ({
          store: store.storeCode,
          storeName: store.storeName,
          errors: [`Failed after ${MAX_WAVES} waves - persistent timeout`],
        }));

        if (!results.storeErrors) results.storeErrors = [];
        results.storeErrors.push(...failedStores);
      }

      const totalEndTime = Date.now();
      const totalDuration = (totalEndTime - totalStartTime) / 1000;

      logger.info(
        `\n🎯 All waves completed in ${totalDuration}s: ${results.processedStores}/${results.totalStores} stores processed`
      );

      // Clean up temporary file
      try {
        await fs.unlink(wrcDataFile);
      } catch (error) {
        logger.warn(`Error deleting temporary file ${wrcDataFile}: ${error.message}`);
      }

      // Add timestamp and summary to results
      results.timestamp = new Date().toISOString();
      results.branch = cab;
      results.period = period;
      results.totalDuration = totalDuration;
      
      // Save differences to database
      try {
        logger.info(`Saving differences to database for branch ${cab} and period ${period}`);
        const saveResult = await this.saveDifferencesToDatabase(cab, period);
        logger.info(`Save result: ${JSON.stringify(saveResult)}`);
        
        // Add save result to results
        results.saveResult = saveResult;
      } catch (error) {
        logger.error(`Error saving differences to database: ${error.message}`);
        results.saveError = error.message;
      }

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
  async processStoreWave(stores, cab, period, wrcData, concurrencyLimit, waveNumber) {
    // Use a semaphore-like approach to control concurrency
    const processConcurrentStores = async (stores, limit) => {
      const results = [];
      const executing = [];

      for (const store of stores) {
        const promise = this.processStoreWithTimeout(store, cab, period, wrcData, waveNumber).then(result => {
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
  async processStoreWithTimeout(store, cab, period, wrcData, waveNumber = 1) {
    const storeCode = store.storeCode;
    const STORE_TIMEOUT = config.parallelProcessing?.storeTimeoutMs || 10000; // Reduced to 10 seconds for more realistic timeout testing

    // FOR TESTING: Simulate timeout on specific stores to test wave system
    const SIMULATE_TIMEOUT = config.testing?.simulateTimeoutStores || [];
    const shouldSimulateTimeout = SIMULATE_TIMEOUT.includes(storeCode);

    if (shouldSimulateTimeout && waveNumber <= 2) {
      logger.warn(`[Wave ${waveNumber}] [${storeCode}] 🧪 SIMULATING TIMEOUT for testing purposes`);
      await new Promise(resolve => setTimeout(resolve, STORE_TIMEOUT + 1000)); // Force timeout
    }

    logger.info(`[Wave ${waveNumber}] [${storeCode}] Starting processing...`);
    
    // Update progress to show current store being processed
    // Find the progress ID for this branch and period
    const progressEntries = Array.from(rekonProgressService.progressMap.entries());
    const progressEntry = progressEntries.find(([_, progress]) => 
      progress.cab === cab && 
      progress.periode === period && 
      progress.status === 'running'
    );
    
    if (progressEntry) {
      const [progressId, progress] = progressEntry;
      rekonProgressService.updateProgress(progressId, {
        details: {
          ...progress.details,
          currentStore: storeCode,
          currentStoreName: store.storeName
          // Removed wave information
        }
      });
    }

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
          errors: [errorMsg],
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
          errors: [errorMsg],
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
          setTimeout(() => reject(new Error("Query timeout")), queryTimeout);
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
            errors: [],
          };
        }

        // Compare data
        logger.debug(
          `[${storeCode}] Comparing ${storeWrcData.length} WRC records with ${storeData.length} store records`
        );
        const differences = await this.compareData(cab, period, storeWrcData, storeData, storeCode);

        logger.debug(`[${storeCode}] Found ${differences.length} differences`);
        return {
          storeCode,
          storeName: storeInfo.storeName,
          differences,
          errors: [],
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
        errors: [errorMsg],
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
      
      // Buat path untuk file temporary
      const tempDir = path.dirname(path.join(process.cwd(), config.tempStorage.filePath));
      const tempFile = path.join(
        process.cwd(),
        config.tempStorage.filePath.replace("wrc_data.json", `differences_${cab}_${period}_${storeCode}.json`)
      );
      
      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }

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

      // Simpan semua perbedaan ke file temporary jika ada
      if (differences.length > 0) {
        logger.info(`Saving ${differences.length} differences of ${storeCode} to temporary file`);
        
        try {
          // Baca file jika sudah ada untuk menambahkan data baru
          let existingDifferences = [];
          try {
            const existingData = await fs.readFile(tempFile, 'utf8');
            existingDifferences = JSON.parse(existingData);
            logger.debug(`Read ${existingDifferences.length} existing differences from temporary file`);
          } catch (error) {
            // File mungkin belum ada, lanjutkan dengan array kosong
            if (error.code !== 'ENOENT') {
              logger.warn(`Error reading temporary file: ${error.message}`);
            }
          }
          
          // Gabungkan perbedaan yang ada dengan yang baru
          const allDifferences = [...existingDifferences, ...differences];
          
          // Simpan ke file temporary
          await fs.writeFile(tempFile, JSON.stringify(allDifferences));
          
          logger.info(`[${storeCode}] Saved ${differences.length} differences to temporary file (total: ${allDifferences.length})`);
          
          return differences;
        } catch (error) {
          logger.error(`[${storeCode}] Error saving differences to temporary file: ${error.message}`);
          throw error;
        }
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
   * Save all differences from temporary files to database
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @returns {Promise<Object>} Result of database save operation
   */
  async saveDifferencesToDatabase(cab, period) {
    try {
      logger.info(`Saving all differences for ${cab} ${period} from temporary files to database`);
      
      // Buat path untuk direktori temporary
      const tempDir = path.dirname(path.join(process.cwd(), config.tempStorage.filePath));
      const filePattern = `differences_${cab}_${period}_*.json`;
      
      // Cari semua file temporary yang sesuai dengan pola
      const files = await fs.readdir(tempDir);
      const differenceFiles = files.filter(file => {
        return file.startsWith(`differences_${cab}_${period}_`) && file.endsWith('.json');
      });
      
      if (differenceFiles.length === 0) {
        logger.info(`No difference files found for ${cab} ${period}`);
        return { success: true, message: 'No differences to save', savedCount: 0 };
      }
      
      logger.info(`Found ${differenceFiles.length} difference files for ${cab} ${period}`);
      
      let totalDifferences = 0;
      let totalSaved = 0;
      let totalErrors = 0;
      
      // Proses setiap file perbedaan
      for (const file of differenceFiles) {
        try {
          const filePath = path.join(tempDir, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const differences = JSON.parse(fileContent);
          
          if (differences.length === 0) {
            continue;
          }
          
          totalDifferences += differences.length;
          logger.info(`Processing ${differences.length} differences from ${file}`);
          
          // Simpan perbedaan ke database dalam batch
          const BATCH_SIZE = 100;
          for (let i = 0; i < differences.length; i += BATCH_SIZE) {
            const batch = differences.slice(i, i + BATCH_SIZE);
            try {
              // Gunakan upsert untuk setiap record agar bisa update jika sudah ada
              const upsertPromises = batch.map(async difference => {
                try {
                  const [record, created] = await RekonWtHarian.upsert(difference, {
                    returning: true, // Return the record whether created or updated
                  });
                  return { success: true, created };
                } catch (error) {
                  logger.error(`Error upserting record: ${error.message}`);
                  return { success: false, error: error.message };
                }
              });
              
              const results = await Promise.allSettled(upsertPromises);
              const successes = results.filter(r => r.status === "fulfilled" && r.value.success).length;
              const failures = results.length - successes;
              
              totalSaved += successes;
              totalErrors += failures;
              
              logger.info(`Batch saved: ${successes} successful, ${failures} failed`);
            } catch (error) {
              logger.error(`Error saving batch to database: ${error.message}`);
              totalErrors += batch.length;
            }
          }
          
          // Hapus file temporary setelah berhasil disimpan ke database
          await fs.unlink(filePath);
          logger.info(`Deleted temporary file ${file} after saving to database`);
        } catch (error) {
          logger.error(`Error processing file ${file}: ${error.message}`);
        }
      }
      
      logger.info(`Completed saving differences to database: ${totalSaved} saved, ${totalErrors} errors out of ${totalDifferences} total`);
      
      return {
        success: true,
        message: `Saved ${totalSaved} differences to database`,
        savedCount: totalSaved,
        errorCount: totalErrors,
        totalCount: totalDifferences
      };
    } catch (error) {
      logger.error(`Error saving differences to database: ${error.message}`);
      return {
        success: false,
        message: `Error saving differences to database: ${error.message}`,
        error: error.message
      };
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
      const {
        page = 1,
        limit = config.pagination.defaultLimit,
        tipe,
        toko,
        tgl1,
        searchQuery,
        sortColumn,
        sortOrder,
      } = options;

      // Ensure limit doesn't exceed maximum
      const validLimit = Math.min(limit, config.pagination.maxLimit);
      const offset = (page - 1) * validLimit;

      // Build the query
      const query = {
        periode: period,
      };

      // Add filters if provided
      if (tipe) query.tipe = tipe;
      if (toko) query.toko = { [Op.like]: `%${toko}%` };
      if (tgl1) query.tgl1 = tgl1;

      // Add search query if provided (search across multiple columns)
      if (searchQuery) {
        query[Op.or] = [
          { shop: { [Op.like]: `%${searchQuery}%` } },
          { toko: { [Op.like]: `%${searchQuery}%` } },
          { tipe: { [Op.like]: `%${searchQuery}%` } },
          { cab: { [Op.like]: `%${searchQuery}%` } },
          { tgl1: { [Op.like]: `%${searchQuery}%` } },
          { gross_wrc: { [Op.like]: `%${searchQuery}%` } },
          { gross_store: { [Op.like]: `%${searchQuery}%` } },
          { gross_idm_wrc: { [Op.like]: `%${searchQuery}%` } },
          { gross_idm_store: { [Op.like]: `%${searchQuery}%` } },
          { ppn_wrc: { [Op.like]: `%${searchQuery}%` } },
          { ppn_store: { [Op.like]: `%${searchQuery}%` } },
          { ppn_idm_wrc: { [Op.like]: `%${searchQuery}%` } },
          { ppn_idm_store: { [Op.like]: `%${searchQuery}%` } },
        ];
      }

      // Define default order or use provided sort parameters
      let orderConfig = [
        ["tgl1", "ASC"],
        ["toko", "ASC"],
        ["tipe", "ASC"],
      ];

      // If sortColumn and sortOrder are provided, use them as primary sort
      if (sortColumn && sortOrder) {
        // Validate sortOrder value
        const validSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : "ASC";
        orderConfig = [[sortColumn, validSortOrder], ...orderConfig];
      }

      // Get total count and results
      const { count, rows } = await RekonWtHarian.findAndCountAll({
        where: query,
        limit: validLimit,
        offset,
        order: orderConfig,
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
      const {
        page = 1,
        limit = config.pagination.defaultLimit,
        tipe,
        toko,
        tgl1,
        searchQuery,
        sortColumn,
        sortOrder,
      } = options;

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

      // Add search query if provided (search across multiple columns)
      if (searchQuery) {
        whereClause[Op.or] = [
          { shop: { [Op.like]: `%${searchQuery}%` } },
          { toko: { [Op.like]: `%${searchQuery}%` } },
          { tipe: { [Op.like]: `%${searchQuery}%` } },
          { tgl1: { [Op.like]: `%${searchQuery}%` } },
          { cab: { [Op.like]: `%${searchQuery}%` } },
          { gross_wrc: { [Op.like]: `%${searchQuery}%` } },
          { gross_store: { [Op.like]: `%${searchQuery}%` } },
          { gross_idm_wrc: { [Op.like]: `%${searchQuery}%` } },
          { gross_idm_store: { [Op.like]: `%${searchQuery}%` } },
          { ppn_wrc: { [Op.like]: `%${searchQuery}%` } },
          { ppn_store: { [Op.like]: `%${searchQuery}%` } },
          { ppn_idm_wrc: { [Op.like]: `%${searchQuery}%` } },
          { ppn_idm_store: { [Op.like]: `%${searchQuery}%` } },
        ];
      }

      // Define default order or use provided sort parameters
      let orderConfig = [
        ["tgl1", "ASC"],
        ["shop", "ASC"],
        ["tipe", "ASC"],
      ];

      // If sortColumn and sortOrder are provided, use them as primary sort
      if (sortColumn && sortOrder) {
        // Validate sortOrder value
        const validSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : "ASC";
        orderConfig = [[sortColumn, validSortOrder], ...orderConfig];
      }

      const { count, rows } = await RekonWtHarian.findAndCountAll({
        where: whereClause,
        limit: validLimit,
        offset,
        order: orderConfig,
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
            COUNT(DISTINCT shop) AS jml_toko,
            SUM(selisih_gross) AS sel_gross,
            SUM(selisih_ppn) AS sel_ppn,
            SUM(selisih_gross_idm) AS sel_gross_idm,
            SUM(selisih_ppn_idm) AS sel_ppn_idm,

            MAX(selisih_gross) AS max_gross,
            MIN(selisih_gross) AS min_gross,

            MAX(selisih_ppn) AS max_ppn,
            MIN(selisih_ppn) AS min_ppn,

            MAX(selisih_gross_idm) AS max_gross_idm,
            MIN(selisih_gross_idm) AS min_gross_idm,

            MAX(selisih_ppn_idm) AS max_ppn_idm,
            MIN(selisih_ppn_idm) AS min_ppn_idm

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
          "tipe",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("selisih_gross")), "diffGross"],
          [sequelize.fn("SUM", sequelize.col("selisih_ppn")), "diffPpn"],
        ],
        where: {
          periode: period,
        },
        group: ["tipe"],
        raw: true,
      });

      // Get count by branch
      const branchStats = await RekonWtHarian.findAll({
        attributes: [
          "cab",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("selisih_gross")), "diffGross"],
          [sequelize.fn("SUM", sequelize.col("selisih_ppn")), "diffPpn"],
        ],
        where: {
          periode: period,
        },
        group: ["cab"],
        raw: true,
      });

      // Combine the main summary with additional stats
      const summary = {
        ...result[0],
        typeStats,
        branchStats,
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
            COUNT(DISTINCT shop) AS jml_toko,
            SUM(selisih_gross) AS sel_gross,
            SUM(selisih_ppn) AS sel_ppn,
            SUM(selisih_gross_idm) AS sel_gross_idm,
            SUM(selisih_ppn_idm) AS sel_ppn_idm,

            MAX(selisih_gross) AS max_gross,
            MIN(selisih_gross) AS min_gross,

            MAX(selisih_ppn) AS max_ppn,
            MIN(selisih_ppn) AS min_ppn,

            MAX(selisih_gross_idm) AS max_gross_idm,
            MIN(selisih_gross_idm) AS min_gross_idm,

            MAX(selisih_ppn_idm) AS max_ppn_idm,
            MIN(selisih_ppn_idm) AS min_ppn_idm

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
