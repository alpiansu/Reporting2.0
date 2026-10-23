/**
 * Service for scheduling synchronization tasks
 */
import cron from "node-cron";
import SyncService from "./sync.service.js";
const syncService = new SyncService();
import syncConfig from "../../config/sync.config.js";
import logger from "../../config/logger.js";
import combinedScreeningService from "../combined-screening/combined_screening.service.js";
import combinedConfig from "../combined-screening/combined_screening.config.js";
import StoreSyncService from "../store/store-sync.service.js";
import moment from "moment-timezone";

class CronScheduler {
  constructor() {
    this.jobs = [];
    this.storeSyncService = new StoreSyncService();
  }

  /**
   * Initialize the scheduler
   * Alias for initialize() for compatibility with server.js
   */
  async init() {
    this.initialize();
    return true;
  }

  /**
   * Initialize and start all scheduled jobs
   */
  initialize() {
    logger.info("Initializing synchronization scheduler");

    // Clear any existing jobs
    this.stopAll();

    // Schedule jobs based on configuration
    this.scheduleJobs();

    // Schedule combined screening
    this.scheduleCombinedScreening();

    // Schedule daily store monitoring sync (toko buka, tutup, TS, takeover)
    this.scheduleStoreMonitoringSync();
  }

  /**
   * Schedule synchronization jobs based on configuration
   */
  scheduleJobs() {
    const { schedules } = syncConfig;

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      logger.warn("No synchronization schedules configured");
      return;
    }

    schedules.forEach((schedule, index) => {
      const { hour, minute, description } = schedule;

      // Validate schedule
      if (hour === undefined || minute === undefined) {
        logger.warn(`Invalid schedule at index ${index}: hour and minute must be specified`);
        return;
      }

      // Create cron expression
      const cronExpression = `${minute} ${hour} * * *`;

      // Schedule job
      try {
        const job = cron.schedule(cronExpression, async () => {
          logger.info(`Running scheduled synchronization: ${description || "Unnamed schedule"}`);
          await this.runSynchronization();
        });

        this.jobs.push(job);

        logger.info(
          `Scheduled synchronization at ${hour}:${minute < 10 ? "0" + minute : minute} (${
            description || "Unnamed schedule"
          })`,
        );
      } catch (error) {
        logger.error(`Failed to schedule job: ${error.message}`);
      }
    });

