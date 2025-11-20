/**
 * Staging service for rekap_remote module
 * Handles JSON file synchronization for staging environment
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import RekapRemote from "../../models/rekap_remote.model.js";
import moment from "moment-timezone";

// Path untuk file JSON rekap_remote
const REKAP_REMOTE_JSON_PATH = path.join(process.cwd(), "data/rekap_remote.json");

class RekapRemoteStagingService {
  constructor() {
    this.rekapData = [];
    this.initialized = false;

    // TTL Cache Management
    this.lastLoadTime = null;
    this.TTL = 60 * 60 * 1000; // 1 hour in milliseconds
    this.isLoading = false; // Prevent concurrent loading
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

      // Guard: jika file JSON tidak ada nilainya, lakukan tarik data dari database ke file json
      if (!this.rekapData || this.rekapData.length === 0) {
        logger.info("JSON file is empty, syncing from database");
        try {
          await this.syncToJsonFile();
          logger.info(`Synced ${this.rekapData.length} records from database to JSON file`);
        } catch (syncError) {
          logger.warn(`Failed to sync from database: ${syncError.message}. Using empty data.`);
          this.rekapData = [];
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
   * Check if cached data is still valid based on TTL
   * @returns {boolean} True if cache is valid, false if expired
   */
  isCacheValid() {
    if (!this.initialized || !this.lastLoadTime) {
      return false;
    }

    const now = Date.now();
    const isExpired = now - this.lastLoadTime > this.TTL;
    return !isExpired;
  }

  /**
   * Invalidate cache manually (useful when database is updated)
   */
  invalidateCache() {
    this.rekapData = [];
    this.initialized = false;
    this.lastLoadTime = null;
    this.isLoading = false;
    logger.info("Rekap remote cache invalidated manually");
  }

  /**
   * Ensure data is loaded with TTL-based lazy loading
   * Only loads data when needed and cache is expired
   */
  async ensureDataLoaded() {
    // If cache is still valid, no need to reload
    if (this.isCacheValid()) {
      return;
    }

    // Prevent concurrent loading
    if (this.isLoading) {
      // Wait for ongoing loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.isLoading = true;
      logger.info("Loading rekap remote data from JSON file (cache expired or empty)");

      await this.initialize();
      this.lastLoadTime = Date.now();

      logger.info(
        `Rekap remote data loaded successfully. TTL expires at: ${new Date(this.lastLoadTime + this.TTL).toISOString()}`
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Ensure the service is initialized before performing operations
   * @deprecated Use ensureDataLoaded() instead for TTL-based loading
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

      // Convert to plain objects - handle both Sequelize instances and plain objects
      this.rekapData = dbData.map(item => {
        // Check if item is a Sequelize model instance
        if (item && typeof item.get === "function") {
          return item.get({ plain: true });
        }
        // If it's already a plain object (from fallback), return as is
        return item;
      });
      logger.info(`Fetched ${this.rekapData.length} rekap_remote records from database`);

      // Save to file
      await this.saveToFile();

      // Update cache timestamp and mark as initialized
      this.initialized = true;
      this.lastLoadTime = Date.now();

      logger.info(
        `Synchronized ${
          this.rekapData.length
        } rekap_remote records to JSON file. Cache refreshed. TTL expires at: ${new Date(
          this.lastLoadTime + this.TTL
        ).toISOString()}`
      );
      return this.rekapData.length;
    } catch (error) {
      // Handle specific database errors gracefully
      if (error.message.includes("Database sedang tidak tersedia")) {
        logger.warn(`JSON sync skipped - database not available [REKAP REMOTE STAGING]`);
        return; // Don't throw error, just skip sync
      } else if (error.message.includes("item.get is not a function")) {
        logger.error(`JSON sync error - data format issue: ${error.message} [REKAP REMOTE STAGING]`);
        // Try to handle the data differently
        try {
          const data = await RekapRemote.findAll({ raw: true }); // Get raw data
          this.rekapData = data;
          await this.saveToFile();
          this.initialized = true;
          this.lastLoadTime = Date.now();
          logger.info(`Data synced to JSON file (raw mode): ${data.length} records [REKAP REMOTE STAGING]`);
          return data.length;
        } catch (retryError) {
          logger.error(`JSON sync retry failed: ${retryError.message} [REKAP REMOTE STAGING]`);
        }
      }

      logger.error(`Failed to synchronize rekap_remote data: ${error.message}`);
      // Don't throw error to prevent crashing the main process
      return;
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
      // Ensure data is loaded with TTL-based lazy loading
      await this.ensureDataLoaded();

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
        offset,
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
      // Ensure data is loaded with TTL-based lazy loading
      await this.ensureDataLoaded();

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
        byModule: {},
      };

      // Group by status
      filteredData.forEach(item => {
        const status = item.status || "unknown";
        summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      });

      // Group by cab
      filteredData.forEach(item => {
        const cab = item.cab || "unknown";
        summary.byCab[cab] = (summary.byCab[cab] || 0) + 1;
      });

      // Group by module
      filteredData.forEach(item => {
        const module = item.module_name || "unknown";
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
        returning: true,
      });

      // Sync to JSON file after database operation
      await this.syncToJsonFile();

      logger.info(
        `${created ? "Created" : "Updated"} rekap_remote record: ${data.cab}-${data.kdtk}-${data.module_name}`
      );

      return {
        record: record.get({ plain: true }),
        created,
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
      // Ensure data is loaded with TTL-based lazy loading
      await this.ensureDataLoaded();

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

  /**
   * Get all rekap data without pagination (for module integration)
   * @param {Object} filters - Optional filter options
   * @param {string} filters.cab - Filter by cab
   * @param {string} filters.kdtk - Filter by kdtk
   * @param {string} filters.moduleName - Filter by module_name
   * @returns {Promise<Array>} Array of rekap data (clean copy, no reference to internal data)
   */
  async getAllRekapData(filters = {}) {
    try {
      // Ensure data is loaded with TTL-based lazy loading
      await this.ensureDataLoaded();

      // Create a clean copy of data to avoid reference issues
      let filteredData = [];

      // Filter data from JSON file
      for (const item of this.rekapData) {
        // Filter by cab
        if (filters.cab && item.cab !== filters.cab) {
          continue;
        }

        // Filter by kdtk
        if (filters.kdtk && item.kdtk !== filters.kdtk) {
          continue;
        }

        // Filter by moduleName
        if (filters.moduleName && item.module_name !== filters.moduleName) {
          continue;
        }

        // Create clean copy of item to prevent reference issues
        filteredData.push({
          cab: item.cab,
          kdtk: item.kdtk,
          module_name: item.module_name,
          status: item.status,
          updtime: item.updtime,
          message: item.message || null,
        });
      }

      // Sort by updtime descending (newest first)
      filteredData.sort((a, b) => {
        const dateA = new Date(a.updtime || 0);
        const dateB = new Date(b.updtime || 0);
        return dateB - dateA;
      });

      logger.debug(`Retrieved ${filteredData.length} rekap records for module integration`);

      // Return clean array - no references to internal data
      return filteredData;
    } catch (error) {
      logger.error(`Error getting all rekap data from staging: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get last mass scan time per module and cabang
   * Detects mass scanning by finding the largest cluster of records with consistent time deltas
   * @returns {Promise<Array>} Array of last mass scan info per module per cab
   */
  async getLastMassScan() {
    try {
      await this.ensureDataLoaded();

      // Group by module_name and cab
      const grouped = {};

      this.rekapData.forEach(item => {
        const key = `${item.module_name}_${item.cab}`;
        if (!grouped[key]) {
          grouped[key] = {
            module_name: item.module_name,
            cab: item.cab,
            records: [],
          };
        }
        grouped[key].records.push({
          kdtk: item.kdtk,
          updtime: new Date(item.updtime),
          status: item.status,
        });
      });

      const results = [];

      // Process each group
      Object.values(grouped).forEach(group => {
        // Sort by updtime descending
        group.records.sort((a, b) => b.updtime - a.updtime);

        if (group.records.length === 0) return;

        // Calculate deltas between consecutive records
        const deltas = [];
        for (let i = 0; i < group.records.length - 1; i++) {
          const delta = Math.abs(group.records[i].updtime - group.records[i + 1].updtime) / 1000; // in seconds
          deltas.push({
            index: i,
            delta: delta,
            updtime: group.records[i].updtime,
          });
        }

        if (deltas.length === 0) {
          // Only 1 record, consider it as the last scan
          results.push({
            module_name: group.module_name,
            cab: group.cab,
            last_mass_scan: group.records[0].updtime.toISOString().replace("T", " ").substring(0, 19),
            stores_count: 1,
          });
          return;
        }

        // Find clusters based on similar deltas
        // Sort deltas to find the most common range
        const sortedDeltas = [...deltas].sort((a, b) => a.delta - b.delta);

        // Use median delta as reference, with tolerance
        const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)].delta;
        const tolerance = medianDelta * 2 || 300; // 2x median or max 5 minutes

        // Find largest cluster with consistent deltas
        let clusters = [];
        let currentCluster = [deltas[0]];

        for (let i = 1; i < deltas.length; i++) {
          const prevDelta = deltas[i - 1].delta;
          const currDelta = deltas[i].delta;

          // Check if current delta is consistent with cluster
          if (Math.abs(currDelta - prevDelta) <= tolerance) {
            currentCluster.push(deltas[i]);
          } else {
            // Start new cluster if current one has significant size
            if (currentCluster.length > 0) {
              clusters.push([...currentCluster]);
            }
            currentCluster = [deltas[i]];
          }
        }

        // Don't forget the last cluster
        if (currentCluster.length > 0) {
          clusters.push(currentCluster);
        }

        // Find the largest cluster
        const largestCluster = clusters.reduce(
          (max, cluster) => (cluster.length > max.length ? cluster : max),
          clusters[0] || []
        );

        if (largestCluster && largestCluster.length > 0) {
          // Get the most recent updtime from the largest cluster
          const latestInCluster = largestCluster.reduce((latest, item) =>
            item.updtime > latest.updtime ? item : latest
          );

          results.push({
            module_name: group.module_name,
            cab: group.cab,
            last_mass_scan: latestInCluster.updtime.toISOString().replace("T", " ").substring(0, 19),
            stores_count: largestCluster.length + 1, // +1 because deltas are between records
          });
        }
      });

      // Group results by module_name for summary
      const summary = {};
      results.forEach(item => {
        if (!summary[item.module_name]) {
          summary[item.module_name] = {
            module_name: item.module_name,
            last_mass_scan: item.last_mass_scan,
            total_stores: 0,
            cabangs: [],
          };
        }

        summary[item.module_name].cabangs.push({
          cab: item.cab,
          last_scan: moment.utc(item.last_mass_scan).utcOffset(7).format("YYYY-MM-DD HH:mm:ss"),
          stores_count: item.stores_count,
        });

        summary[item.module_name].total_stores += item.stores_count;

        // Update last_mass_scan to the most recent across all cabangs
        if (item.last_mass_scan > summary[item.module_name].last_mass_scan) {
          summary[item.module_name].last_mass_scan = item.last_mass_scan;
        }
      });

      return Object.values(summary);
    } catch (error) {
      logger.error(`Error getting last mass scan: ${error.message}`);
      throw error;
    }
  }
}

export default new RekapRemoteStagingService();
