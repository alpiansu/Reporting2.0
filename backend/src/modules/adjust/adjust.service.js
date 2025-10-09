import csvParser from "csv-parser";
import { Readable } from "stream";
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import config from "../../config/adjust.config.js";
import storeService from "../store/storeService.js";
import dbStore from "../../config/db_store.js";
import moment from "moment-timezone";
import histAdjustStagingService from "./hist_adjust_staging.service.js";
import { ProgressHelper } from "../../services/progress/index.js";

class AdjustService {
  /**
   * Start adjustment process asynchronously and return progress ID immediately (like rekon_wt_harian)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @param {string} fileName - Original filename (optional)
   * @returns {Promise<string>} Progress ID
   */
  async startAdjustmentProcess(fileBuffer, username, fileName = "adjustment.csv") {
    try {
      // Parse CSV to array of objects
      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`Parsed ${records.length} records from CSV`);

      // Get unique store codes
      const storeCodes = [...new Set(records.map(record => record.KDTK))];
      logger.info(`Found ${storeCodes.length} unique stores in CSV`);

      // Get valid INDUK stores
      const selectedStores = await storeService.getStoresByCodes(storeCodes);
      logger.info(`Found ${selectedStores.length} valid INDUK stores`);

      // Start progress tracking and get progress ID using ProgressHelper
      const progressId = ProgressHelper.start({
        cab: "ADJUST", // Use 'ADJUST' as identifier
        period: `${username}_${Date.now()}`, // Use username and timestamp as period
        message: `Memulai proses adjustment untuk ${selectedStores.length} toko...`,
        details: {
          totalStores: selectedStores.length,
          username,
          fileName,
          processType: "store_adjustment",
          operation: "adjust_stores",
        },
      });

      // Start the actual processing asynchronously (non-blocking)
      this.processCsvAdjustWithProgress(fileBuffer, username, fileName, progressId).catch(error => {
        logger.error(`Async adjustment process failed: ${error.message}`);
        ProgressHelper.fail(progressId, {
          message: `Proses adjustment gagal: ${error.message}`,
          details: {
            error: error.message,
            processType: "store_adjustment",
          },
        });
      });

      // Return progress ID immediately
      return progressId;
    } catch (error) {
      logger.error(`Failed to start adjustment process: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process CSV file for item adjustment with progress tracking (async version)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @param {string} fileName - Original filename (optional)
   * @param {string} progressId - Progress ID for tracking
   * @returns {Promise<Object>} Processing results with history and progress ID
   */
  async processCsvAdjustWithProgress(fileBuffer, username, fileName = "adjustment.csv", progressId) {
    const tempFilePath = path.join(process.cwd(), "temp", `adjust_history_${Date.now()}.json`);

    try {
      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempFilePath), { recursive: true });

      // Parse CSV to array of objects
      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`Parsed ${records.length} records from CSV`);

      // Get unique store codes
      const storeCodes = [...new Set(records.map(record => record.KDTK))];
      logger.info(`Found ${storeCodes.length} unique stores in CSV`);

      // Get valid INDUK stores
      const selectedStores = await storeService.getStoresByCodes(storeCodes);
      logger.info(`Found ${selectedStores.length} valid INDUK stores`);

      // Initialize temporary history array
      const tempHistoryRecords = [];

      // Initialize results
      const results = {
        totalStores: selectedStores.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        storeResults: [],
        historyRecords: [], // Will contain the actual history data
        progressId, // Include progress ID in response
      };

      // Process each store with progress updates
      for (let i = 0; i < selectedStores.length; i++) {
        const store = selectedStores[i];

        try {
          logger.info(`Processing store ${i + 1}/${selectedStores.length}: ${store.storeCode}`);

          // Update progress - attempting store
          ProgressHelper.updateStep(progressId, {
            currentStep: i,
            message: `Menghubungi toko: ${store.storeCode}...`,
            details: {
              currentStore: store.storeCode,
              totalStores: selectedStores.length,
              successfulStores: results.successStores,
              failedStores: results.failedStores.length,
              processType: "store_adjustment",
            },
          });

          // Get records for this store
          const storeRecords = records.filter(record => record.KDTK === store.storeCode);

          // Process store and get detailed results
          const storeResult = await this.processStoreWithHistory(store, storeRecords, username);
          results.processedStores++;

          if (storeResult.success) {
            results.successStores++;

            // Update progress - success
            ProgressHelper.updateStep(progressId, {
              currentStep: results.successStores,
              message: `Toko ${store.storeCode} berhasil diproses (${results.successStores}/${selectedStores.length})`,
              details: {
                currentStore: store.storeCode,
                totalStores: selectedStores.length,
                successfulStores: results.successStores,
                failedStores: results.failedStores.length,
                processType: "store_adjustment",
              },
            });
          } else {
            results.failedStores.push({
              storeCode: store.storeCode,
              error: storeResult.error,
            });
          }

          results.storeResults.push({
            storeCode: store.storeCode,
            processed: storeResult.processed,
            success: storeResult.success,
            error: storeResult.error,
            executedAt: storeResult.executedAt,
          });

          // Add history records to temporary storage
          tempHistoryRecords.push(...storeResult.historyRecords);
        } catch (error) {
          logger.error(`Error processing store ${store.storeCode}: ${error.message}`);

          // Create failed history records for this store
          const storeRecords = records.filter(record => record.KDTK === store.storeCode);
          const failedHistoryRecords = storeRecords.map(record => ({
            kdtk: record.KDTK,
            prdcd: record.PRDCD,
            qty_adj: parseInt(record.QTY_ADJ) || 0,
            keter: record.KETER || "",
            note: error.message,
            pic: username,
            updtime: new Date(),
            status: "FAILED",
          }));

          tempHistoryRecords.push(...failedHistoryRecords);

          results.failedStores.push({
            storeCode: store.storeCode,
            error: error.message,
          });
        }
      }

      // Write temporary history to file
      await fs.writeFile(tempFilePath, JSON.stringify(tempHistoryRecords, null, 2));
      logger.info(`Wrote ${tempHistoryRecords.length} history records to temporary file`);

      // Bulk insert history records to database
      try {
        const bulkResult = await histAdjustStagingService.bulkInsert(tempHistoryRecords);
        logger.info(`Successfully bulk inserted ${bulkResult.insertedCount} history records`);

        // Add history records to results for frontend response
        results.historyRecords = bulkResult.records || tempHistoryRecords;
      } catch (historyError) {
        logger.error(`Failed to save history records: ${historyError.message}`);
        // Don't fail the main process if history saving fails
        results.historyRecords = tempHistoryRecords;
      }

      // Complete progress tracking
      const finalMessage =
        results.failedStores.length > 0
          ? `Proses selesai: ${results.successStores}/${results.totalStores} toko berhasil, ${results.failedStores.length} toko gagal`
          : `Proses selesai: Semua ${results.successStores} toko berhasil diproses`;

      ProgressHelper.complete(progressId, {
        message: finalMessage,
        details: {
          totalStores: results.totalStores,
          successfulStores: results.successStores,
          failedStores: results.failedStores.length,
          historyRecords: results.historyRecords.length,
          completedAt: new Date().toISOString(),
          processType: "store_adjustment",
          summary: {
            total: results.totalStores,
            success: results.successStores,
            failed: results.failedStores.length,
            successRate: results.totalStores > 0 ? Math.round((results.successStores / results.totalStores) * 100) : 0,
          },
        },
      });

      // Clean up temporary file
      try {
        await fs.unlink(tempFilePath);
        logger.info("Cleaned up temporary history file");
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temporary file: ${cleanupError.message}`);
      }

