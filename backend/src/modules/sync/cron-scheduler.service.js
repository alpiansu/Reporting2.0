/**
 * Service for scheduling synchronization tasks
 */
import cron from "node-cron";
import SyncService from "./sync.service.js";
const syncService = new SyncService();
import syncConfig from "../../config/sync.config.js";
import logger from "../../config/logger.js";
import combinedScreeningService from "../combined-screening/combined_screening.service.js";
import moment from "moment-timezone";

class CronScheduler {
  constructor() {
    this.jobs = [];
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
   * Schedule combined screening jobs
   * Morning at 06:00 and Afternoon at 12:15
   */
  scheduleCombinedScreening() {
    // Morning schedule: 06:00
    try {
      const morningJob = cron.schedule("0 6 * * *", async () => {
        await this._runCombinedScreening("pagi");
      });
      this.jobs.push(morningJob);
      logger.info("[scheduler] Combined screening morning schedule registered at 06:00");
    } catch (error) {
      logger.error(`[scheduler] Failed to register morning combined screening: ${error.message}`);
    }

    // Afternoon schedule: 12:15
    try {
      const afternoonJob = cron.schedule("15 12 * * *", async () => {
        await this._runCombinedScreening("siang");
      });
      this.jobs.push(afternoonJob);
      logger.info("[scheduler] Combined screening afternoon schedule registered at 12:15");
    } catch (error) {
      logger.error(`[scheduler] Failed to register afternoon combined screening: ${error.message}`);
    }
  }

  /**
   * Run combined screening for a specific session
   */
  async _runCombinedScreening(sesi) {
    const periode = moment().tz("Asia/Jakarta").format("YYMM");

    logger.info(`[scheduler] Combined screening ${sesi} dimulai, periode: ${periode}`);

    try {
      await combinedScreeningService.screening({
        cabang: "All",
        periode,
        username: `scheduler_${sesi}`,
        fullName: `Auto Scheduler (${sesi})`,
        force: false, // guard remains active on scheduler runs
      });

      logger.info(`[scheduler] Combined screening ${sesi} selesai`);
    } catch (error) {
      logger.error(`[scheduler] Combined screening ${sesi} failed: ${error.message}`);
    }
  }

  /**
   * Run synchronization process
   */
  async runSynchronization() {
    try {
      const storeResult = await syncService.synchronizeStores();
      const deptResult = await syncService.synchronizeDept();
      const userResult = await syncService.synchronizeUsers();

      const result = {
        success: storeResult.success && deptResult.success && userResult.success,
        message: "All scheduled synchronizations completed",
        store: storeResult,
        dept: deptResult,
        user: userResult,
      };

      if (result.success) {
        logger.info(
          `Scheduled synchronization completed: stores (${storeResult.updated} updated, ${storeResult.created} created), ` +
            `departments (${deptResult.updated} updated, ${deptResult.created} created), ` +
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
