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

class BuatRmbService {
  async processCsvBuatRmb(fileBuffer, username, fullName) {
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
          startedBy: fullName || username,
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
          // Check if task was cancelled before starting this store
          if (progressService.isAborted(taskId)) {
            logger.info(`[buat_rmb] Skipping store ${store.storeCode} — task aborted`);
            return {
              type: "cancelled",
              storeCode: store.storeCode,
              historyRecords: [],
            };
          }

          const currentCount = ++processedCount;
          await progressService.updateProgress(taskId, currentCount, {
            description: `Processing store ${store.storeCode} (${currentCount} of ${selectedStores.length})`,
            status: "Screening to Stores",
          });

          progressService.addProcessingStore(taskId, store.storeCode);

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
          } finally {
            progressService.removeProcessingStore(taskId, store.storeCode);
          }
        }),
      );

      const storeResultsArray = await Promise.all(storePromises);

      // If task was cancelled, stop before finalizing
      if (progressService.isAborted(taskId)) {
        logger.info(`[buat_rmb] Task ${taskId} was cancelled — skipping finalization`);
        throw new Error("Proses dibatalkan oleh pengguna");
      }

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
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}

      // If task was cancelled by user, don't call failProgress (already handled by cancelTask)
      if (progressService.isAborted(taskId)) {
        logger.info(`[buat_rmb] Task ${taskId} was cancelled — skipping failProgress`);
        return { success: false, message: "Proses dibatalkan oleh pengguna", cancelled: true };
      }

      logger.error(`Failed to process CSV buat_rmb: ${error.message}`);

      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });

      throw error;
    } finally {
      progressService.clearProcessingStores(taskId);
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
              if (h.charCodeAt(0) === 0xfeff) h = h.slice(1);
              return h;
            },
            mapValues: ({ value }) => value.trim(),
          }),
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
      await (async () => {
        for (const query of config.queries.store.prep) {
          await storeConnection.query({
            sql: query,
            timeout: config.parallelProcessing.queryTimeoutMs,
          });
        }
      })();

      await (async () => {
        for (const record of records) {
          try {
            const paramsSafety = [record.TANGGAL, record.TANGGAL, record.TANGGAL, record.PRDCD];

            const qty = parseInt(record.QTY) || 1; // Default to 1 because CSV doesn't have QTY column

            const params = [
              record.TANGGAL,
              record.TANGGAL,
              record.PRDCD,
              record.PRDCD,
              qty,
              qty,
              qty,
              record.NOHP,
              record.KDTK,
              record.PRDCD,
            ];

            //insert safety check
            await storeConnection.query(
              {
                sql: config.queries.store.safetyCek,
                timeout: config.parallelProcessing.queryTimeoutMs,
              },
              paramsSafety,
            );

            //insert plu ke mstrmb
            logger.info(`[buat_rmb.service] Inserting record for store ${store.storeCode}: ${JSON.stringify(params)}`);
            await storeConnection.query(
              {
                sql: config.queries.store.init,
                timeout: config.parallelProcessing.queryTimeoutMs,
              },
              params,
            );

            //update const bpb
            await storeConnection.query({
              sql: config.queries.store.updateConstBPB,
              timeout: config.parallelProcessing.queryTimeoutMs,
            });

            historyRecords.push({
              kdtk: record.KDTK,
              tgl: record.TANGGAL,
              prdcd: record.PRDCD,
              qty: qty,
              trxid: record.TRXID || "",
              keter: record.NOHP || "",
              note: "Successfully sent command to store",
              pic: username,
              updtime: executedAt,
              status: "SUCCESS",
            });
            result.processed++;
          } catch (recordError) {
            logger.error(
              `Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`,
            );
            historyRecords.push({
              kdtk: record.KDTK,
              tgl: record.TANGGAL,
              prdcd: record.PRDCD,
              qty: parseInt(record.QTY) || 0,
              trxid: record.TRXID || "",
              keter: record.NOHP || "",
              note: `Operation failed: ${recordError.message}`,
              pic: username,
              updtime: executedAt,
              status: "FAILED",
            });
          }
        }
      })();

      await (async () => {
        for (const record of records) {
          //insert ke mstran
          const [resultInsertTran] = await storeConnection.query(
            {
              sql: config.queries.store.insertTran,
              timeout: config.parallelProcessing.queryTimeoutMs,
            },
            [record.PRDCD],
          );

          if (resultInsertTran.affectedRows > 0) {
            resultInsertTran.processed++;

            // Query untuk mendapatkan detail row yang baru diinsert
            const [insertedRows] = await storeConnection.query(
              {
                sql: `SELECT rtype, bukti_no, prdcd, qty, price, gross, gross_jual
                FROM mstrmb
                WHERE prdcd = ?
                ORDER BY recid DESC
                LIMIT ?`,
                timeout: config.parallelProcessing.queryTimeoutMs,
              },
              [record.PRDCD, result.affectedRows],
            );

            // Format detail informasi
            let detailInfo = "";
            if (insertedRows && insertedRows.length > 0) {
              const details = insertedRows
                .map(
                  row =>
                    `Rtype: ${row.rtype}, Docno: ${row.bukti_no}, Qty: ${row.qty}, Gross: ${row.gross}, Gross_jual: ${row.gross_jual}`,
                )
                .join(" | ");
              detailInfo = ` - Details: ${details}`;
            }

            // Create success history record
            historyRecords.push({
              kdtk: record.KDTK,
              tgl: record.TANGGAL,
              prdcd: record.PRDCD,
              qty: parseInt(record.QTY) || 0,
              trxid: record.TRXID || "",
              keter: record.NOHP || "",
              note: `Successfully processed adjustment - ${result.affectedRows} rows affected${detailInfo}`,
              pic: username,
              updtime: executedAt,
              status: "SUCCESS",
            });
          } else {
            // Insert gagal - tidak ada rows yang terpengaruh
            historyRecords.push({
              kdtk: record.KDTK,
              tgl: record.TANGGAL,
              prdcd: record.PRDCD,
              qty: parseInt(record.QTY) || 0,
              trxid: record.TRXID || "",
              keter: record.NOHP || "",
              note: "Insert failed - no rows affected (terkena jagaan saldo sudah 0 sebelum di insert RMB / tidak ada di prodmast)",
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

  /**
   * Process RMB yang di-input secara manual via form dialog.
   * Reuses processStoreWithHistory() — tidak ada duplikasi logika.
   * QTY selalu 1 (hardcoded), karena RMB manual selalu +1.
   *
   * @param {Array} records - [{KDTK, TANGGAL, PRDCD, NOHP, TRXID, QTY}]
   * @param {string} username
   */
  async processManualBuatRmb(records, username, fullName) {
    const taskId = `${config.taskProgressName}_${username}`;

    try {
      const storeCodes = [...new Set(records.map(r => r.KDTK))];
      const selectedStores = await storeService.getStoresByCodes(storeCodes);

      if (selectedStores.length === 0) {
        throw new Error("Tidak ada toko valid yang ditemukan untuk kode yang diberikan");
      }

      const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
      try {
        await progressService.startProgress(taskId, selectedStores.length, {
          module: "buat_rmb",
          title: "Manual RMB Process",
          description: "Processing manual RMB input",
          startedBy: fullName || username,
          status: "registering",
          createdAt: timeStart,
        });
      } catch (error) {
        if (error.message.includes("Maximum concurrent")) {
          throw new Error("System is busy processing other tasks. Please try again later.");
        }
        throw new Error("Failed to register progress task");
      }

      const results = {
        totalStores: selectedStores.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        storeResults: [],
        historyRecords: [],
      };

      const tempHistoryRecords = [];

      // Manual biasanya hanya 1 toko, tapi handle generik jika lebih
      for (const store of selectedStores) {
        // Check if task was cancelled before starting this store
        if (progressService.isAborted(taskId)) {
          logger.info(`[buat_rmb_manual] Skipping store ${store.storeCode} — task aborted`);
          break;
        }

        const storeRecords = records.filter(r => r.KDTK === store.storeCode);

        await progressService.updateProgress(taskId, results.processedStores + 1, {
          description: `Processing store ${store.storeCode} (${results.processedStores + 1} of ${selectedStores.length})`,
          status: "Processing to Stores",
        });

        try {
          const storeResult = await this.processStoreWithHistory(store, storeRecords, username);
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
            executedAt: storeResult.executedAt,
          });

          tempHistoryRecords.push(...storeResult.historyRecords);
        } catch (error) {
          logger.error(`Error processing store ${store.storeCode} (manual): ${error.message}`);
          results.processedStores++;
          results.failedStores.push({
            storeCode: store.storeCode,
            error: error.message,
          });

          const failedRecords = storeRecords.map(r => ({
            kdtk: r.KDTK,
            tgl: r.TANGGAL,
            prdcd: r.PRDCD,
            trxid: r.TRXID || "",
            keter: r.NOHP || "",
            note: `Store connection error: ${error.message}`,
            pic: username,
            updtime: new Date(),
            status: "FAILED",
          }));
          tempHistoryRecords.push(...failedRecords);
        }
      }

      // Simpan ke history DB
      try {
        const bulkResult = await histBuatRmbStagingService.bulkInsert(tempHistoryRecords);
        results.historyRecords = bulkResult.records || tempHistoryRecords;
      } catch (histError) {
        logger.error(`Failed to save manual RMB history: ${histError.message}`);
        results.historyRecords = tempHistoryRecords;
      }

      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "Manual RMB processing completed",
        status: "completed",
        completedAt: timeCompleted,
      });

      return results;
    } catch (error) {
      // If task was cancelled by user, don't call failProgress (already handled by cancelTask)
      if (progressService.isAborted(taskId)) {
        logger.info(`[buat_rmb_manual] Task ${taskId} was cancelled — skipping failProgress`);
        return { success: false, message: "Proses dibatalkan oleh pengguna", cancelled: true };
      }

      logger.error(`Failed to process manual RMB: ${error.message}`);
      await progressService
        .failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        })
        .catch(() => {});
      throw error;
    }
  }
}

export default new BuatRmbService();
