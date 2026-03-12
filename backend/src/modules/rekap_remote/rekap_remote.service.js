/**
 * Service for managing remote connection recap logging
 *
 * Implementasi dengan mutex dan load-merge-save pattern untuk mencegah race condition:
 * - Menggunakan async-mutex untuk sinkronisasi akses file
 * - Load-merge-save pattern: baca file -> merge data -> tulis atomic
 * - Retry mechanism untuk menangani file yang sedang diakses proses lain
 * - Atomic write menggunakan temporary file + rename untuk konsistensi data
 */
import RekapRemote from "../../models/rekap_remote.model.js";
import logger from "../../config/logger.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { Mutex } from "async-mutex";
import rekapRemoteStagingService from "./rekap_remote_staging.service.js";
import { Op } from "sequelize";
import resilientDb from "../../config/resilient-database.js";
import { fileUtils } from "../../utils/index.js";

class RekapRemoteService {
  constructor() {
    this.tempFilePath = path.join(os.tmpdir(), "rekap_remote_logs.json");
    this.tempDir = path.dirname(this.tempFilePath);
    this.fileMutex = new Mutex(); // Mutex untuk sinkronisasi akses file
  }

  /**
   * Helper function untuk membaca file dengan retry mechanism
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Object>} Parsed logs object
   */
  async _readLogsWithRetry() {
    try {
      const data = await fileUtils.readFileWithRetry(this.tempFilePath);
      const parsedData = JSON.parse(data);

      // Validasi bahwa data adalah object
      if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
        return parsedData;
      } else {
        logger.warn(`Invalid JSON structure in temp file`);
        return {};
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }
      logger.debug(`Failed to read temp file: ${error.message}`);
      return {};
    }
  }

  /**
   * Helper function untuk menulis file secara atomic dengan retry mechanism
   * @param {Object} data - Data yang akan ditulis
   */
  async _writeAtomicWithRetry(data) {
    await fileUtils.writeAtomicWithRetry(this.tempFilePath, JSON.stringify(data, null, 2));
  }

  /**
   * Clean up temporary files with mutex protection
   */
  async cleanupTempFiles() {
    // Gunakan mutex dengan timeout untuk mencegah hang
    const release = await this.fileMutex.acquire();
    const timeoutId = setTimeout(() => {
      logger.error("cleanupTempFiles mutex acquisition timeout after 30 seconds");
      release();
    }, 30000); // 30 second timeout

    try {
      await fs.unlink(this.tempFilePath);
      logger.info("Cleaned up rekap_remote temporary files");
    } catch (error) {
      // File doesn't exist, ignore error
      logger.debug(`Cleanup temp file: ${error.message}`);
    } finally {
      // Clear timeout dan release mutex
      clearTimeout(timeoutId);
      release();
    }
  }

  getCurrentDateTimeForMySQL() {
    const now = new Date(); // ini sudah waktu lokal sesuai komputer

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // bulan mulai dari 0
    const day = String(now.getDate()).padStart(2, "0");

    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  /**
   * Add log entry to temporary file with mutex protection
   * @param {string} cab - Branch code (4 characters)
   * @param {string} kdtk - Store code (4 characters)
   * @param {string} moduleName - Module name performing the connection
   * @param {string} status - Connection status
   * @param {string} message - Optional message
   */
  async addToTemp(cab, kdtk, moduleName, status, message = "") {
    // Gunakan mutex dengan timeout untuk mencegah hang
    const release = await this.fileMutex.acquire();
    const timeoutId = setTimeout(() => {
      logger.error("addToTemp mutex acquisition timeout after 30 seconds");
      release();
    }, 30000); // 30 second timeout

    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });

      // Load existing logs menggunakan helper function dengan retry
      const logs = await this._readLogsWithRetry();

      // Create or update log entry
      const key = `${cab}_${kdtk}_${moduleName}`;
      const currentTime = this.getCurrentDateTimeForMySQL();

      if (logs[key]) {
        // Key exists, update status and updtime only
        logs[key].status = status;
        logs[key].updtime = currentTime;
        if (message) {
          logs[key].message = message;
        }
        logger.debug(`Updated rekap log: ${cab}-${kdtk} - ${moduleName} - ${status}`);
      } else {
        // New entry
        logs[key] = {
          cab: cab,
          kdtk: kdtk,
          module_name: moduleName,
          status: status,
          updtime: currentTime,
        };
        if (message) {
          logs[key].message = message;
        }
        logger.debug(`Added rekap log: ${cab}-${kdtk} - ${moduleName} - ${status}`);
      }

      // Save back to file dengan atomic write retry
      await this._writeAtomicWithRetry(logs);
    } catch (error) {
      logger.error(`Error adding to temp file: ${error.message}`);
      throw error;
    } finally {
      // Clear timeout dan release mutex
      clearTimeout(timeoutId);
      release();
    }
  }

  /**
   * Save all temporary logs to database with mutex protection
   * @returns {Promise<Object>} Save result
   */
  async saveToDatabase() {
    // Gunakan mutex dengan timeout untuk mencegah hang saat baca/hapus file
    let logs = {};
    let logsToSave = [];
    let updatedModules = [];

    const acquireMutex = async () => {
      const release = await this.fileMutex.acquire();
      const timeoutId = setTimeout(() => {
        logger.error("saveToDatabase mutex acquisition timeout after 30 seconds [REKAP REMOTE]");
        release();
      }, 30000); 

      try {
        logs = await this._readLogsWithRetry();
        if (Object.keys(logs).length > 0) {
          logsToSave = Object.values(logs);
          updatedModules = [...new Set(logsToSave.map(log => log.module_name).filter(m => !!m))];
          // Hapus file segera setelah data di-load ke memory agar proses lain tidak bentrok
          await fs.unlink(this.tempFilePath);
          logger.info("Checked and unlinked rekap_remote temporary files [REKAP REMOTE]");
        }
      } catch (error) {
        if (error.code !== "ENOENT") {
          logger.error(`Error during rekap file extraction: ${error.message}`);
        }
      } finally {
        clearTimeout(timeoutId);
        release();
      }
    };

    await acquireMutex();

    if (logsToSave.length === 0) {
      return { success: true, savedCount: 0, message: "No logs to save" };
    }

    try {
      logger.info(`Saving ${logsToSave.length} rekap logs to database [REKAP REMOTE]`);

      // Process in batches to avoid overwhelming the database
      const BATCH_SIZE = 100;
      let savedCount = 0;
      const errors = [];

      for (let i = 0; i < logsToSave.length; i += BATCH_SIZE) {
        const batch = logsToSave.slice(i, i + BATCH_SIZE);
        const MAX_RETRIES = 3;
        let retryCount = 0;
        let batchSaved = false;

        while (retryCount < MAX_RETRIES && !batchSaved) {
          try {
            // Check if database is available, if not, force reconnect
            if (!resilientDb.isDatabaseAvailable()) {
              logger.info(`Database not available, attempting force reconnect... [REKAP REMOTE]`);
              try {
                await resilientDb.forceReconnect();
                logger.info(`Database reconnection successful [REKAP REMOTE]`);
              } catch (reconnectError) {
                logger.error(`Force reconnect failed: ${reconnectError.message} [REKAP REMOTE]`);
                throw new Error(`Database sedang tidak tersedia dan gagal melakukan reconnect: ${reconnectError.message}`);
              }
            }

            // Use bulkCreate with updateOnDuplicate for upsert behavior
            const result = await Promise.race([
              RekapRemote.bulkCreate(batch, {
                updateOnDuplicate: ["status", "updtime", "message"],
                validate: true,
              }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Database operation timeout after 60 seconds")), 60000)
              ),
            ]);

            savedCount += result.length;
            logger.debug(`Saved batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.length} records [REKAP REMOTE]`);
            batchSaved = true;
          } catch (batchError) {
            retryCount++;
            
            // Provide more specific error messages
            let errorMessage = batchError.message;
            
            if (errorMessage.includes('Database sedang tidak tersedia') || 
                errorMessage.includes('ECONNREFUSED') || 
                errorMessage.includes('ETIMEDOUT')) {
              errorMessage = 'Database sedang tidak tersedia. Mencoba reconnect...';
              // Attempt force reconnect on database unavailable error
              try {
                logger.info(`Attempting force reconnect due to database error [REKAP REMOTE]`);
                await resilientDb.forceReconnect();
                logger.info(`Database reconnection successful, retrying operation [REKAP REMOTE]`);
                // Don't increment retry count for reconnect attempts
                retryCount--;
              } catch (reconnectError) {
                logger.error(`Force reconnect failed: ${reconnectError.message} [REKAP REMOTE]`);
                errorMessage = `Database sedang tidak tersedia dan gagal melakukan reconnect: ${reconnectError.message}`;
              }
            } else if (errorMessage.includes('timeout')) {
              errorMessage = 'Database operation timeout - koneksi terlalu lambat';
            } else if (errorMessage.includes('ECONNREFUSED')) {
              errorMessage = 'Koneksi database ditolak - pastikan database server berjalan';
            } else if (errorMessage.includes('ETIMEDOUT')) {
              errorMessage = 'Koneksi database timeout - periksa jaringan';
            } else if (errorMessage.includes('ER_ACCESS_DENIED')) {
              errorMessage = 'Akses database ditolak - periksa kredensial';
            }

            if (retryCount < MAX_RETRIES) {
              const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
              logger.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${retryCount}/${MAX_RETRIES}): ${errorMessage}. Retrying in ${waitTime}ms... [REKAP REMOTE]`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              logger.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed after ${MAX_RETRIES} attempts: ${errorMessage} [REKAP REMOTE]`);
              errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${errorMessage} (after ${MAX_RETRIES} retries)`);
            }
          }
        }
      }

      // Sync detected modules to JSON files after database operation
      if (updatedModules.length > 0) {
        logger.info(`Syncing ${updatedModules.length} modules to JSON files: ${updatedModules.join(", ")} [REKAP REMOTE]`);
        for (const moduleName of updatedModules) {
          try {
            await rekapRemoteStagingService.syncToJsonFile(moduleName);
          } catch (syncError) {
            logger.error(`Error syncing module ${moduleName} to JSON file: ${syncError.message} [REKAP REMOTE]`);
            errors.push(`JSON sync error for ${moduleName}: ${syncError.message}`);
          }
        }
      }

      // Clean up temporary files after save attempt (without mutex since we're already in mutex)
      try {
        await fs.unlink(this.tempFilePath);
        logger.info("Cleaned up rekap_remote temporary files [REKAP REMOTE]");
      } catch (error) {
        // File doesn't exist, ignore error
        if (error.code === "ENOENT") {
          logger.debug(`Temporary file not found, no cleanup needed: ${error.message}`);
        } else {
          logger.error(`Error cleaning up temp file: ${error.message} [REKAP REMOTE]`);
        }
      }

      const result = {
        success: errors.length === 0,
        savedCount: savedCount,
        totalLogs: logsToSave.length,
        errors: errors,
        message:
          errors.length === 0
            ? `Successfully saved ${savedCount} rekap logs, synced ${updatedModules.length} modules to JSON, and cleaned up temp files [REKAP REMOTE]`
            : `Saved ${savedCount} logs with ${errors.length} batch errors [REKAP REMOTE]`,
      };

      logger.info(`Rekap logs save result: ${result.message} [REKAP REMOTE]`);
      return result;
    } catch (error) {
      logger.error(`Error saving rekap logs to database: ${error.message} [REKAP REMOTE]`);
      throw error;
    }
  }

  async clearLogs() {
    await this.cleanupTempFiles();
  }

  async saveLogsToDatabase(moduleName = null) {
    return await this.saveToDatabase();
  }

  /**
   * Delete rekap logs based on filters (with staging sync)
   * @param {Object} filters - Delete filters
   * @returns {Promise<Object>} Delete result
   */
  async deleteRekapLogs(filters = {}) {
    try {
      const whereClause = {};

      if (filters.cab) {
        whereClause.cab = filters.cab;
      }

      if (filters.kdtk) {
        whereClause.kdtk = filters.kdtk;
      }

      if (filters.moduleName) {
        whereClause.module_name = filters.moduleName;
      }

      // Use staging service to delete and sync
      const deletedCount = await rekapRemoteStagingService.deleteRecords(whereClause);

      return {
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} rekap logs and synced to JSON`,
      };
    } catch (error) {
      logger.error(`Error deleting rekap logs: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
export default new RekapRemoteService();
