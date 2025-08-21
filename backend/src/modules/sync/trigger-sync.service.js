const SyncService = require("./sync.service");
const logger = require("../../config/logger");

class TriggerSyncService {
  /**
   * Trigger manual synchronization
   * @param {string} type - Type of sync ("store" | "dept" | "all")
   * @returns {Promise<Object>} Synchronization results
   */
  async triggerManualSync() {
    logger.info(`Manual synchronization triggered for: ${type}`);

    try {
      const syncService = new SyncService();

      let result = {};
      const storeResult = await syncService.synchronizeStores();
      const deptResult = await syncService.synchronizeDept();
      result = {
        success: storeResult.success && deptResult.success,
        message: "All synchronizations completed",
        store: storeResult,
        dept: deptResult,
      };

      if (result.success) {
        logger.info(`Manual synchronization completed: ${JSON.stringify(result)}`);
      } else {
        logger.error(`Manual synchronization failed: ${result.message}`);
      }

      return result;
    } catch (error) {
      logger.error(`Error in manual synchronization: ${error.message}`);
      return {
        success: false,
        message: `Synchronization error: ${error.message}`,
        error: error.message,
      };
    }
  }
}

module.exports = TriggerSyncService;
