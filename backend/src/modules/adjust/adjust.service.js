import csvParser from "csv-parser";
import { Readable } from "stream";
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import config from "./adjust.config.js";
import storeService from "../store/storeService.js";
import dbStore from "../../config/db_store.js";
import moment from "moment-timezone";
import histAdjustStagingService from "./hist_adjust_staging.service.js";
import os from "os";
import pLimit from "p-limit";
import progressService from "../progress/progress.service.js";
import apiResponse from "../../utils/apiResponse.js";
import adjustPostActionService from "./adjust_post_action.service.js";

class AdjustService {
  async executeQuery(connection, sql, params, context, timeout) {
    logger.info(`[adjust][${context}] executing query...`);
    try {
      const start = Date.now();
      const [rows] = await connection.query({ sql, timeout }, params);
      const ms = Date.now() - start;
      logger.info(`[adjust][${context}] query done in ${ms}ms, rows=${Array.isArray(rows) ? rows.length : 'n/a'}`);
      return rows;
    } catch (err) {
      logger.error(`[adjust][${context}] query failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Process CSV file for item adjustment with history logging (simple version without progress tracking)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @returns {Promise<Object>} Processing results with history
   */
  async processCsvAdjust(fileBuffer, username, fullName) {
    const taskId = `${config.taskProgressName}_${username}`;
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

      // Register progress task
      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, selectedStores.length, {
          module: "adjust",
          title: "Adjustment Process",
          description: "registering task & file csv adjust being uploaded",
          startedBy: fullName || username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(`Progress task registered for user ${username}, taskId: ${taskId}`);
      } catch (error) {
        logger.error(`Error registering progress task: ${error.message}`);

        // Throw a typed error so the controller can return the correct HTTP status.
        // (Service layer has no access to `res`, so never call apiResponse here.)
        if (
          error.code === "TASK_BUSY" ||
          error.message.includes("Maximum concurrent") ||
          error.message.includes("Sistem sedang memproses")
        ) {
          const busyErr = new Error(error.message);
          busyErr.statusCode = 409; // 409 Conflict — resource occupied
          busyErr.details = {
            canProceed: false,
            activeTasks: error.activeTasks || [],
            suggestion: "Cek halaman progress untuk melihat proses yang sedang berjalan, atau tunggu hingga selesai.",
          };
          throw busyErr;
        }

        const regErr = new Error(`Gagal mendaftarkan progress task: ${error.message}`);
        regErr.statusCode = 500;
        throw regErr;
      }

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
      let processedCount = 0;
      // Process all stores asynchronously using Promise.all
      const storePromises = selectedStores.map(store =>
        limit(async () => {
          // Check if task was cancelled before starting this store
          if (progressService.isAborted(taskId)) {
            logger.info(`[adjust] Skipping store ${store.storeCode} — task aborted`);
            return {
              type: "cancelled",
              storeCode: store.storeCode,
              historyRecords: [],
            };
          }

          const currentCount = ++processedCount;
          //update progress
          await progressService.updateProgress(taskId, currentCount, {
            description: `Processing store ${store.storeCode} (${currentCount} of ${selectedStores.length})`,
            status: "Screening to Stores",
          });

          progressService.addProcessingStore(taskId, store.storeCode);

          try {
            logger.info(`Processing store: ${store.storeCode}`);
            const storeRecords = records.filter(record => record.KDTK === store.storeCode);

            // Budget timeout per store: base + allowance per record, dibatasi cap.
            // Record dalam satu store diproses sekuensial, jadi budget statis 40s
            // terlalu ketat untuk store dengan banyak record dan memicu timeout palsu
            // padahal prosesnya sehat. Cap (maxStoreTimeoutMs) mencegah budget membengkak
            // tak terkendali untuk store yang benar-benar hang.
            const perRecordMs = config.parallelProcessing.perRecordTimeoutMs;
            const rawBudgetMs = config.parallelProcessing.storeTimeoutMs + storeRecords.length * perRecordMs;
            const storeBudgetMs = Math.min(rawBudgetMs, config.parallelProcessing.maxStoreTimeoutMs);

            // AbortController: saat timeout, proses store benar-benar dihentikan
            // (tidak ada query lanjutan yang menulis data setelah status timeout
            // dilaporkan) — mencegah status tidak konsisten: FAILED tapi data masuk.
            const controller = new AbortController();

            const processingTask = this.processStoreWithHistory(store, storeRecords, username, controller.signal).catch(err => {
              if (!controller.signal.aborted) {
                logger.error(`[adjust][${store.storeCode}] background processing failed: ${err.message}`);
              }
            });

            let storeTimer = null;
            const storeResult = await Promise.race([
              processingTask,
              new Promise((resolve) => {
                storeTimer = setTimeout(() => {
                  controller.abort();
                  logger.error(`[adjust][${store.storeCode}] Store timeout after ${storeBudgetMs}ms`);
                  resolve({
                    success: false,
                    processed: 0,
                    error: `Store timeout after ${storeBudgetMs}ms`,
                    historyRecords: storeRecords.map(record => ({
                      kdtk: record.KDTK,
                      prdcd: record.PRDCD,
                      qty_adj: parseInt(record.QTY_ADJ) || 0,
                      keter: record.KETER || "",
                      note: `Store timeout after ${storeBudgetMs}ms`,
                      pic: username,
                      updtime: new Date(),
                      status: "FAILED",
                    })),
                  });
                }, storeBudgetMs);
              }),
            ]).finally(() => {
              // Selalu bersihkan timer agar tidak ada log timeout palsu untuk
              // store yang selesai tepat waktu (bug: timer tidak pernah di-clear).
              if (storeTimer) clearTimeout(storeTimer);
            });

            return {
              type: storeResult.success ? "success" : "error",
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
          } finally {
            progressService.removeProcessingStore(taskId, store.storeCode);
          }
        }),
      );

      // Wait for all store processing to complete
      const storeResultsArray = await Promise.all(storePromises);

      // If task was cancelled during processing, stop here
      if (progressService.isAborted(taskId)) {
        logger.info(`[adjust] Task ${taskId} was cancelled — skipping finalization`);
        throw new Error("Proses dibatalkan oleh pengguna");
      }

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
      await progressService.updateProgress(taskId, processedCount, {
        description: "Writing temporary history file",
        status: "finalizing",
      });
      logger.info(`Wrote ${tempHistoryRecords.length} history records to temporary file`);

      // Bulk insert history records to database
      try {
        const bulkResult = await histAdjustStagingService.bulkInsert(tempHistoryRecords);
        logger.info(`Successfully bulk inserted ${bulkResult.insertedCount} history records`);

        await progressService.updateProgress(taskId, processedCount, {
          description: "Inserting history records to database",
          status: "finalizing",
        });

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
        //update progressbar status
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
      // Clean up temporary file in case of error
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      // If task was cancelled by user, don't call failProgress (already handled by cancelTask)
      if (progressService.isAborted(taskId)) {
        logger.info(`[adjust] Task ${taskId} was cancelled — skipping failProgress`);
        return { success: false, message: "Proses dibatalkan oleh pengguna", cancelled: true };
      }

      logger.error(`Failed to process CSV adjust: ${error.message}`);

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
      const readable = Readable.from(buffer);

      readable
        .pipe(
          csvParser({
            mapHeaders: ({ header }) => header.trim(),
            mapValues: ({ value }) => value.trim(),
          }),
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
  async processStoreWithHistory(store, records, username, signal) {
    let storeConnection;
    const executedAt = new Date();
    const historyRecords = [];

    // Cek abort (timeout) di sela-sela query: jika timeout sudah diputuskan,
    // berhenti segera agar tidak ada data tambahan yang ditulis ke toko setelah
    // status timeout dilaporkan.
    const throwIfAborted = () => {
      if (signal && signal.aborted) {
        throw new Error("Store processing aborted (timeout)");
      }
    };

    try {
      // Get store info first
      const storeInfo = await storeService.getStoreIPHost(store.storeCode);
      if (!storeInfo) {
        throw new Error(`Store information not found for ${store.storeCode}`);
      }

      // Create database connection
      storeConnection = await dbStore.createDbStoreInterfence(storeInfo.dbHost, 2);

      // Jika koneksi gagal (return null), beri pesan yang lebih user-friendly
      if (!storeConnection) {
        throw new Error(
          `Gagal terhubung ke database toko ${store.storeCode} (${storeInfo.dbHost}). ` +
          `Toko sedang offline atau tidak dapat dijangkau. ` +
          `Silakan periksa koneksi toko dan coba lagi.`
        );
      }

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
          throwIfAborted();
          await this.executeQuery(storeConnection, query, [], "init", config.parallelProcessing.queryTimeoutMs);
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
          // Abort dicek di top loop dengan break agar tidak ada spam log
          // "Error processing record" untuk setiap record yang tersisa.
          if (signal && signal.aborted) break;
          try {
            // Build parameter array: jika tidak ada field ini, otomatis null
            const tglSelisih = record.TGL_SELISIH || record.tgl_selisih || null;

            // Prepare parameters for insert query
            const params = [
              tglSelisih, // inv_date
              record.PRDCD, // prdcd
              record.PRDCD, // plu_nas
              record.QTY_ADJ, // qty for gross
              record.QTY_ADJ, // qty
              record.KETER, // Keterangan
              record.QTY_ADJ, // qty for gross_jual
              record.PRDCD, // prdcd for WHERE clause
            ];

             await this.executeQuery(
               storeConnection,
               config.queries.store.insertPlu,
               params,
               `insertPlu|${store.storeCode}|${record.PRDCD}`,
               config.parallelProcessing.queryTimeoutMs,
             );
          } catch (recordError) {
            logger.error(
              `Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`,
            );
          }
        }
      })();

      throwIfAborted();

      // Execute safety check
      await this.executeQuery(
        storeConnection,
        config.queries.store.safetyCek,
        [FILET],
        `safetyCek|${store.storeCode}`,
        config.parallelProcessing.queryTimeoutMs,
      );

      // Execute finalize queries
      await (async () => {
        for (const query of config.queries.store.finalize) {
          throwIfAborted();
          await this.executeQuery(storeConnection, query, [], "finalize", config.parallelProcessing.queryTimeoutMs);
        }
      })();

      // Execute insert to mstran
      await (async () => {
        for (const record of records) {
          // Abort dicek di top loop dengan break agar tidak ada spam log
          // "Error processing record" untuk setiap record yang tersisa.
          if (signal && signal.aborted) break;
          try {
            // Prepare parameters for insert query
            const params = [
              record.PRDCD, // prdcd
            ];

             const result = await this.executeQuery(
               storeConnection,
               config.queries.store.insertTran,
               params,
               `insertTran|${store.storeCode}|${record.PRDCD}`,
               config.parallelProcessing.queryTimeoutMs,
             );

            if (result.affectedRows > 0) {
              result.processed++;

              // Query untuk mendapatkan detail row yang baru diinsert
               const insertedRows = await this.executeQuery(
                 storeConnection,
                 `SELECT rtype, bukti_no, prdcd, qty, price, gross, gross_jual
                 FROM mstadj
                 WHERE prdcd = ?
                 ORDER BY recid DESC
                 LIMIT ?`,
                 [record.PRDCD, result.affectedRows],
                 `insertedRows|${store.storeCode}|${record.PRDCD}`,
                 config.parallelProcessing.queryTimeoutMs,
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
                prdcd: record.PRDCD,
                qty_adj: parseInt(record.QTY_ADJ) || 0,
                keter: record.KETER || "",
                note: `Successfully processed adjustment - ${result.affectedRows} rows affected${detailInfo}`,
                pic: username,
                updtime: executedAt,
                status: "SUCCESS",
              });

              // Execute scalable post-adjustment actions
              await adjustPostActionService.executePostActions(record, store, username);
            } else {
              // Insert gagal - tidak ada rows yang terpengaruh
              historyRecords.push({
                kdtk: record.KDTK,
                prdcd: record.PRDCD,
                qty_adj: parseInt(record.QTY_ADJ) || 0,
                keter: record.KETER || "",
                note: "Insert failed - no rows affected (terkena jagaan saldo sudah 0 sebelum di adjust / tidak ada di prodmast / duplikat prdcd pada file csv)",
                pic: username,
                updtime: executedAt,
                status: "FAILED",
              });
            }
          } catch (recordError) {
            logger.error(
              `Error processing record ${record.PRDCD} for store ${store.storeCode}: ${recordError.message}`,
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

      // Abort setelah loop terakhir: jika timeout terjadi di sela-sela loop
      // insertTran, jangan pernah mengembalikan success untuk proses yang dibatalkan.
      throwIfAborted();

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
      const headers = ["KDTK", "PRDCD", "QTY_ADJ", "KETER", "TGL_SELISIH"];

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