      return results;
    } catch (error) {
      logger.error(`Failed to process CSV adjust: ${error.message}`);

      // Mark progress as failed
      ProgressHelper.fail(progressId, {
        message: `Proses adjustment gagal: ${error.message}`,
        details: {
          error: error.message,
          processType: "store_adjustment",
        },
      });

      // Clean up temporary file in case of error
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Process CSV file for item adjustment with history logging (simple version without progress tracking)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @returns {Promise<Object>} Processing results with history
   */
  async processCsvAdjust(fileBuffer, username) {
    const tempFilePath = path.join(process.cwd(), "temp", `adjust_history_${Date.now()}.json`);

    try {
      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempFilePath), { recursive: true });

      // Parse CSV to array of objects
      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`Parsed ${records.length} records from CSV`);

      // Get unique store codes
      const storeCodes = [...new Set(records.map(record => record.KDTK))];
      logger.info(`Found ${storeCodes.length} unique stores in CSV`);

      // Get valid INDUK stores
      const selectedStores = await storeService.getStoresByCodes(storeCodes);
      logger.info(`Found ${selectedStores.length} valid INDUK stores`);

      // Initialize temporary history array
      const tempHistoryRecords = [];

      // Initialize results
      const results = {
        totalStores: selectedStores.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        storeResults: [],
        historyRecords: [], // Will contain the actual history data
      };

      // Process each store

      // Process all stores asynchronously using Promise.all
      const storePromises = selectedStores.map(async store => {
        try {
          logger.info(`Processing store: ${store.storeCode}`);

          // Get records for this store
          const storeRecords = records.filter(record => record.KDTK === store.storeCode);

          // Process store and get detailed results
          const storeResult = await this.processStoreWithHistory(store, storeRecords, username);

          return {
            type: "success",
            storeCode: store.storeCode,
            storeResult,
            historyRecords: storeResult.historyRecords,
          };
        } catch (error) {
          logger.error(`Error processing store ${store.storeCode}: ${error.message}`);

          // Create failed history records for this store
          const storeRecords = records.filter(record => record.KDTK === store.storeCode);
          const failedHistoryRecords = storeRecords.map(record => ({
            kdtk: record.KDTK,
            prdcd: record.PRDCD,
            qty_adj: parseInt(record.QTY_ADJ) || 0,
            keter: record.KETER || "",
            note: error.message,
            pic: username,
            updtime: new Date(),
            status: "FAILED",
          }));

          return {
            type: "error",
            storeCode: store.storeCode,
            error: error.message,
            historyRecords: failedHistoryRecords,
          };
        }
      });

      // Wait for all store processing to complete
      const storeResultsArray = await Promise.all(storePromises);

      // Process results
      for (const result of storeResultsArray) {
        results.processedStores++;

        if (result.type === "success") {
          if (result.storeResult.success) {
            results.successStores++;
          } else {
            results.failedStores.push({
              storeCode: result.storeCode,
              error: result.storeResult.error,
            });
          }

          results.storeResults.push({
            storeCode: result.storeCode,
            processed: result.storeResult.processed,
            success: result.storeResult.success,
            error: result.storeResult.error,
            executedAt: result.storeResult.executedAt,
          });
        } else {
          results.failedStores.push({
            storeCode: result.storeCode,
            error: result.error,
          });

          results.storeResults.push({
            storeCode: result.storeCode,
            processed: 0,
            success: false,
            error: result.error,
            executedAt: new Date(),
          });
        }

        // Add history records to temporary storage
        tempHistoryRecords.push(...result.historyRecords);
      }

      // Write temporary history to file
      await fs.writeFile(tempFilePath, JSON.stringify(tempHistoryRecords, null, 2));
      logger.info(`Wrote ${tempHistoryRecords.length} history records to temporary file`);

      // Bulk insert history records to database
      try {
        const bulkResult = await histAdjustStagingService.bulkInsert(tempHistoryRecords);
        logger.info(`Successfully bulk inserted ${bulkResult.insertedCount} history records`);

        // Add history records to results for frontend response
        results.historyRecords = bulkResult.records || tempHistoryRecords;
      } catch (historyError) {
        logger.error(`Failed to save history records: ${historyError.message}`);
        // Don't fail the main process if history saving fails
        results.historyRecords = tempHistoryRecords;
      }

      // Clean up temporary file
      try {
        await fs.unlink(tempFilePath);
        logger.info("Cleaned up temporary history file");
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temporary file: ${cleanupError.message}`);
      }

      return results;
    } catch (error) {
      logger.error(`Failed to process CSV adjust: ${error.message}`);

      // Clean up temporary file in case of error
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }
  async parseCsvBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const records = [];
      const readable = Readable.from(buffer);

      readable
        .pipe(
          csvParser({
            mapHeaders: ({ header }) => header.trim(),
            mapValues: ({ value }) => value.trim(),
          })
        )
        .on("data", data => records.push(data))
        .on("error", err => {
          reject(new Error(`Error parsing CSV: ${err.message}`));
        })
        .on("end", () => {
          resolve(records);
        });
    });
  }

  /**
   * Process single store with detailed history logging
   * @param {Object} store - Store object
   * @param {Array} records - CSV records for this store
   * @param {string} username - Username performing the adjustment
   * @returns {Promise<Object>} Processing result with history records
   */
  async processStoreWithHistory(store, records, username) {
    let storeConnection;
    const executedAt = new Date();
    const historyRecords = [];

    try {
      // Get store info first
      const storeInfo = await storeService.getStoreIPHost(store.storeCode);
      if (!storeInfo) {
        throw new Error(`Store information not found for ${store.storeCode}`);
      }

      // Create database connection
      storeConnection = await dbStore.createDbStoreInterfence(storeInfo.dbHost, 2);

      // Initialize result object
      const result = {
        processed: 0,
        success: false,
        error: null,
        executedAt,
        historyRecords: [],
      };

      // Execute init queries
      await (async () => {
        for (const query of config.queries.store.init) {
          await storeConnection.query(query);
        }
      })();

      // Extract YY and MM
      const lastMonth = moment().tz("Asia/Jakarta").subtract(1, "months");
      const yy = lastMonth.format("YY");
      const mm = lastMonth.format("MM");

      // Combine store code with YYMM
      const FILET = store.storeCode + yy + mm;

      // Process each record individually to track success/failure per product
      for (const record of records) {
        try {
          // Prepare parameters for insert query
          const params = [
            record.PRDCD, // prdcd
            record.PRDCD, // plu_nas
            record.QTY_ADJ, // qty for gross
            record.QTY_ADJ, // qty
            record.KETER, // Keterangan
            record.QTY_ADJ, // qty for gross_jual
            record.PRDCD, // prdcd for WHERE clause
          ];

          await storeConnection.query(config.queries.store.insertPlu, params);
          result.processed++;

          // Create success history record
          historyRecords.push({
            kdtk: record.KDTK,
            prdcd: record.PRDCD,
            qty_adj: parseInt(record.QTY_ADJ) || 0,
            keter: record.KETER || "",
            note: "Successfully processed adjustment",
            pic: username,
            updtime: executedAt,
            status: "SUCCESS",
          });
        } catch (recordError) {
          logger.error(`Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`);

          // Create failed history record for this specific product
          historyRecords.push({
            kdtk: record.KDTK,
            prdcd: record.PRDCD,
            qty_adj: parseInt(record.QTY_ADJ) || 0,
            keter: record.KETER || "",
            note: `Failed to process: ${recordError.message}`,
            pic: username,
            updtime: executedAt,
            status: "FAILED",
          });
        }
      }

      // Execute safety check
      await storeConnection.query(config.queries.store.safetyCek, [FILET]);

      // Execute finalize queries
      await (async () => {
        for (const query of config.queries.store.finalize) {
          await storeConnection.query(query);
        }
      })();

      result.success = true;
      result.historyRecords = historyRecords;
      return result;
    } catch (error) {
      logger.error(`Error processing store ${store.storeCode}: ${error.message}`);

      // If store processing failed completely, mark all records as failed
      const failedRecords = records.map(record => ({
        kdtk: record.KDTK,
        prdcd: record.PRDCD,
        qty_adj: parseInt(record.QTY_ADJ) || 0,
        keter: record.KETER || "",
        note: `Store processing failed: ${error.message}`,
        pic: username,
        updtime: executedAt,
        status: "FAILED",
      }));

      return {
        processed: 0,
        success: false,
        error: error.message,
        executedAt,
        historyRecords: failedRecords,
      };
    } finally {
      if (storeConnection) {
        await storeConnection.end();
      }
    }
  }

  /**
   * Generate CSV template for adjust upload
   * @returns {string} CSV template content with headers and example data
   */
  generateCsvTemplate() {
    try {
      // Define CSV headers
      const headers = ["KDTK", "PRDCD", "QTY_ADJ", "KETER"];

      // Define example rows
      const exampleRows = [
        // ["001", "1234567890123", "10", "Adjustment for stock correction"],
        // ["001", "9876543210987", "-5", "Adjustment for damaged goods"],
        // ["002", "1111222233334", "15", "Adjustment for promotion stock"],
      ];

      // Combine headers and example rows
      const csvContent = [headers, ...exampleRows].map(row => row.map(field => `"${field}"`).join(",")).join("\n");

      // Add BOM for proper UTF-8 encoding in Excel
      return "\uFEFF" + csvContent;
    } catch (error) {
      logger.error(`Error generating CSV template: ${error.message}`);
      throw new Error("Failed to generate CSV template");
    }
  }
}

export default new AdjustService();
