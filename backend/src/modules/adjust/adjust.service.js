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
      logger.info(`[adjust][${context}] query done in ${ms}ms, rows=${Array.isArray(rows) ? rows.length : "n/a"}`);
      return rows;
    } catch (err) {
      logger.error(`[adjust][${context}] query failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Helper to determine if an IP address is considered a local simulation IP
   * @param {string} ip
   * @returns {boolean}
   */
  isLocalIp(ip) {
    if (!ip || typeof ip !== "string") return false;
    const cleanIp = ip.trim();
    return /^192\.168\./.test(cleanIp) || /^127\./.test(cleanIp) || cleanIp === "localhost";
  }

  /**
   * Check if a set of store codes qualifies for local simulation direct intervention
   * @param {string[]} storeCodes
   * @returns {Promise<Object>}
   */
  async checkTargetStores(storeCodes) {
    if (!Array.isArray(storeCodes) || storeCodes.length === 0) {
      return { singleStore: false, totalStores: 0, isLocal: false, canDirect: false };
    }

    const uniqueStores = [...new Set(storeCodes.map(s => String(s).trim().toUpperCase()).filter(Boolean))];

    if (uniqueStores.length !== 1) {
      return {
        singleStore: false,
        totalStores: uniqueStores.length,
        isLocal: false,
        canDirect: false,
      };
    }

    const storeCode = uniqueStores[0];
    const storeInfo = await storeService.getStoreIPHost(storeCode);

    if (!storeInfo) {
      return {
        singleStore: true,
        totalStores: 1,
        storeCode,
        storeName: "",
        dbHost: "",
        isLocal: false,
        canDirect: false,
        reason: `Toko ${storeCode} tidak ditemukan di master toko`,
      };
    }

    const isLocal = this.isLocalIp(storeInfo.dbHost);

    return {
      singleStore: true,
      totalStores: 1,
      storeCode,
      storeName: storeInfo.storeName || "",
      dbHost: storeInfo.dbHost || "",
      isLocal,
      canDirect: isLocal,
    };
  }

  /**
   * Validates CSV buffer for non-superadmin direct intervention bypass
   * Must have exactly 1 unique store and that store's IP must be local
   * @param {Buffer} fileBuffer
   * @returns {Promise<{ allowed: boolean, reason?: string, storeCode?: string, dbHost?: string }>}
   */
  async canBypassDirectIntervention(fileBuffer) {
    try {
      const records = await this.parseCsvBuffer(fileBuffer);
      if (!records || records.length === 0) {
        return { allowed: false, reason: "File CSV kosong" };
      }

      const storeCodes = [...new Set(records.map(r => (r.KDTK || r.kdtk || "").trim().toUpperCase()).filter(Boolean))];

      if (storeCodes.length !== 1) {
        return {
          allowed: false,
          reason: `Target file CSV berisi ${storeCodes.length} toko. Non-superadmin hanya diizinkan intervensi langsung untuk 1 toko simulasi.`,
        };
      }

      const storeCode = storeCodes[0];
      const storeInfo = await storeService.getStoreIPHost(storeCode);
      if (!storeInfo) {
        return {
          allowed: false,
          reason: `Toko ${storeCode} tidak ditemukan di master toko.`,
        };
      }

      if (!this.isLocalIp(storeInfo.dbHost)) {
        return {
          allowed: false,
          reason: `IP toko ${storeCode} (${storeInfo.dbHost}) bukan IP lokal/simulasi (192.168.x.x).`,
          storeCode,
          dbHost: storeInfo.dbHost,
        };
      }

      return {
        allowed: true,
        storeCode,
        dbHost: storeInfo.dbHost,
      };
    } catch (err) {
      return { allowed: false, reason: `Gagal memvalidasi file: ${err.message}` };
    }
  }

  /**
   * Process CSV file for item adjustment with history logging (simple version without progress tracking)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @returns {Promise<Object>} Processing results with history
   */
  /**
   * Build single-line batch SQL query for a store (supporting single & multi items)
   * @param {string} kdtk - Store code
   * @param {string} tblFilet - Closing balance table name (e.g. TB7O2609)
   * @param {Array<Object>} items - Array of adjustment items for this store
   * @returns {string} Single line SQL batch query
   */
  buildBcKhususQuery(kdtk, tblFilet, items) {
    const tpl = config.queries.bcKhusus;

    // 1. Init tables
    const initPart = tpl.init;

    // 2. Insert into mstadj for each item
    const insertMstadjParts = items
      .map(item => tpl.insertMstadj(item.prdcd, item.qty_adj, item.keter, item.tgl_selisih))
      .join("");

    // 3. Safety check (adjcek) joining monthly filet table
    const safetyCekPart = tpl.safetyCek(tblFilet);

    // 4. Finalize const docno & update mstadj
    const finalizePart = tpl.finalize;

    // 5. Insert into mstran for each item
    const insertTranParts = items.map(item => tpl.insertTran(item.prdcd)).join("");

    // 6. Response SELECT query
    const finalSelectPart = tpl.finalSelect;

    return initPart + insertMstadjParts + safetyCekPart + finalizePart + insertTranParts + finalSelectPart;
  }

  /**
   * Process CSV file for item adjustment by generating BC Khusus broadcast CSV
   * (Direct store queries are bypassed due to security regulations)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @param {string} fullName - Full name of the user
   * @returns {Promise<Object>} Processing results with generated CSV
   */
  async processCsvAdjustGenerate(fileBuffer, username, fullName) {
    const taskId = `${config.taskProgressName}_${username}`;

    try {
      // Parse CSV to array of objects
      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`[adjust:generate] Parsed ${records.length} records from uploaded CSV`);

      if (records.length === 0) {
        throw new Error("File CSV tidak memiliki data");
      }

      // Group records by store code (KDTK)
      const storeMap = new Map();
      for (const record of records) {
        const kdtk = (record.KDTK || record.kdtk || "").trim().toUpperCase();
        if (!kdtk) continue;

        if (!storeMap.has(kdtk)) {
          storeMap.set(kdtk, []);
        }

        storeMap.get(kdtk).push({
          kdtk,
          prdcd: (record.PRDCD || record.prdcd || "").trim(),
          qty_adj: parseInt(record.QTY_ADJ || record.qty_adj, 10) || 0,
          keter: (record.KETER || record.keter || "").trim(),
          tgl_selisih: (record.TGL_SELISIH || record.tgl_selisih || "").trim(),
        });
      }

      const storeCodes = Array.from(storeMap.keys());
      logger.info(`[adjust:generate] Found ${storeCodes.length} unique stores in CSV`);

      // Start progress tracking
      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, storeCodes.length, {
          module: "adjust",
          title: "Adjustment Process",
          description: "Generating BC Khusus broadcast file",
          startedBy: fullName || username,
          status: "processing",
          createdAt: timeStart,
        });
      } catch (err) {
        logger.warn(`[adjust:generate] Could not start progress task: ${err.message}`);
      }

      // Lookup INDUK stores from storeService
      const selectedStores = await storeService.getStoresByCodes(storeCodes);
      const storeInfoMap = new Map();
      for (const s of selectedStores) {
        storeInfoMap.set(s.storeCode, s);
      }

      // Extract last month YY and MM for filet table
      const lastMonth = moment().tz("Asia/Jakarta").subtract(1, "months");
      const yy = lastMonth.format("YY");
      const mm = lastMonth.format("MM");

      const results = {
        totalStores: storeCodes.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        totalRecords: records.length,
        historyRecords: [], // used for UI DataTable
        csvContent: "",
        fileName: `FILE_BC_KHUSUS_${moment().tz("Asia/Jakarta").format("YYYYMMDD_HHmmss")}.csv`,
        mode: "generate",
      };

      const csvLines = [config.queries.bcKhusus.header]; // "KDCAB|KDTK|STATION|QUERY "
      const executedAt = new Date();

      for (const [kdtk, items] of storeMap.entries()) {
        results.processedStores++;
        const store = storeInfoMap.get(kdtk);

        if (!store) {
          logger.warn(`[adjust:generate] Store ${kdtk} not found in master INDUK`);
          results.failedStores.push({
            storeCode: kdtk,
            error: `Store ${kdtk} tidak ditemukan di master store INDUK`,
          });

          for (const item of items) {
            results.historyRecords.push({
              kdtk: item.kdtk,
              prdcd: item.prdcd,
              qty_adj: item.qty_adj,
              keter: item.keter,
              note: `Store ${kdtk} tidak ditemukan di master store INDUK`,
              pic: username,
              updtime: executedAt,
              status: "FAILED",
            });
          }
          continue;
        }

        const kdcab = (store.branch || store.cab || "").trim().toUpperCase();
        const station = (store.station || "01").trim();
        const tblFilet = `${kdtk}${yy}${mm}`;

        // Build single-line batch query
        const query = this.buildBcKhususQuery(kdtk, tblFilet, items);

        csvLines.push(`${kdcab}|${kdtk}|${station}|${query}`);
        results.successStores++;

        for (const item of items) {
          results.historyRecords.push({
            kdtk: item.kdtk,
            prdcd: item.prdcd,
            qty_adj: item.qty_adj,
            keter: item.keter,
            note: `Generated for BC Khusus (${kdcab}|${kdtk}|${station})`,
            pic: username,
            updtime: executedAt,
            status: "SUCCESS",
          });
        }
      }

      results.csvContent = csvLines.join("\r\n") + "\r\n";

      // Complete progress task
      try {
        await progressService.completeProgress(taskId, {
          description: `Generated BC Khusus CSV for ${results.successStores}/${results.totalStores} stores`,
          status: "completed",
          completedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
        });
      } catch (err) {
        logger.warn(`[adjust:generate] Could not complete progress task: ${err.message}`);
      }

      return results;
    } catch (error) {
      logger.error(`[adjust:generate] Failed to process CSV adjust: ${error.message}`);
      try {
        await progressService.failProgress(taskId, {
          description: `Task failed: ${error.message}`,
          status: "failed",
        });
      } catch (err) {
        // ignore
      }
      throw error;
    }
  }

  /**
   * Process CSV file for item adjustment by directly connecting to store POS DB
   * (Superadmin direct intervention mode)
   */
  async processCsvAdjustDirect(fileBuffer, username, fullName) {
    const taskId = `${config.taskProgressName}_${username}`;
    const tempFilePath = path.join(os.tmpdir(), `adjust_history_${Date.now()}.json`);

    try {
      await fs.mkdir(path.dirname(tempFilePath), { recursive: true });

      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`[adjust:direct] Parsed ${records.length} records from CSV`);

      const storeCodes = [...new Set(records.map(record => record.KDTK))];
      logger.info(`[adjust:direct] Found ${storeCodes.length} unique stores in CSV`);

      const selectedStores = await storeService.getStoresByCodes(storeCodes);
      logger.info(`[adjust:direct] Found ${selectedStores.length} valid INDUK stores`);

      try {
        const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
        await progressService.startProgress(taskId, selectedStores.length, {
          module: "adjust",
          title: "Adjustment Process (Direct Intervention)",
          description: "Connecting directly to store databases",
          startedBy: fullName || username,
          status: "registering",
          createdAt: timeStart,
        });

        logger.info(`Progress task registered for user ${username}, taskId: ${taskId}`);
      } catch (error) {
        logger.error(`Error registering progress task: ${error.message}`);
        if (
          error.code === "TASK_BUSY" ||
          error.message.includes("Maximum concurrent") ||
          error.message.includes("Sistem sedang memproses")
        ) {
          const busyErr = new Error(error.message);
          busyErr.statusCode = 409;
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

      const tempHistoryRecords = [];

      const results = {
        totalStores: selectedStores.length,
        processedStores: 0,
        successStores: 0,
        failedStores: [],
        storeResults: [],
        historyRecords: [],
        mode: "direct",
      };

      const limit = pLimit(config.parallelProcessing.concurrencyLimit);
      let processedCount = 0;

      const storePromises = selectedStores.map(store =>
        limit(async () => {
          if (progressService.isAborted(taskId)) {
            logger.info(`[adjust:direct] Skipping store ${store.storeCode} — task aborted`);
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
            logger.info(`[adjust:direct] Processing store: ${store.storeCode}`);
            const storeRecords = records.filter(record => record.KDTK === store.storeCode);

            const perRecordMs = config.parallelProcessing.perRecordTimeoutMs;
            const rawBudgetMs = config.parallelProcessing.storeTimeoutMs + storeRecords.length * perRecordMs;
            const storeBudgetMs = Math.min(rawBudgetMs, config.parallelProcessing.maxStoreTimeoutMs);

            const controller = new AbortController();

            const processingTask = this.processStoreWithHistory(store, storeRecords, username, controller.signal).catch(
              err => {
                if (!controller.signal.aborted) {
                  logger.error(`[adjust:direct][${store.storeCode}] background processing failed: ${err.message}`);
                }
              },
            );

            let storeTimer = null;
            const storeResult = await Promise.race([
              processingTask,
              new Promise(resolve => {
                storeTimer = setTimeout(() => {
                  controller.abort();
                  logger.error(`[adjust:direct][${store.storeCode}] Store timeout after ${storeBudgetMs}ms`);
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
              if (storeTimer) clearTimeout(storeTimer);
            });

            return {
              type: storeResult.success ? "success" : "error",
              storeCode: store.storeCode,
              storeResult,
              historyRecords: storeResult.historyRecords,
            };
          } catch (error) {
            logger.error(`[adjust:direct] Error processing store ${store.storeCode}: ${error.message}`);
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

      const storeResultsArray = await Promise.all(storePromises);

      if (progressService.isAborted(taskId)) {
        logger.info(`[adjust:direct] Task ${taskId} was cancelled — skipping finalization`);
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

      try {
        const bulkResult = await histAdjustStagingService.bulkInsert(tempHistoryRecords);
        logger.info(`[adjust:direct] Successfully bulk inserted ${bulkResult.insertedCount} history records`);

        await progressService.updateProgress(taskId, processedCount, {
          description: "Inserting history records to database",
          status: "finalizing",
        });

        results.historyRecords = bulkResult.records || tempHistoryRecords;
      } catch (historyError) {
        logger.error(`[adjust:direct] Failed to save history records: ${historyError.message}`);
        results.historyRecords = tempHistoryRecords;
      }

      try {
        await fs.unlink(tempFilePath);
        await progressService.updateProgress(taskId, processedCount, {
          description: "Temporary history file cleaned up",
          status: "finalizing",
        });
      } catch (cleanupError) {
        // ignore
      }

      const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.completeProgress(taskId, {
        description: "All stores processed directly",
        status: "completed",
        completedAt: timeCompleted,
      });

      return results;
    } catch (error) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // ignore
      }

      if (progressService.isAborted(taskId)) {
        logger.info(`[adjust:direct] Task ${taskId} was cancelled — skipping failProgress`);
        return { success: false, message: "Proses dibatalkan oleh pengguna", cancelled: true };
      }

      logger.error(`[adjust:direct] Failed to process CSV adjust: ${error.message}`);
      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });
      throw error;
    } finally {
      progressService.clearProcessingStores(taskId);
    }
  }

  /**
   * Main dispatcher for CSV adjustment
   * @param {Buffer} fileBuffer
   * @param {string} username
   * @param {string} fullName
   * @param {"generate"|"direct"} mode
   */
  async processCsvAdjust(fileBuffer, username, fullName, mode = "generate") {
    if (mode === "direct") {
      return this.processCsvAdjustDirect(fileBuffer, username, fullName);
    }
    return this.processCsvAdjustGenerate(fileBuffer, username, fullName);
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
            `Silakan periksa koneksi toko dan coba lagi.`,
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
