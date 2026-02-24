/**
 * Service for synchronizing data from external database to local JSON storage
 */
import ExternalDbService from './external-db.service.js';
import storeService from '../store/storeService.js';
import MDeptService from '../m_dept/m_dept.service.js';
import UserService from '../user/user.service.js';
import logger from '../../config/logger.js';
import syncConfig from '../../config/sync.config.js';

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

      // Run deduplication to be safe
      await storeService.deduplicateStores();

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

  /**
   * Synchronize user data from external database to local JSON storage
   * @returns {Promise<Object>} Synchronization results
   */
  async synchronizeUsers() {
    logger.info("Starting user data synchronization");

    try {
      const externalDbService = new ExternalDbService();
      const externalData = await externalDbService.fetchUserData();

      if (!externalData || externalData.length === 0) {
        logger.warn("No user data found in external database");
        return { success: false, message: "No user data found in external database", updated: 0, created: 0 };
      }

      logger.info(`Processing ${externalData.length} user records from external database`);

      const userService = new UserService();
      await userService.init();

      let updated = 0;
      let created = 0;

      for (const record of externalData) {
        let role = "user"; // default
        if (record.sub_dept && record.sub_dept.toUpperCase() === "REPORTING") {
          role = "admin";
        } else if (record.role) {
          role = record.role; // pakai role bawaan jika ada
        }

        const userData = {
          username: record.username,
          fullName: record.fullname,
          email: record.email || `${record.username}@example.com`,
          role,
        };

        // Check if user already exists by username
        const existingUser = await userService.findByCredentials(userData.username);

        if (existingUser) {
          // Update existing user (only update fullName, email, and role)
          await userService.updateUser(existingUser.id, {
            fullName: userData.fullName,
            email: userData.email,
            role: userData.role,
          });
          updated++;
        } else {
          try {
            // Create new user with default password
            await userService.createUser({
              ...userData,
              password: "123456", // Default password
              isActive: true,
            });
            created++;
          } catch (error) {
            logger.warn(`Failed to create user ${userData.username}: ${error.message}`);
          }
        }
      }

      logger.info(`User synchronization completed: ${updated} updated, ${created} created`);

      return {
        success: true,
        message: "User synchronization completed successfully",
        updated,
        created,
      };
    } catch (error) {
      logger.error(`User synchronization failed: ${error.message}`);
      return {
        success: false,
        message: `User synchronization failed: ${error.message}`,
        error: error.message,
      };
    }
  }
}

export default SyncService;
