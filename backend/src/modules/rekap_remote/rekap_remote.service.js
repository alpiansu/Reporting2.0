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

    // ── Akumulasi log IN-MEMORY + flush debounce ──
    // Dulu setiap addToTemp membaca + menulis ulang SELURUH file (O(n²) I/O saat
    // screening massal ribuan toko). Kini log dikumpulkan di memori dan ditulis
    // paling sering per flushDelayMs (merge dengan isi file agar data eksternal
    // tidak hilang). Trade-off: maksimal flushDelayMs log bisa hilang jika proses
    // crash di antara update & flush — masih jauh lebih aman dari file korup/race.
    this.memLogs = null; // null = belum dimuat; {} = kosong
    this.memDirty = false; // ada perubahan yang belum tertulis ke file
    this.flushTimer = null;
    this.flushDelayMs = 150; // debounce flush (150ms)
  }

  /**
   * Ambil mutex dengan hold-timeout30 detik; fungsi release yang dikembalikan
   * IDEMPOTENT — aman dipanggil dari timeout callback DAN dari finally.
   * Dulu release() dipanggil di dua tempat tanpa penanda: saat timeout PASTI
   * terjadi double-release → mutex kelepas2× → dua penulis berjalan bersamaan
   * → file log bisa korup/hilang.
   * @param {string} label - Prefix untuk pesan log
   * @returns {Promise<() => void>} release yang aman dipanggil berulang
   */
  async _acquireWithTimeout(label) {
    const release = await this.fileMutex.acquire();
    let released = false;
    let timeoutId = null;
    const safeRelease = () => {
      if (released) return;
      released = true;
      if (timeoutId) clearTimeout(timeoutId);
      release();
    };
    timeoutId = setTimeout(() => {
      logger.error(
        `${label} mutex hold timeout after 30 seconds — lock dilepas agar tidak menahan proses lain (operasi asli mungkin masih berjalan)`,
      );
      safeRelease();
    }, 30000);
    return safeRelease;
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
    const release = await this._acquireWithTimeout("[REKAP REMOTE] cleanupTempFiles");
    try {
      // Bersihkan juga akumulasi memori + timer flush
      this.memLogs = null;
      this.memDirty = false;
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      await fs.unlink(this.tempFilePath);
      logger.info("Cleaned up rekap_remote temporary files");
    } catch (error) {
      // File doesn't exist, ignore error
      logger.debug(`Cleanup temp file: ${error.message}`);
    } finally {
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
    const release = await this._acquireWithTimeout("[REKAP REMOTE] addToTemp");
    try {
      // Ensure temp directory exists (hanya saat load pertama — hemat I/O)
      if (!this.memLogs) {
        await fs.mkdir(this.tempDir, { recursive: true });
        this.memLogs = await this._readLogsWithRetry();
      }

      // Create or update log entry (IN-MEMORY — tidak menulis file per panggilan)
      const logs = this.memLogs;
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

      this.memDirty = true;
      this._scheduleFlush();
    } catch (error) {
      logger.error(`Error adding to temp file: ${error.message}`);
      throw error;
    } finally {
      release();
    }
  }

  /**
   * Jadwalkan flush debounce — dipanggil saat ada perubahan baru.
   * Satu timer untuk semua perubahan beruntun (mass logging → tulis per jeda,
   * bukan per log).
   */
  _scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushToTemp().catch(err =>
        logger.error(`[REKAP REMOTE] Flush temp log gagal: ${err.message}`),
      );
    }, this.flushDelayMs);
  }

  /**
   * Tulis akumulasi memori ke file temp secara atomic.
   * Isi file di-MERGE dulu (file sebagai base, memori menimpa — lebih baru) agar
   * perubahan eksternal tidak hilang. Dipanggil otomatis oleh debounce flush.
   */
  async flushToTemp() {
    const release = await this._acquireWithTimeout("[REKAP REMOTE] flushToTemp");
    try {
      if (!this.memDirty || !this.memLogs) return;
      const fileLogs = await this._readLogsWithRetry();
      const merged = { ...fileLogs, ...this.memLogs };
      await fs.mkdir(this.tempDir, { recursive: true });
      await this._writeAtomicWithRetry(merged);
      this.memDirty = false;
      logger.debug(`[REKAP REMOTE] Flushed ${Object.keys(merged).length} rekap logs to temp file`);
    } finally {
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
      const release = await this._acquireWithTimeout("[REKAP REMOTE] saveToDatabase");

      try {
        // Sumber kebenaran: file (sisa flush/proses lain) DI-MERGE dengan memori
        // (menimpa — lebih baru, mungkin belum sempat flush)
        const fileLogs = await this._readLogsWithRetry();
        logs = { ...fileLogs, ...(this.memLogs || {}) };

        if (Object.keys(logs).length > 0) {
          logsToSave = Object.values(logs);
          updatedModules = [...new Set(logsToSave.map(log => log.module_name).filter(m => !!m))];
          // Ambil alih & kosongkan memori + batalkan flush yang tertunda
          // (konsisten dengan perilaku lama: file langsung di-unlink)
          this.memLogs = {};
          this.memDirty = false;
          if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
          }
          // Hapus file sementara agar tidak terbaca ganda
          try {
            await fs.unlink(this.tempFilePath);
            logger.info("Checked and unlinked rekap_remote temporary files [REKAP REMOTE]");
          } catch (unlinkError) {
            if (unlinkError.code !== "ENOENT") {
              logger.error(`Error during rekap file extraction: ${unlinkError.message}`);
            }
          }
        }
      } catch (error) {
        if (error.code !== "ENOENT") {
          logger.error(`Error during rekap file extraction: ${error.message}`);
        }
      } finally {
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
                await Promise.race([
                  resilientDb.forceReconnect(),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("forceReconnect timeout after 15 seconds")), 15000)
                  ),
                ]);
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
                await Promise.race([
                  resilientDb.forceReconnect(),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("forceReconnect timeout after 15 seconds")), 15000)
                  ),
                ]);
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
