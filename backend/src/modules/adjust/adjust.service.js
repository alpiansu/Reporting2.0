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

      // Process each record
      await Promise.all(
        records.map(async record => {
          // Extract YY and MM
          const lastMonth = moment().tz("Asia/Jakarta").subtract(1, "months");
          const yy = lastMonth.format("YY");
          const mm = lastMonth.format("MM");

          // Combine store code with YYMM
          record.FILET = record.KDTK + yy + mm;
          console.log(currentPeriod);
          console.log(record.FILET);

          // Prepare parameters for insert query
          const params = [
            record.PRDCD, // prdcd
            record.PRDCD, // plu_nas
            record.QTY_ADJ, // qty for gross
            record.QTY_ADJ, // qty
            record.QTY_ADJ, // qty for gross_jual
            record.PRDCD, // prdcd for WHERE clause
            currentPeriod,
            currentPeriod,
            record.FILET,
          ];

          await storeConnection.query(config.queries.store.insertPlu, params);
          result.processed++;
        })
      );

      await Promise.all(
        records.map(async record => {
          await storeConnection.query(config.queries.store.safetyCek, [record.FILET]);
        })
      );

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
}

export default new AdjustService();
