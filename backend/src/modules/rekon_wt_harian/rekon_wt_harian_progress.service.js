const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../config/logger');
const config = require('../../config');
const dbWrc = require('../../services/wrc.service');
const dbStore = require('../../config/db_store');
const rekonProgressService = require('./rekon_progress.service');
const rekonWtHarianService = require('./rekon_wt_harian.service');

class RekonWtHarianProgressService {
  constructor() {
    this.BRANCH_CONCURRENCY_LIMIT = config.parallelProcessing?.branchConcurrencyLimit || 3;
    this.STORE_CONCURRENCY_LIMIT = config.parallelProcessing?.storeConcurrencyLimit || 5;
    this.MAX_WAVES = config.parallelProcessing?.maxWaves || 3;
    this.baseService = rekonWtHarianService;
  }

  /**
   * Reconcile data for all branches with progress tracking
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcileAllBranchesWithProgress(period, progressId) {
    try {
      logger.info(`Starting reconciliation for all branches for period ${period}`);
      const startTime = Date.now();

      // Get all branches
      const branches = await this.baseService.getAllBranches();
      const totalBranches = branches.length;
      
      // Initialize progress tracking
      rekonProgressService.updateProgress(progressId, {
        status: 'running',
        message: `Memulai rekonsiliasi untuk ${totalBranches} cabang`,
        totalItems: totalBranches,
        processedItems: 0,
        itemsWithDifferences: 0,
        totalDifferences: 0,
        startTime,
        currentWave: 1,
        maxWaves: this.MAX_WAVES
      });

      // Process branches with controlled concurrency
      let processedBranches = 0;
      let branchesWithDifferences = 0;
      let totalDifferences = 0;
      let branchErrors = [];

      // Use a semaphore-like approach to control concurrency
      const processConcurrentBranches = async (branches, limit) => {
        const results = [];
        const executing = [];

        for (const branch of branches) {
          const promise = this.processBranchWithProgress(branch, period, progressId).then(result => {
            // Update progress after each branch completes
            processedBranches++;
            
            if (result.storesWithDifferences > 0) {
              branchesWithDifferences++;
              totalDifferences += result.totalDifferences;
            }

            if (result.errors && result.errors.length > 0) {
              branchErrors.push({
                branch: branch.cab,
                errors: result.errors
              });
            }

            // Update progress
            rekonProgressService.updateProgress(progressId, {
              processedItems: processedBranches,
              itemsWithDifferences: branchesWithDifferences,
              totalDifferences: totalDifferences,
              message: `Memproses cabang ${processedBranches}/${totalBranches}`,
              currentBranch: branch.cab,
              currentItem: branch.cab
            });

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

      const branchResults = await processConcurrentBranches(branches, this.BRANCH_CONCURRENCY_LIMIT);

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Prepare final results
      const results = {
        totalBranches,
        processedBranches,
        branchesWithDifferences,
        totalDifferences,
        branchErrors,
        duration,
        timestamp: new Date().toISOString(),
        period
      };

      // Update final progress
      rekonProgressService.updateProgress(progressId, {
        status: 'completed',
        message: `Rekonsiliasi selesai: ${branchesWithDifferences} dari ${totalBranches} cabang memiliki perbedaan`,
        processedItems: totalBranches,
        itemsWithDifferences: branchesWithDifferences,
        totalDifferences: totalDifferences,
        endTime,
        duration,
        currentWave: this.MAX_WAVES // Mark as completed all waves
      });

      logger.info(`Reconciliation completed for all branches in ${duration}s`);
      return results;
    } catch (error) {
      // Update progress with error
      rekonProgressService.updateProgress(progressId, {
        status: 'error',
        message: `Error: ${error.message}`,
        error: error.message
      });

      logger.error(`Error reconciling all branches: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a single branch with progress tracking
   * @param {Object} branch - Branch object
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID for parent process
   * @returns {Promise<Object>} Branch processing result
   */
  async processBranchWithProgress(branch, period, progressId) {
    const cab = branch.cab;
    logger.info(`Processing branch ${cab} for period ${period}`);

    try {
      // Delete existing results for this branch and period
      await this.baseService.deleteResults(cab, period);

      // Get all stores for this branch
      const stores = await this.baseService.getStoresForBranch(cab);
      if (!stores || stores.length === 0) {
        logger.warn(`No stores found for branch ${cab}`);
        return {
          branch: cab,
          totalStores: 0,
          processedStores: 0,
          storesWithDifferences: 0,
          totalDifferences: 0,
          errors: [`No stores found for branch ${cab}`]
        };
      }

      // Reconcile data for this branch
      const result = await this.reconcileDataWithProgress(cab, period, null, progressId);
      return {
        branch: cab,
        ...result
      };
    } catch (error) {
      logger.error(`Error processing branch ${cab}: ${error.message}`);
      return {
        branch: cab,
        totalStores: 0,
        processedStores: 0,
        storesWithDifferences: 0,
        totalDifferences: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Reconcile data for a specific branch with progress tracking
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {string} progressId - Progress tracking ID
   * @param {string} parentProgressId - Optional parent progress ID for all-branch reconciliation
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcileDataWithProgress(cab, period, progressId, parentProgressId = null) {
    try {
      logger.info(`Starting reconciliation for branch ${cab} and period ${period}`);
      const totalStartTime = Date.now();

      // Get all stores for this branch
      const stores = await this.baseService.getStoresForBranch(cab);
      if (!stores || stores.length === 0) {
        const errorMsg = `No stores found for branch ${cab}`;
        logger.warn(errorMsg);
        
        // Update progress if this is a standalone reconciliation
        if (progressId) {
          rekonProgressService.updateProgress(progressId, {
            status: 'error',
            message: errorMsg,
            error: errorMsg
          });
        }
        
        return {
          totalStores: 0,
          processedStores: 0,
          storesWithDifferences: 0,
          totalDifferences: 0,
          errors: [errorMsg]
        };
      }

      // Get WRC data for this branch and period
      const wrcQuery = this.baseService.getWrcQuery(cab, period);
      const [wrcData] = await dbWrc.query(wrcQuery);

      if (!wrcData || wrcData.length === 0) {
        const errorMsg = `No WRC data found for branch ${cab} and period ${period}`;
        logger.warn(errorMsg);
        
        // Update progress if this is a standalone reconciliation
        if (progressId) {
          rekonProgressService.updateProgress(progressId, {
            status: 'error',
            message: errorMsg,
            error: errorMsg
          });
        }
        
        return {
          totalStores: stores.length,
          processedStores: 0,
          storesWithDifferences: 0,
          totalDifferences: 0,
          errors: [errorMsg]
        };
      }

      // Write WRC data to temporary file to avoid memory issues with large datasets
      const wrcDataFile = path.join(os.tmpdir(), `wrc_data_${cab}_${period}_${Date.now()}.json`);
      await fs.writeFile(wrcDataFile, JSON.stringify(wrcData));
      logger.info(`WRC data written to temporary file: ${wrcDataFile}`);

      // Read WRC data from file
      const wrcDataStr = await fs.readFile(wrcDataFile, 'utf8');
      const wrcDataParsed = JSON.parse(wrcDataStr);

      // Initialize results object
      const results = {
        totalStores: stores.length,
        processedStores: 0,
        storesWithDifferences: 0,
        totalDifferences: 0,
        storeResults: [],
        storeErrors: []
      };

      // Initialize progress if this is a standalone reconciliation
      if (progressId) {
        rekonProgressService.updateProgress(progressId, {
          status: 'running',
          message: `Memulai rekonsiliasi untuk ${stores.length} toko`,
          totalItems: stores.length,
          processedItems: 0,
          itemsWithDifferences: 0,
          totalDifferences: 0,
          startTime: totalStartTime,
          currentWave: 1,
          maxWaves: this.MAX_WAVES,
          currentBranch: cab
        });
      }

      // Process stores in waves with controlled concurrency
      let currentStores = [...stores];
      let wave = 1;
      const MAX_WAVES = this.MAX_WAVES;

      while (currentStores.length > 0 && wave <= MAX_WAVES) {
        const waveStartTime = Date.now();
        logger.info(`🌊 Starting wave ${wave} with ${currentStores.length} stores`);

        // Process this wave of stores
        const waveResults = await this.processStoreWaveWithProgress(
          currentStores,
          cab,
          period,
          wrcDataParsed,
          this.STORE_CONCURRENCY_LIMIT,
          wave,
          results,
          progressId,
          parentProgressId
        );

        // Separate completed stores from timeout stores for next wave
        const completedStores = [];
        const timeoutStores = [];
        const storeErrors = [];

        waveResults.forEach((result, index) => {
          const store = currentStores[index];

          if (result.status === 'fulfilled') {
            const storeResult = result.value;

            // Check if this was a timeout
            const hasTimeout = storeResult.errors && storeResult.errors.some(err => err.includes('timeout'));

            if (hasTimeout) {
              timeoutStores.push(store);
            } else {
              completedStores.push(store);

              // Add to results if not a timeout
              results.processedStores++;

              // Check for differences
              if (storeResult.differences && storeResult.differences.length > 0) {
                results.storesWithDifferences++;
                results.totalDifferences += storeResult.differences.length;

                // Add to store results
                results.storeResults.push(storeResult);
              }

              // Check for errors
              if (storeResult.errors && storeResult.errors.length > 0) {
                storeErrors.push({
                  store: storeResult.storeCode,
                  storeName: storeResult.storeName,
                  errors: storeResult.errors
                });

                if (!results.storeErrors) results.storeErrors = [];
                results.storeErrors.push({
                  store: storeResult.storeCode,
                  storeName: storeResult.storeName,
                  errors: storeResult.errors
                });
              }
            }
          } else {
            // Promise rejected - should be rare with our error handling
            const errorMsg = result.reason ? result.reason.message : 'Unknown error';
            logger.error(`Error processing store ${store.storeCode}: ${errorMsg}`);

            storeErrors.push({
              store: store.storeCode,
              storeName: store.storeName,
              errors: [errorMsg]
            });

            if (!results.storeErrors) results.storeErrors = [];
            results.storeErrors.push({
              store: store.storeCode,
              storeName: store.storeName,
              errors: [errorMsg]
            });

            // Count as processed but with error
            results.processedStores++;
          }
        });

        // Update progress if this is a standalone reconciliation
        if (progressId) {
          rekonProgressService.updateProgress(progressId, {
            processedItems: results.processedStores,
            itemsWithDifferences: results.storesWithDifferences,
            totalDifferences: results.totalDifferences,
            message: `Wave ${wave}: ${results.processedStores}/${results.totalStores} toko diproses`,
            currentWave: wave,
            currentBranch: cab,
            currentItem: `Wave ${wave}`
          });
        }

        const waveDuration = (Date.now() - waveStartTime) / 1000;

        logger.info(
          `🌊 Wave ${wave} completed in ${waveDuration}s: ${completedStores.length} completed, ${timeoutStores.length} timeouts, ${storeErrors.length} errors`
        );

        if (timeoutStores.length > 0) {
          logger.info(`⚠️ Timeout stores in wave ${wave}: ${timeoutStores.map(s => s.storeCode).join(', ')}`);
        }

        // Prepare for next wave with timeout stores
        currentStores = timeoutStores;
        wave++;
        
        // Update progress with new wave information if this is a standalone reconciliation
        if (progressId && currentStores.length > 0) {
          rekonProgressService.updateProgress(progressId, {
            message: `Memulai wave ${wave} dengan ${currentStores.length} toko`,
            currentWave: wave,
            currentBranch: cab,
            currentItem: `Wave ${wave}`
          });
        }

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
        rekonProgressService.updateProgress(progressId, {
          message: `Menyimpan data perbedaan ke database...`,
          currentWave: this.MAX_WAVES
        });
        
        const saveResult = await this.baseService.saveDifferencesToDatabase(cab, period);
        logger.info(`Save result: ${JSON.stringify(saveResult)}`);
        
        // Update final progress if this is a standalone reconciliation
        if (progressId) {
          rekonProgressService.updateProgress(progressId, {
            status: 'completed',
            message: `Rekonsiliasi selesai: ${results.storesWithDifferences} dari ${results.totalStores} toko memiliki perbedaan. ${saveResult.savedCount || 0} data disimpan ke database.`,
            processedItems: results.totalStores,
            itemsWithDifferences: results.storesWithDifferences,
            totalDifferences: results.totalDifferences,
            endTime: totalEndTime,
            duration: totalDuration,
            currentWave: this.MAX_WAVES // Mark as completed all waves
          });
        }
      } catch (error) {
        logger.error(`Error saving differences to database: ${error.message}`);
        
        // Still update progress as completed, but with error message
        if (progressId) {
          rekonProgressService.updateProgress(progressId, {
            status: 'completed',
            message: `Rekonsiliasi selesai dengan ${results.storesWithDifferences} perbedaan, tetapi gagal menyimpan ke database: ${error.message}`,
            processedItems: results.totalStores,
            itemsWithDifferences: results.storesWithDifferences,
            totalDifferences: results.totalDifferences,
            endTime: totalEndTime,
            duration: totalDuration,
            currentWave: this.MAX_WAVES
          });
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error reconciling data: ${error.message}`);
      
      // Update progress with error if this is a standalone reconciliation
      if (progressId) {
        rekonProgressService.updateProgress(progressId, {
          status: 'error',
          message: `Error: ${error.message}`,
          error: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Process a wave of stores with controlled concurrency and progress tracking
   * @param {Array} stores - Array of store objects to process
   * @param {string} cab - Branch code
   * @param {string} period - Period in YYMM format
   * @param {Array} wrcData - WRC data for the branch
   * @param {number} concurrencyLimit - Maximum concurrent stores
   * @param {number} waveNumber - Current wave number for logging
   * @param {Object} results - Current results object for tracking progress
   * @param {string} progressId - Progress tracking ID
   * @param {string} parentProgressId - Optional parent progress ID for all-branch reconciliation
   * @returns {Promise<Array>} Promise.allSettled results
   */
  async processStoreWaveWithProgress(stores, cab, period, wrcData, concurrencyLimit, waveNumber, results, progressId, parentProgressId) {
    // Use a semaphore-like approach to control concurrency
    const processConcurrentStores = async (stores, limit) => {
      const storeResults = [];
      const executing = [];

      for (const [index, store] of stores.entries()) {
        const promise = this.baseService.processStoreWithTimeout(store, cab, period, wrcData, waveNumber).then(result => {
          // Update progress after each store completes if this is a standalone reconciliation
          if (progressId) {
            const currentProcessed = results.processedStores + storeResults.filter(r => 
              r.status === 'fulfilled' && 
              !r.value.errors?.some(err => err.includes('timeout'))
            ).length + 1;

            const currentWithDiff = results.storesWithDifferences + 
              storeResults.filter(r => 
                r.status === 'fulfilled' && 
                r.value.differences?.length > 0 && 
                !r.value.errors?.some(err => err.includes('timeout'))
              ).length + 
              (result.differences?.length > 0 ? 1 : 0);

            const currentTotalDiff = results.totalDifferences + 
              storeResults.reduce((sum, r) => 
                r.status === 'fulfilled' && 
                !r.value.errors?.some(err => err.includes('timeout')) ? 
                sum + (r.value.differences?.length || 0) : sum, 0) + 
              (result.differences?.length || 0);

            rekonProgressService.updateProgress(progressId, {
              processedItems: currentProcessed,
              itemsWithDifferences: currentWithDiff,
              totalDifferences: currentTotalDiff,
              message: `Wave ${waveNumber}: ${currentProcessed}/${results.totalStores} toko diproses`,
              currentWave: waveNumber,
              currentBranch: cab,
              currentItem: store.storeCode
            });
          }

          executing.splice(executing.indexOf(promise), 1);
          return result;
        });

        storeResults.push({
          status: 'pending',
          promise
        });
        executing.push(promise);

        // If we've reached the concurrency limit, wait for one to complete
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }

      // Wait for all remaining promises to complete and collect results
      const results = [];
      for (const result of storeResults) {
        try {
          const value = await result.promise;
          results.push({
            status: 'fulfilled',
            value
          });
        } catch (error) {
          results.push({
            status: 'rejected',
            reason: error
          });
        }
      }

      return results;
    };

    return await processConcurrentStores(stores, concurrencyLimit);
  }
}

module.exports = new RekonWtHarianProgressService();