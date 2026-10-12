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
  /**
   * Build single-line batch SQL query for a store (supporting single & multi items)
   * @param {string} kdtk - Store code
   * @param {string} tblFilet - Closing balance table name (e.g. TB7O2609NEW)
   * @param {Array<Object>} items - Array of adjustment items for this store
   * @returns {string} Single line SQL batch query
   */
  buildBcKhususQuery(kdtk, tblFilet, items) {
    const tpl = config.queries.bcKhusus;

    // 1. Init tables & BCKMSTRANADJ
    const initPart = tpl.init;

    // 2. Insert into mstadj for each item
    const insertMstadjParts = items
      .map(item => tpl.insertMstadj(item.prdcd, item.qty_adj, item.keter))
      .join("");

    // 3. Safety check (adjcek) joining monthly filet table
    const safetyCekPart = tpl.safetyCek(tblFilet);

    // 4. Update mstadj if sisa < 0 and saldo * qty < 0
    const updateMstadjPart = tpl.updateMstadj;

    // 5. Insert into BCKMSTRANADJ for each item
    const insertBckParts = items
      .map(item => tpl.insertBckTran(item.prdcd))
      .join("");

    // 6. Response SELECT query
    const finalSelectPart = tpl.finalSelect;

    return initPart + insertMstadjParts + safetyCekPart + updateMstadjPart + insertBckParts + finalSelectPart;
  }

  /**
   * Process CSV file for item adjustment by generating BC Khusus broadcast CSV
   * (Direct store queries are bypassed due to security regulations)
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} username - Username of the user performing adjustment
   * @param {string} fullName - Full name of the user
   * @returns {Promise<Object>} Processing results with generated CSV
   */
  async processCsvAdjust(fileBuffer, username, fullName) {
    const taskId = `${config.taskProgressName}_${username}`;

    try {
      // Parse CSV to array of objects
      const records = await this.parseCsvBuffer(fileBuffer);
      logger.info(`[adjust] Parsed ${records.length} records from uploaded CSV`);

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
      logger.info(`[adjust] Found ${storeCodes.length} unique stores in CSV`);

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
        logger.warn(`[adjust] Could not start progress task: ${err.message}`);
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
      };

      const csvLines = [config.queries.bcKhusus.header]; // "KDCAB|KDTK|STATION|QUERY "
      const executedAt = new Date();

      for (const [kdtk, items] of storeMap.entries()) {
        results.processedStores++;
        const store = storeInfoMap.get(kdtk);

        if (!store) {
          logger.warn(`[adjust] Store ${kdtk} not found in master INDUK`);
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
        const tblFilet = `${kdtk}${yy}${mm}NEW`;

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
        logger.warn(`[adjust] Could not complete progress task: ${err.message}`);
      }

      return results;
    } catch (error) {
      logger.error(`[adjust] Failed to process CSV adjust: ${error.message}`);
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
