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
import os from "os";
import pLimit from "p-limit";

class AdjustService {
  /**
   * Process CSV file for item adjustment with history logging (simple version without progress tracking)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @returns {Promise<Object>} Processing results with history
   */
  async processCsvAdjust(fileBuffer, username) {
    const tempFilePath = path.join(os.tmpdir(), `adjust_history_${Date.now()}.json`);

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
      const limit = pLimit(config.parallelProcessing.concurrencyLimit);
      // Process all stores asynchronously using Promise.all
      const storePromises = selectedStores.map(store =>
        limit(async () => {
          try {
            logger.info(`Processing store: ${store.storeCode}`);

            // Filter records khusus untuk toko ini
            const storeRecords = records.filter(record => record.KDTK === store.storeCode);

            // Jalankan proses untuk toko (asynchronous)
            const storeResult = await this.processStoreWithHistory(store, storeRecords, username);

            return {
              type: "success",
              storeCode: store.storeCode,
              storeResult,
              historyRecords: storeResult.historyRecords,
            };
          } catch (error) {
            logger.error(`Error processing store ${store.storeCode}: ${error.message}`);

            // Siapkan record gagal untuk histori
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
        })
      );

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
      // Process all records sequentially and wait for completion
      await (async () => {
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
          } catch (recordError) {
            logger.error(
              `Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`
            );
          }
        }
      })();

      // Execute safety check
      await storeConnection.query(config.queries.store.safetyCek, [FILET]);

      // Execute finalize queries
      await (async () => {
        for (const query of config.queries.store.finalize) {
          await storeConnection.query(query);
        }
      })();

      // Execute insert to mstran
      await (async () => {
        for (const record of records) {
          try {
            // Prepare parameters for insert query
            const params = [
              record.PRDCD, // prdcd
            ];

            const [result] = await storeConnection.query(config.queries.store.insertTran, params);

            if (result.affectedRows > 0) {
              result.processed++;

              // Create success history record
              historyRecords.push({
                kdtk: record.KDTK,
                prdcd: record.PRDCD,
                qty_adj: parseInt(record.QTY_ADJ) || 0,
                keter: record.KETER || "",
                note: `Successfully processed adjustment - ${result.affectedRows} rows affected`,
                pic: username,
                updtime: executedAt,
                status: "SUCCESS",
              });
            } else {
              // Insert gagal - tidak ada rows yang terpengaruh
              historyRecords.push({
                kdtk: record.KDTK,
                prdcd: record.PRDCD,
                qty_adj: parseInt(record.QTY_ADJ) || 0,
                keter: record.KETER || "",
                note: "Insert failed - no rows affected (terkena jagaan saldo < 0 jika di adjust / tidak ada di prodmast)",
                pic: username,
                updtime: executedAt,
                status: "FAILED",
              });
            }
          } catch (recordError) {
            logger.error(
              `Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`
            );

            // Create failed history record for this specific product
            historyRecords.push({
              kdtk: record.KDTK,
              prdcd: record.PRDCD,
              qty_adj: parseInt(record.QTY_ADJ) || 0,
              keter: record.KETER || "",
              note: `Failed to process insert to mstran: ${recordError.message}`,
              pic: username,
              updtime: executedAt,
              status: "FAILED",
            });
          }
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
