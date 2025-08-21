/**
 * Service for scheduling synchronization tasks
 */
const cron = require("node-cron");
const SyncService = require("./sync.service");
const syncService = new SyncService();
const syncConfig = require("../../config/sync.config");
const logger = require("../../config/logger");

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
          })`
        );
      } catch (error) {
        logger.error(`Failed to schedule job: ${error.message}`);
      }
    });

    logger.info(`Scheduled ${this.jobs.length} synchronization jobs`);
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
        user: userResult
      };

      if (result.success) {
        logger.info(
          `Scheduled synchronization completed: stores (${storeResult.updated} updated, ${storeResult.created} created), ` +
            `departments (${deptResult.updated} updated, ${deptResult.created} created), ` +
            `users (${userResult.updated} updated, ${userResult.created} created)`
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

module.exports = CronScheduler;
