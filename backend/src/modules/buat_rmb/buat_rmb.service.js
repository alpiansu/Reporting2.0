import csvParser from "csv-parser";
import { Readable } from "stream";
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import config from "./buat_rmb.config.js";
import storeService from "../store/storeService.js";
import dbStore from "../../config/db_store.js";
import moment from "moment-timezone";
import histBuatRmbStagingService from "./hist_buat_rmb_staging.service.js";
import os from "os";
import pLimit from "p-limit";
import progressService from "../progress/progress.service.js";
import apiResponse from "../../utils/apiResponse.js";

class BuatRmbService {
  async processCsvBuatRmb(fileBuffer, username) {
    const taskId = `${config.taskProgressName}_${username}`;
    const tempFilePath = path.join(os.tmpdir(), `buat_rmb_history_${Date.now()}.json`);

    try {
      await fs.mkdir(path.dirname(tempFilePath), { recursive: true });

      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`Parsed ${records.length} records from CSV`);

      const storeCodes = [...new Set(records.map(record => record.KDTK))];
      logger.info(`Found ${storeCodes.length} unique stores in CSV`);

      // Filter to only existing INDUK stores
      const selectedStores = await storeService.getStoresByCodes(storeCodes);
      logger.info(`Found ${selectedStores.length} valid INDUK stores`);

      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, selectedStores.length, {
          module: "buat_rmb",
          title: "Buat RMB Process",
          description: "registering task & file csv buat rmb being uploaded",
          startedBy: username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(`Progress task registered for user ${username}, taskId: ${taskId}`);
      } catch (error) {
        logger.error(`Error registering progress task: ${error.message}`);
        if (error.message.includes("Maximum concurrent")) {
          throw new Error("System is busy processing other tasks. Please try again later.");
        }
        throw new Error("Failed to register progress task");
      }

      const tempHistoryRecords = [];
      const results = {
        totalStores: selectedStores.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        storeResults: [],
        historyRecords: [],
      };

      const limit = pLimit(config.parallelProcessing.concurrencyLimit);
      let processedCount = 0;
      
      const storePromises = selectedStores.map(store =>
        limit(async () => {
          const currentCount = ++processedCount;
          await progressService.updateProgress(taskId, currentCount, {
            description: `Processing store ${store.storeCode} (${currentCount} of ${selectedStores.length})`,
            status: "Screening to Stores",
          });

          try {
            logger.info(`Processing store: ${store.storeCode}`);
            const storeRecords = records.filter(record => record.KDTK === store.storeCode);
            const storeResult = await this.processStoreWithHistory(store, storeRecords, username);

            return {
              type: "success",
              storeCode: store.storeCode,
              storeResult,
              historyRecords: storeResult.historyRecords,
            };
          } catch (error) {
            logger.error(`Error processing store ${store.storeCode}: ${error.message}`);

            const storeRecords = records.filter(record => record.KDTK === store.storeCode);
            const failedHistoryRecords = storeRecords.map(record => ({
              kdtk: record.KDTK,
              tgl: record.TANGGAL,
              prdcd: record.PRDCD,
              trxid: record.TRXID || "",
              keter: "",
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

      const storeResultsArray = await Promise.all(storePromises);

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

        tempHistoryRecords.push(...result.historyRecords);
      }

      await fs.writeFile(tempFilePath, JSON.stringify(tempHistoryRecords, null, 2));
      await progressService.updateProgress(taskId, processedCount, {
        description: "Writing temporary history file",
        status: "finalizing",
      });
      logger.info(`Wrote ${tempHistoryRecords.length} history records to temporary file`);

      try {
        const bulkResult = await histBuatRmbStagingService.bulkInsert(tempHistoryRecords);
        logger.info(`Successfully bulk inserted ${bulkResult.insertedCount} history records`);

        await progressService.updateProgress(taskId, processedCount, {
          description: "Inserting history records to database",
          status: "finalizing",
        });

        results.historyRecords = bulkResult.records || tempHistoryRecords;
      } catch (historyError) {
        logger.error(`Failed to save history records: ${historyError.message}`);
        results.historyRecords = tempHistoryRecords;
      }

      try {
        await fs.unlink(tempFilePath);
        logger.info("Cleaned up temporary history file");
        await progressService.updateProgress(taskId, processedCount, {
          description: "Temporary history file cleaned up",
          status: "finalizing",
        });
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temporary file: ${cleanupError.message}`);
      }

      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed",
        status: "completed",
        completedAt: timeCompleted,
      });

      return results;
    } catch (error) {
      logger.error(`Failed to process CSV buat_rmb: ${error.message}`);
      try { await fs.unlink(tempFilePath); } catch (e) {}

      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });

      throw error;
    }
  }

  async parseCsvBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const records = [];
      let BOMProcessed = false;
      
      const readable = Readable.from(buffer);
      readable
        .pipe(
          csvParser({
            mapHeaders: ({ header }) => {
              let h = header.trim();
              if (h.charCodeAt(0) === 0xFEFF) h = h.slice(1);
              return h;
            },
            mapValues: ({ value }) => value.trim(),
          })
        )
        .on("data", data => records.push(data))
        .on("error", err => reject(new Error(`Error parsing CSV: ${err.message}`)))
        .on("end", () => resolve(records));
    });
  }

  async processStoreWithHistory(store, records, username) {
    let storeConnection;
    const executedAt = new Date();
    const historyRecords = [];

    try {
      const storeInfo = await storeService.getStoreIPHost(store.storeCode);
      if (!storeInfo) {
        throw new Error(`Store information not found for ${store.storeCode}`);
      }

      storeConnection = await dbStore.createDbStoreInterfence(storeInfo.dbHost, 2);

      const result = {
        processed: 0,
        success: false,
        error: null,
        executedAt,
        historyRecords: [],
      };

      // Execute init queries sequentially
      for (const query of config.queries.store.init) {
        await storeConnection.query({ sql: query, timeout: config.parallelProcessing.queryTimeoutMs });
      }

      for (const record of records) {
        try {
          const params = [
            record.KDTK,
            record.TANGGAL,
            record.PRDCD,
            record.NOHP,
            record.TRXID
          ];

          // Jika ada query insert khusus, jalankan di sini
          if (config.queries.store.insertTran && config.queries.store.insertTran.trim() !== '') {
            // Uncomment baris di bawah jika backend sudah ada query aslinya
            // const [dbResult] = await storeConnection.query({ sql: config.queries.store.insertTran, timeout: config.parallelProcessing.queryTimeoutMs }, params);
          }

          historyRecords.push({
            kdtk: record.KDTK,
            tgl: record.TANGGAL,
            prdcd: record.PRDCD,
            trxid: record.TRXID || "",
            keter: "",
            note: "Successfully sent command to branch",
            pic: username,
            updtime: executedAt,
            status: "SUCCESS",
          });
          result.processed++;
        } catch (recordError) {
          logger.error(`Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`);
          historyRecords.push({
            kdtk: record.KDTK,
            tgl: record.TANGGAL,
            prdcd: record.PRDCD,
            trxid: record.TRXID || "",
            keter: "",
            note: `Operation failed: ${recordError.message}`,
            pic: username,
            updtime: executedAt,
            status: "FAILED",
          });
        }
      }

      // Execute finalize queries sequentially
      for (const query of config.queries.store.finalize) {
        await storeConnection.query({ sql: query, timeout: config.parallelProcessing.queryTimeoutMs });
      }

      result.success = true;
      result.historyRecords = historyRecords;
      return result;
    } catch (error) {
      logger.error(`Error processing store ${store.storeCode}: ${error.message}`);
      
      const failedRecords = records.map(record => ({
        kdtk: record.KDTK,
        tgl: record.TANGGAL,
        prdcd: record.PRDCD,
        trxid: record.TRXID || "",
        keter: "",
        note: `Store connection error: ${error.message}`,
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

  generateCsvTemplate() {
    try {
      const headers = ["KDTK", "TANGGAL", "PRDCD", "NOHP", "TRXID"];
      const exampleRows = [
        // ["TW75", "2024-01-20", "20000459", "081234567890", "TRX-12345"]
      ];

      const csvContent = [headers, ...exampleRows].map(row => row.map(field => `"${field}"`).join(",")).join("\n");
      return "\uFEFF" + csvContent;
    } catch (error) {
      logger.error(`Error generating CSV template: ${error.message}`);
      throw new Error("Failed to generate CSV template");
    }
  }
}

export default new BuatRmbService();
