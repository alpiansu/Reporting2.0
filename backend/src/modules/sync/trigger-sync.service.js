import SyncService from './sync.service.js';
import logger from '../../config/logger.js';

class TriggerSyncService {
  /**
   * Trigger manual synchronization
   * @param {string} type - Type of sync ("store" | "dept" | "user" | "all")
   * @returns {Promise<Object>} Synchronization results
   */
  async triggerManualSync(type = "all") {
    logger.info(`Manual synchronization triggered at ${new Date().toISOString()} for type: ${type}`);

    try {
      const syncService = new SyncService();

      let result = {};
      
      if (type === "store" || type === "all") {
        const storeResult = await syncService.synchronizeStores();
        result.store = storeResult;
      }
      
      if (type === "dept" || type === "all") {
        const deptResult = await syncService.synchronizeDept();
        result.dept = deptResult;
      }
      
      if (type === "user" || type === "all") {
        const userResult = await syncService.synchronizeUsers();
        result.user = userResult;
      }
      
      // Determine overall success
      const allResults = Object.values(result);
      result.success = allResults.length > 0 && allResults.every(r => r.success);
      result.message = "All requested synchronizations completed";

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

export default TriggerSyncService;
