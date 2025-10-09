import csvParser from "csv-parser";
import { Readable } from "stream";
import logger from "../../config/logger.js";
import config from "../../config/adjust.config.js";
import storeService from "../store/storeService.js";
import dbStore from "../../config/db_store.js";
import moment from "moment-timezone";

class AdjustService {
  /**
   * Process CSV file for item adjustment
   * @param {Buffer} fileBuffer - CSV file buffer
   * @returns {Promise<Object>} Processing results
   */
  async processCsvAdjust(fileBuffer) {
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

      // Initialize results
      const results = {
        totalStores: selectedStores.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        storeResults: [],
      };

      // Process each store
      for (const store of selectedStores) {
        try {
          logger.info(`Processing store: ${store.storeCode}`);

          // Get records for this store
          const storeRecords = records.filter(record => record.KDTK === store.storeCode);

          // Process store
          const storeResult = await this.processStore(store, storeRecords);
          results.processedStores++;

          if (storeResult.success) {
            results.successStores++;
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
          });
        } catch (error) {
          logger.error(`Error processing store ${store.storeCode}: ${error.message}`);
          results.failedStores.push({
            storeCode: store.storeCode,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error(`Failed to process CSV adjust: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse CSV buffer to array of objects
   * @param {Buffer} buffer - CSV file buffer
   * @returns {Promise<Array>} Parsed records
   */
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
   * Process single store
   * @param {Object} store - Store object
   * @param {Array} records - CSV records for this store
   * @returns {Promise<Object>} Processing result
   */
  async processStore(store, records) {
    let storeConnection;
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
      // Process each record
      await Promise.all(
        records.map(async record => {
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

          // const formatted = storeConnection.format(config.queries.store.insertPlu, params);
          // logger.info(`Executing insert for store ${store.storeCode}: ${formatted}`);

          await storeConnection.query(config.queries.store.insertPlu, params);
          result.processed++;
        })
      );

      // const formattedCek = storeConnection.format(config.queries.store.safetyCek, [FILET]);
      // logger.info(`Executing safety check for store ${store.storeCode}: ${formattedCek}`);
      await storeConnection.query(config.queries.store.safetyCek, [FILET]);

      // Execute finalize queries
      await (async () => {
        for (const query of config.queries.store.finalize) {
          await storeConnection.query(query);
        }
      })();

      result.success = true;
      return result;
    } catch (error) {
      logger.error(`Error processing store ${store.storeCode}: ${error.message}`);
      return {
        processed: 0,
        success: false,
        error: error.message,
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