    logger.info(`Scheduled ${this.jobs.length} synchronization jobs`);
  }

  /**
   * Schedule combined screening jobs based on schedules config.
   * Each schedule = 1 cron job → screening({ modules: schedule.modules }).
   * Modules run sequentially per store using 1 shared connection.
   */
  scheduleCombinedScreening() {
    const { schedules } = combinedConfig;

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      logger.warn("[scheduler] No combined screening schedules configured");
      return;
    }

    schedules.filter(s => s.enabled !== false).forEach((schedule) => {
      const [hour, minute] = schedule.time.split(":");
      if (hour === undefined || minute === undefined) {
        logger.warn(`[scheduler] Invalid schedule time: ${schedule.time} — skipping`);
        return;
      }

      const cronExp = `${minute} ${hour} * * *`;

      try {
        const job = cron.schedule(cronExp, async () => {
          await this._runScheduledScreening(schedule);
        });

        this.jobs.push(job);
        logger.info(
          `[scheduler] Combined screening "${schedule.description || schedule.time}" registered at ${schedule.time} — modules: [${schedule.modules.join(", ")}]`,
        );
      } catch (error) {
        logger.error(`[scheduler] Failed to register schedule "${schedule.description}": ${error.message}`);
      }
    });

    const csCount = schedules.filter(s => s.enabled !== false).length;
    logger.info(`[scheduler] Registered ${csCount} combined screening schedule(s)`);
  }

  /**
   * Schedule daily store monitoring synchronization (toko buka, tutup, TS, takeover).
   * Default: 05:00 WIB (Asia/Jakarta) setiap hari.
   */
  scheduleStoreMonitoringSync() {
    const config = syncConfig.storeMonitoring || {
      enabled: true,
      time: "05:00",
      timezone: "Asia/Jakarta",
      description: "Daily store monitoring sync (WRC to store-monitoring.json)",
    };

    if (config.enabled === false) {
      logger.info("[scheduler] Store monitoring sync is disabled in configuration");
      return;
    }

    const [hour, minute] = (config.time || "05:00").split(":");
    if (hour === undefined || minute === undefined) {
      logger.warn(`[scheduler] Invalid store monitoring schedule time: ${config.time} — skipping`);
      return;
    }

    const cronExp = `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
    const timezone = config.timezone || "Asia/Jakarta";

    try {
      const job = cron.schedule(
        cronExp,
        async () => {
          logger.info(`[scheduler] Menjalankan sinkronisasi otomatis monitoring toko (${config.description || config.time})...`);
          await this._runScheduledStoreMonitoring();
        },
        {
          timezone,
        }
      );

      this.jobs.push(job);
      logger.info(`[scheduler] Store monitoring sync registered at ${config.time} (${timezone})`);
    } catch (error) {
      logger.error(`[scheduler] Failed to register store monitoring sync schedule: ${error.message}`);
    }
  }

  /**
   * Execute scheduled store monitoring synchronization
   */
  async _runScheduledStoreMonitoring() {
    const startTime = Date.now();
    try {
      const result = await this.storeSyncService.syncStoreMonitoring({
        user: {
          username: "system_cron",
          fullName: "Auto Scheduler (05:00 WIB)",
        },
      });

      const durationSec = Math.round((Date.now() - startTime) / 1000);
      const totalCab = result?.metadata?.totalCabang || 0;
      const successCab = result?.metadata?.successfulCabang || 0;
      const failedCab = result?.metadata?.failedCabang || 0;

      logger.info(
        `[scheduler] Store monitoring sync selesai dalam ${durationSec}s. Cabang: ${successCab}/${totalCab} sukses${
          failedCab > 0 ? `, ${failedCab} gagal` : ""
        }. Total: ${result?.summary?.totalAkanBuka || 0} akan buka, ${result?.summary?.totalTutupSementara || 0} TS, ${
          result?.summary?.totalSudahTutup || 0
        } sudah tutup.`,
      );
    } catch (error) {
      logger.error(`[scheduler] Store monitoring sync failed: ${error.message}`);
    }
  }

  /**
   * Run combined screening for a specific schedule
   */
  async _runScheduledScreening(schedule) {
    const periode = moment().tz("Asia/Jakarta").format("YYMM");
    const label = schedule.description || schedule.time;

    logger.info(`[scheduler] Combined screening "${label}" dimulai, periode: ${periode}, modules: [${schedule.modules.join(", ")}]`);

    try {
      await combinedScreeningService.screening({
        cabang: "All",
        periode,
        username: `scheduler_${schedule.time.replace(":", "")}`,
        fullName: `Auto Scheduler (${label})`,
        force: false, // guard remains active on scheduler runs
        modules: schedule.modules, // only run modules in this schedule
      });

      logger.info(`[scheduler] Combined screening "${label}" selesai`);
    } catch (error) {
      logger.error(`[scheduler] Combined screening "${label}" failed: ${error.message}`);
    }
  }

  /**
   * Run synchronization process
   */
  async runSynchronization() {
    try {
      // SEMENTARA DINONAKTIFKAN: sync store lama (db_edp.rekap_ip -> stores.json) dihentikan
      // hingga Sync Master baru (TOKOMAIN.ini + WRC) final. User & dept tetap jalan.
      const deptResult = await syncService.synchronizeDept();
      const userResult = await syncService.synchronizeUsers();

      const result = {
        success: deptResult.success && userResult.success,
        message: "All scheduled synchronizations completed",
        dept: deptResult,
        user: userResult,
      };

      if (result.success) {
        logger.info(
          `Scheduled synchronization completed: departments (${deptResult.updated} updated, ${deptResult.created} created), ` +
            `users (${userResult.updated} updated, ${userResult.created} created)`,
        );
      } else {
        logger.error(`Scheduled synchronization failed: ${result.message}`);
      }

      return result;
    } catch (error) {
      logger.error(`Error in scheduled synchronization: ${error.message}`);
      return {
        success: false,
        message: `Synchronization error: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    logger.info("All synchronization jobs stopped");
  }
}

export default CronScheduler;
