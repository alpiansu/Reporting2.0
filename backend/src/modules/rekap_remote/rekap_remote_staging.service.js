/**
 * Staging service for rekap_remote module
 * Handles JSON file synchronization for staging environment
 */
const fs = require("fs").promises;
const path = require("path");
const logger = require("../../config/logger");
const RekapRemote = require("../../models/rekap_remote.model");

// Path untuk file JSON rekap_remote
const REKAP_REMOTE_JSON_PATH = path.join(process.cwd(), "data/rekap_remote.json");

class RekapRemoteStagingService {
  constructor() {
    this.rekapData = [];
    this.initialized = false;
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(REKAP_REMOTE_JSON_PATH);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(REKAP_REMOTE_JSON_PATH, "utf8");
        this.rekapData = JSON.parse(data);
        logger.info(`Loaded ${this.rekapData.length} rekap_remote records from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.rekapData = [];
          await this.saveToFile();
          logger.info("Created new rekap_remote.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize rekap_remote staging service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save rekap_remote data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(REKAP_REMOTE_JSON_PATH, JSON.stringify(this.rekapData, null, 2));
      logger.debug(`Saved ${this.rekapData.length} rekap_remote records to JSON file`);
    } catch (error) {
      logger.error(`Failed to save rekap_remote to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized before performing operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Synchronize data from database to JSON file
   */
  async syncToJsonFile() {
    try {
      // Get all data from database
      const dbData = await RekapRemote.findAll();

      // Convert to plain objects
      this.rekapData = dbData.map(item => item.get({ plain: true }));

      // Save to file
      await this.saveToFile();

      logger.info(`Synchronized ${this.rekapData.length} rekap_remote records to JSON file`);
      return this.rekapData.length;
    } catch (error) {
      logger.error(`Failed to synchronize rekap_remote data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get rekap data with filters (from JSON file)
   * @param {Object} filters - Filter options
   * @param {number} limit - Limit number of records
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} Filtered rekap data
   */
  async getRekapData(filters = {}, limit = 100, offset = 0) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data from JSON file
      let filteredData = this.rekapData.filter(item => {
        // Filter by cab
        if (filters.cab && item.cab !== filters.cab) {
          return false;
        }

        // Filter by kdtk
        if (filters.kdtk && item.kdtk !== filters.kdtk) {
          return false;
        }

        // Filter by moduleName
        if (filters.moduleName && item.module_name !== filters.moduleName) {
          return false;
        }

        return true;
      });

      // Sort by updtime descending (newest first)
      filteredData.sort((a, b) => {
        const dateA = new Date(a.updtime || 0);
        const dateB = new Date(b.updtime || 0);
        return dateB - dateA;
      });

      // Apply pagination
      const total = filteredData.length;
      const paginatedData = filteredData.slice(offset, offset + limit);

      return {
        data: paginatedData,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error(`Error getting rekap data from staging: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary statistics (from JSON file)
   * @param {string} moduleName - Module name filter
   * @returns {Promise<Object>} Summary statistics
   */
  async getSummary(moduleName = null) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data by module name if provided
      let filteredData = this.rekapData;
      if (moduleName) {
        filteredData = this.rekapData.filter(item => item.module_name === moduleName);
      }

      // Calculate summary statistics
      const summary = {
        total: filteredData.length,
        byStatus: {},
        byCab: {},
        byModule: {}
      };

      // Group by status
      filteredData.forEach(item => {
        const status = item.status || 'unknown';
        summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      });

      // Group by cab
      filteredData.forEach(item => {
        const cab = item.cab || 'unknown';
        summary.byCab[cab] = (summary.byCab[cab] || 0) + 1;
      });

      // Group by module
      filteredData.forEach(item => {
        const module = item.module_name || 'unknown';
        summary.byModule[module] = (summary.byModule[module] || 0) + 1;
      });

      return summary;
    } catch (error) {
      logger.error(`Error getting summary from staging: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add or update record in database and sync to JSON
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created/updated record
   */
  async upsertRecord(data) {
    try {
      // Upsert to database
      const [record, created] = await RekapRemote.upsert(data, {
        returning: true
      });

      // Sync to JSON file after database operation
      await this.syncToJsonFile();

      logger.info(`${created ? 'Created' : 'Updated'} rekap_remote record: ${data.cab}-${data.kdtk}-${data.module_name}`);
      
      return {
        record: record.get({ plain: true }),
        created
      };
    } catch (error) {
      logger.error(`Error upserting rekap_remote record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete records from database and sync to JSON
   * @param {Object} where - Where conditions
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteRecords(where) {
    try {
      // Delete from database
      const deletedCount = await RekapRemote.destroy({ where });

      // Sync to JSON file after database operation
      await this.syncToJsonFile();

      logger.info(`Deleted ${deletedCount} rekap_remote records`);
      
      return deletedCount;
    } catch (error) {
      logger.error(`Error deleting rekap_remote records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of records (from JSON file)
   * @param {Object} filters - Filter options
   * @returns {Promise<number>} Count of records
   */
  async getCount(filters = {}) {
    try {
      // Ensure data is loaded from JSON file
      await this.ensureInitialized();

      // Filter data from JSON file
      const filteredData = this.rekapData.filter(item => {
        // Filter by cab
        if (filters.cab && item.cab !== filters.cab) {
          return false;
        }

        // Filter by kdtk
        if (filters.kdtk && item.kdtk !== filters.kdtk) {
          return false;
        }

        // Filter by moduleName
        if (filters.moduleName && item.module_name !== filters.moduleName) {
          return false;
        }

        return true;
      });

      return filteredData.length;
    } catch (error) {
      logger.error(`Error getting count from staging: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RekapRemoteStagingService();