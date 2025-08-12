/**
 * Service for manually triggering synchronization
 */
const SyncService = require('./sync.service');
const logger = require('../../config/logger');

class TriggerSyncService {
  /**
   * Trigger manual synchronization
   * @returns {Promise<Object>} Synchronization results
   */
  async triggerManualSync() {
    logger.info('Manual synchronization triggered');
    
    try {
      // Create instance of SyncService
      const syncService = new SyncService();
      
      const result = await syncService.synchronizeStores();
      
      if (result.success) {
        logger.info(`Manual synchronization completed: ${result.updated} updated, ${result.created} created`);
      } else {
        logger.error(`Manual synchronization failed: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in manual synchronization: ${error.message}`);
      return {
        success: false,
        message: `Synchronization error: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = TriggerSyncService;