import { parse } from "csv-parse";
import { Readable } from "stream";
import logger from "../../config/logger.js";
import config from "../../config/adjust.config.js";
import storeService from "../store/store.service.js";
import { createStoreConnection, executeQuery, closeConnection } from "../../utils/db.utils.js";

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
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      parser.on("readable", () => {
        let record;
        while ((record = parser.read()) !== null) {
          records.push(record);
        }
      });

      parser.on("error", err => {
        reject(new Error(`Error parsing CSV: ${err.message}`));
      });

      parser.on("end", () => {
        resolve(records);
      });

      // Create readable stream from buffer and pipe to parser
      const readable = Readable.from(buffer);
      readable.pipe(parser);
    });
  }

  /**
   * Process single store
   * @param {Object} store - Store object
   * @param {Array} records - CSV records for this store
   * @returns {Promise<Object>} Processing result
   */
  async processStore(store, records) {
    let connection;
    try {
      // Create connection
      connection = await createStoreConnection(store);

      // Initialize result object
      const result = {
        processed: 0,
        success: false,
        error: null,
      };

      // Execute init queries
      for (const query of config.queries.store.init) {
        await executeQuery(connection, query);
      }

      // Process each record
      for (const record of records) {
        const params = [
          record.PRDCD, // prdcd
          record.PRDCD, // plu_nas
          record.QTY_ADJ, // qty for gross
          record.QTY_ADJ, // qty
          record.QTY_ADJ, // qty for gross_jual
          record.PRDCD, // prdcd for WHERE clause
        ];

        await executeQuery(connection, config.queries.store.insertPlu, params);
        result.processed++;
      }

      // Execute finalize queries
      for (const query of config.queries.store.finalize) {
        await executeQuery(connection, query);
      }

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
      if (connection) {
        await closeConnection(connection);
      }
    }
  }
}

export default new AdjustService();
