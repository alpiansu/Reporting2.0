/**
 * Utility functions for interacting with db_edp database
 */
const logger = require("../config/logger");

class DbEdpUtils {
  /**
   * Get store IP address
   * @param {string} storeCode - Store code
   * @param {string} cab - Branch code
   * @returns {Promise<Object>} Store information
   */
  async getStoreIp(storeCode, cab) {
    try {
      // Import storeService directly from the singleton instance
      const storeService = require("../modules/store/storeService");

      // Ensure storeService is initialized
      await storeService.ensureInitialized();

      // Get all stores and filter by store code, branch code, and notes = 'INDUK'
      const allStores = storeService.stores;
      const store = allStores.find(
        s => s.storeCode === storeCode && s.notes === "INDUK" && (s.branch === cab || s.cab === cab) // Check both branch and cab fields for compatibility
      );

      if (!store) {
        logger.warn(`Store not found or not an INDUK store for branch ${cab}: ${storeCode}`);
        return null;
      }

      logger.info(`Found INDUK store for branch ${cab}: ${storeCode} (${store.storeName}) at ${store.dbHost}`);

      return {
        dbHost: store.dbHost,
        storeName: store.storeName,
      };
    } catch (error) {
      logger.error(`Error getting store IP for branch ${cab}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new DbEdpUtils();