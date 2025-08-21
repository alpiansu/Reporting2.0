/**
 * Service for synchronizing data from external database to local JSON storage
 */
const ExternalDbService = require("./external-db.service");
const storeService = require("../store/storeService");
const MDeptService = require("../m_dept/m_dept.service");
const logger = require("../../config/logger");
const syncConfig = require("../../config/sync.config");

class SyncService {
  /**
   * Synchronize store data from external database to local JSON storage
   * @returns {Promise<Object>} Synchronization results
   */
  async synchronizeStores() {
    logger.info("Starting store data synchronization");

    try {
      // Create instance of external DB service
      const externalDbService = new ExternalDbService();

      // Fetch data from external database
      const externalData = await externalDbService.fetchStoreData();

      if (!externalData || externalData.length === 0) {
        logger.warn("No data found in external database");
        return { success: false, message: "No data found in external database", updated: 0, created: 0 };
      }

      logger.info(`Processing ${externalData.length} records from external database`);

      // Get field mappings from config
      const {
        storeCode: storeCodeField,
        station: stationField,
        ipAddress: ipAddressField,
        type: typeField,
      } = syncConfig.externalDbEDP.fields;

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
          storeName: record["NAMATK"] || `${record[storeCodeField]} - ${record[stationField]}`,
          // Use cab field from query or extract from storeCode
          branch: record["Cab"],
          updtime: new Date().toISOString(),
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
        created,
      };
    } catch (error) {
      logger.error(`Synchronization failed: ${error.message}`);
      return {
        success: false,
        message: `Synchronization failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Synchronize department data from external database to local JSON storage
   * @returns {Promise<Object>} Synchronization results
   */
  async synchronizeDept() {
    logger.info("Starting department data synchronization");

    try {
      const externalDbService = new ExternalDbService();
      const externalData = await externalDbService.fetchDeptData();

      if (!externalData || externalData.length === 0) {
        logger.warn("No department data found in external database");
        return { success: false, message: "No data found in external database", updated: 0, created: 0 };
      }

      logger.info(`Processing ${externalData.length} department records from external database`);

      const mDeptService = new MDeptService();
      let updated = 0;
      let created = 0;

      for (const record of externalData) {
        const deptData = {
          dep_kd: record.dep_kd,
          dep_nm: record.dep_nm,
          div_kd: record.div_kd,
          dep_mgr: record.dep_mgr || "",
        };

        const existingDept = await mDeptService.getDepartmentByCode(deptData.dep_kd);

        if (existingDept) {
          await mDeptService.updateDepartment(deptData.dep_kd, deptData);
          updated++;
        } else {
          await mDeptService.createDepartment(deptData);
          created++;
        }
      }

      logger.info(`Department synchronization completed: ${updated} updated, ${created} created`);

      return {
        success: true,
        message: "Department synchronization completed successfully",
        updated,
        created,
      };
    } catch (error) {
      logger.error(`Department synchronization failed: ${error.message}`);
      return {
        success: false,
        message: `Synchronization failed: ${error.message}`,
        error: error.message,
      };
    }
  }
}

module.exports = SyncService;
