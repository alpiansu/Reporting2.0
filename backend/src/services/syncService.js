/**
 * Service for synchronizing data from external database to local JSON storage
 */
const externalDbService = require('./externalDb');
const storeService = require('./storeService');
const logger = require('../config/logger');
const syncConfig = require('../config/sync.config');

class SyncService {
  /**
   * Synchronize store data from external database to local JSON storage
   * @returns {Promise<Object>} Synchronization results
   */
  async synchronizeStores() {
    logger.info('Starting store data synchronization');
    
    try {
      // Fetch data from external database
      const externalData = await externalDbService.fetchStoreData();
      
      if (!externalData || externalData.length === 0) {
        logger.warn('No data found in external database');
        return { success: false, message: 'No data found in external database', updated: 0, created: 0 };
      }
      
      logger.info(`Processing ${externalData.length} records from external database`);
      
      // Get field mappings from config
      const { storeCode: storeCodeField, station: stationField, ipAddress: ipAddressField, type: typeField } = syncConfig.externalDb.fields;
      
      // Process each record
      let updated = 0;
      let created = 0;
      
      for (const record of externalData) {
        // Extract and map fields from external data
        const storeData = {
          storeCode: record[storeCodeField],
          station: record[stationField],
          dbHost: record[ipAddressField],
          notes: record[typeField],
          // Use store name from the joined query result
          storeName: record['NAMATK'] || `${record[storeCodeField]} - ${record[stationField]}`,
          updtime: new Date().toISOString()
        };
        
        // Check if store already exists
        const existingStore = await storeService.getStoreByCodeAndStation(storeData.storeCode, storeData.station);
        
        if (existingStore) {
          // Update existing store
          await storeService.updateStore(existingStore.id, storeData);
          updated++;
        } else {
          // Create new store
          await storeService.createStore(storeData);
          created++;
        }
      }
      
      logger.info(`Synchronization completed: ${updated} records updated, ${created} records created`);
      
      return {
        success: true,
        message: `Synchronization completed successfully`,
        updated,
        created
      };
    } catch (error) {
      logger.error(`Synchronization failed: ${error.message}`);
      return {
        success: false,
        message: `Synchronization failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = new SyncService();