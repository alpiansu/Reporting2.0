/**
 * Service for managing remote connection recap logging
 *
 * Implementasi dengan mutex dan load-merge-save pattern untuk mencegah race condition:
 * - Menggunakan async-mutex untuk sinkronisasi akses file
 * - Load-merge-save pattern: baca file -> merge data -> tulis atomic
 * - Retry mechanism untuk menangani file yang sedang diakses proses lain
 * - Atomic write menggunakan temporary file + rename untuk konsistensi data
 */
const RekapRemote = require("../../models/rekap_remote.model");
const logger = require("../../config/logger");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { Mutex } = require("async-mutex");
const rekapRemoteStagingService = require('./rekap_remote_staging.service');
const { Op } = require('sequelize');

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
  async _readLogsWithRetry(maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await fs.readFile(this.tempFilePath, "utf8");
        const parsedData = JSON.parse(data);

        // Validasi bahwa data adalah object
        if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
          return parsedData;
        } else {
          logger.warn(`Invalid JSON structure in temp file (attempt ${attempt})`);
          return {};
        }
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Wait sebentar sebelum retry
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
          logger.debug(`Retry reading temp file (attempt ${attempt + 1}): ${error.message}`);
        }
      }
    }

    // Jika semua attempt gagal
    logger.debug(`Failed to read temp file after ${maxRetries} attempts: ${lastError.message}`);
    return {};
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

      // Save back to file dengan atomic write
      const tempWritePath = `${this.tempFilePath}.tmp`;
      await fs.writeFile(tempWritePath, JSON.stringify(logs, null, 2), "utf8");
      await fs.rename(tempWritePath, this.tempFilePath);
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
    // Gunakan mutex dengan timeout untuk mencegah hang
    const release = await this.fileMutex.acquire();
    const timeoutId = setTimeout(() => {
      logger.error("saveToDatabase mutex acquisition timeout after 30 seconds");
      release();
    }, 30000); // 30 second timeout

    try {
      // Load logs from temp file menggunakan helper function dengan retry
      const logs = await this._readLogsWithRetry();

      // Jika logs kosong, kemungkinan file tidak ada atau corrupted
      if (Object.keys(logs).length === 0) {
        logger.info("No rekap logs to save - temp file empty or not found");
        return { success: true, savedCount: 0, message: "No logs to save" };
      }

      const logsToSave = Object.values(logs);

      if (logsToSave.length === 0) {
        logger.info("No rekap logs to save - temp file empty");
        await this.cleanupTempFiles();
        return { success: true, savedCount: 0, message: "No logs to save" };
      }

      logger.info(`Saving ${logsToSave.length} rekap logs to database`);

      // Process in batches to avoid overwhelming the database
      const BATCH_SIZE = 100;
      let savedCount = 0;
      const errors = [];

      for (let i = 0; i < logsToSave.length; i += BATCH_SIZE) {
        const batch = logsToSave.slice(i, i + BATCH_SIZE);

        try {
          // Use bulkCreate with updateOnDuplicate for upsert behavior
          const result = await Promise.race([
            RekapRemote.bulkCreate(batch, {
              updateOnDuplicate: ["status", "updtime"],
              validate: true,
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Database operation timeout after 60 seconds")), 60000)
            ),
          ]);

          savedCount += result.length;
          logger.debug(`Saved batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.length} records`);
        } catch (batchError) {
          logger.error(`Error saving batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
        }
      }

      // Sync to JSON file after database operation
      try {
        await rekapRemoteStagingService.syncToJsonFile();
        logger.info("Synced rekap data to JSON file");
      } catch (syncError) {
        logger.error(`Error syncing to JSON file: ${syncError.message}`);
        errors.push(`JSON sync error: ${syncError.message}`);
      }

      // Clean up temporary files after save attempt (without mutex since we're already in mutex)
      try {
        await fs.unlink(this.tempFilePath);
        logger.info("Cleaned up rekap_remote temporary files");
      } catch (error) {
        // File doesn't exist, ignore error
        logger.debug(`Cleanup temp file: ${error.message}`);
      }

      const result = {
        success: errors.length === 0,
        savedCount: savedCount,
        totalLogs: logsToSave.length,
        errors: errors,
        message:
          errors.length === 0
            ? `Successfully saved ${savedCount} rekap logs, synced to JSON, and cleaned up temp files`
            : `Saved ${savedCount} logs with ${errors.length} batch errors`,
      };

      logger.info(`Rekap logs save result: ${result.message}`);
      return result;
    } catch (error) {
      logger.error(`Error saving rekap logs to database: ${error.message}`);
      throw error;
    } finally {
      // Selalu release mutex
      release();
    }
  }

  // Legacy methods for backward compatibility - will be removed later
  async logSuccess(kdtk, moduleName) {
    logger.warn("logSuccess is deprecated, use addToTemp instead");
  }

  async logTimeout(kdtk, moduleName, attempts = 3) {
    logger.warn("logTimeout is deprecated, use addToTemp instead");
  }

  async logError(kdtk, moduleName, errorMessage) {
    logger.warn("logError is deprecated, use addToTemp instead");
  }

  async logFailure(kdtk, moduleName, reason) {
    logger.warn("logFailure is deprecated, use addToTemp instead");
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
        message: `Deleted ${deletedCount} rekap logs and synced to JSON`
      };
    } catch (error) {
      logger.error(`Error deleting rekap logs: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new RekapRemoteService();
