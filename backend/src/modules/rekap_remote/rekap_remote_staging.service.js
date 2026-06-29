/**
 * Staging service for rekap_remote module
 * Handles JSON file synchronization for staging environment
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import RekapRemote from "../../models/rekap_remote.model.js";
import moment from "moment-timezone";
import { fileUtils } from "../../utils/index.js";

// Path untuk direktori data rekap_remote
const REKAP_REMOTE_DATA_DIR = path.join(process.cwd(), "data/rekap_remote");
const LEGACY_JSON_PATH = path.join(process.cwd(), "data/rekap_remote.json");

class RekapRemoteStagingService {
  constructor() {
    this.rekapCache = new Map(); // moduleName -> data array
    this.lastLoadTimes = new Map(); // moduleName -> timestamp
    this.isModuleLoading = new Map(); // moduleName -> loading status
    this.initialized = false;
    this.TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  async _ensureDataDir() {
    await fs.mkdir(REKAP_REMOTE_DATA_DIR, { recursive: true });
  }

  /**
   * Initialize the service by creating necessary directories
   */
  async initialize() {
    try {
      await this._ensureDataDir();

      // Handle legacy file if requested (delete it)
      try {
        await fs.access(LEGACY_JSON_PATH);
        await fs.unlink(LEGACY_JSON_PATH);
        logger.info("Deleted legacy rekap_remote.json file");
      } catch (e) {
        // File doesn't exist, ignore
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize rekap_remote staging service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper to get list of files in the data directory
   */
  async _getAvailableModules() {
    try {
      await this._ensureDataDir();
      const files = await fs.readdir(REKAP_REMOTE_DATA_DIR);
      return files
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
    } catch (error) {
      logger.error(`Failed to list available modules: ${error.message}`);
      return [];
    }
  }

  /**
   * Load a specific module data from JSON
   */
  async _loadModuleData(moduleName) {
    const filePath = path.join(REKAP_REMOTE_DATA_DIR, `${moduleName}.json`);
    try {
      const data = await fileUtils.readFileWithRetry(filePath);
      const parsedData = JSON.parse(data);
      this.rekapCache.set(moduleName, parsedData);
      this.lastLoadTimes.set(moduleName, Date.now());
      logger.info(`Loaded ${parsedData.length} records for module: ${moduleName}`);
      return parsedData;
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) {
        this.rekapCache.set(moduleName, []);
        logger.debug(`No JSON file found for module: ${moduleName}, using empty data`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Save a specific module data to JSON file
   */
  async saveToFile(moduleName) {
    if (!moduleName) throw new Error("moduleName is required for saveToFile");
    
    const filePath = path.join(REKAP_REMOTE_DATA_DIR, `${moduleName}.json`);
    const data = this.rekapCache.get(moduleName) || [];
    
    try {
      await this._ensureDataDir();
      await fileUtils.writeAtomicWithRetry(filePath, JSON.stringify(data, null, 2));
      logger.debug(`Saved ${data.length} records for module ${moduleName} to JSON file`);
    } catch (error) {
      logger.error(`Failed to save rekap_remote for module ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if cached data for a module is still valid
   */
  isCacheValid(moduleName) {
    if (!this.initialized) return false;
    
    if (moduleName) {
      const lastLoadTime = this.lastLoadTimes.get(moduleName);
      if (!lastLoadTime) return false;
      return Date.now() - lastLoadTime <= this.TTL;
    }
    
    // For global data, check if any module has been loaded recently
    return this.lastLoadTimes.size > 0;
  }

  /**
   * Invalidate cache
   */
  invalidateCache(moduleName = null) {
    if (moduleName) {
      this.rekapCache.delete(moduleName);
      this.lastLoadTimes.delete(moduleName);
    } else {
      this.rekapCache.clear();
      this.lastLoadTimes.clear();
      this.initialized = false;
    }
    logger.info(`Rekap remote cache invalidated (${moduleName || 'all'})`);
  }

  /**
   * Ensure data is loaded (specific module or all)
   */
  async ensureDataLoaded(moduleName = null) {
    if (!this.initialized) await this.initialize();

    if (moduleName) {
      if (this.isCacheValid(moduleName)) return;
      
      // Prevent concurrent loading for the same module
      if (this.isModuleLoading.get(moduleName)) {
        while (this.isModuleLoading.get(moduleName)) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
      }

      try {
        this.isModuleLoading.set(moduleName, true);
        await this._loadModuleData(moduleName);
      } finally {
        this.isModuleLoading.delete(moduleName);
      }
    } else {
      // Load all available modules if no specific module requested
      const modules = await this._getAvailableModules();
      await Promise.all(modules.map(m => this.ensureDataLoaded(m)));
    }
  }

  /**
   * Get combined data from cache (all modules)
   */
  _getCombinedData() {
    let combined = [];
    for (const [moduleName, data] of this.rekapCache.entries()) {
      combined = combined.concat(data);
    }
    return combined;
  }

  /**
   * Get data for a specific module or combined
   */
  async getModuleData(moduleName = null) {
    return this._getData(moduleName);
  }

  /**
   * Get data for a specific module or combined
   */
  async _getData(moduleName = null) {
    await this.ensureDataLoaded(moduleName);
    if (moduleName) {
      return this.rekapCache.get(moduleName) || [];
    }
    return this._getCombinedData();
  }

  /**
   * Synchronize data from database to JSON file
   */
  async syncToJsonFile(moduleName) {
    if (!moduleName) {
      logger.info(`[REKAP REMOTE] syncToJsonFile called without specific moduleName, performing full synchronization from database to ensure JSON consistency`);
      return await this.syncAllFromDatabase();
    }

    try {
      // Get data for specific module from database
      const dbData = await RekapRemote.findAll({
        where: { module_name: moduleName }
      });

      const rekapData = dbData.map(item => {
        const plain = item && typeof item.get === "function" ? item.get({ plain: true }) : item;
        
        // Format updtime to local string format (YYYY-MM-DD HH:mm:ss)
        if (plain.updtime) {
          plain.updtime = moment(plain.updtime).format("YYYY-MM-DD HH:mm:ss");
        }
        
        return plain;
      });

      this.rekapCache.set(moduleName, rekapData);
      this.lastLoadTimes.set(moduleName, Date.now());
      
      // Save to file
      await this.saveToFile(moduleName);

      logger.info(`Synchronized ${rekapData.length} records for module ${moduleName} to JSON file`);
      return rekapData.length;
    } catch (error) {
      if (error.message.includes("Database sedang tidak tersedia")) {
        logger.warn(`JSON sync skipped for ${moduleName} - database not available`);
        return 0;
      }
      logger.error(`Failed to synchronize rekap_remote data for ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform a full synchronization of all data from database to module-specific JSON files
   */
  async syncAllFromDatabase() {
    try {
      // Get model directly to avoid fallback to staging during a full re-sync
      const getRekapRemoteModel = (await import("../../models/rekap_remote.model.js")).default.getModel;
      const model = await getRekapRemoteModel();
      
      if (!model) {
        throw new Error("Database model not available for full synchronization");
      }

      // Get all data from database
      const dbData = await model.findAll();
      
      // Group by module_name
      const groupedData = new Map();
      dbData.forEach(item => {
        const plain = item && typeof item.get === "function" ? item.get({ plain: true }) : item;
        
        // Format updtime to local string format (YYYY-MM-DD HH:mm:ss)
        if (plain.updtime) {
          plain.updtime = moment(plain.updtime).format("YYYY-MM-DD HH:mm:ss");
        }

        const modName = plain.module_name || "unknown";
        if (!groupedData.has(modName)) {
           groupedData.set(modName, []);
        }
        groupedData.get(modName).push(plain);
      });

      // Clear current cache
      this.rekapCache.clear();
      this.lastLoadTimes.clear();

      // Ensure directory exists
      await this._ensureDataDir();

      // Save each group to its file
      for (const [moduleName, data] of groupedData.entries()) {
        this.rekapCache.set(moduleName, data);
        this.lastLoadTimes.set(moduleName, Date.now());
        await this.saveToFile(moduleName);
      }

      // Handle legacy file removal
      try {
        await fs.access(LEGACY_JSON_PATH);
        await fs.unlink(LEGACY_JSON_PATH);
        logger.info("Deleted legacy rekap_remote.json file during full sync");
      } catch (e) {}

      logger.info(`Full synchronization complete. Processed ${groupedData.size} modules and ${dbData.length} records.`);
      return { modulesCount: groupedData.size, recordsCount: dbData.length };
    } catch (error) {
      logger.error(`Failed to perform full synchronization: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get rekap data with filters
   */
  async getRekapData(filters = {}, limit = 100, offset = 0) {
    try {
      const data = await this._getData(filters.moduleName);

      let filteredData = data.filter(item => {
        if (filters.cab && item.cab !== filters.cab) return false;
        if (filters.kdtk && item.kdtk !== filters.kdtk) return false;
        if (filters.moduleName && item.module_name !== filters.moduleName) return false;
        return true;
      });

      filteredData.sort((a, b) => new Date(b.updtime || 0) - new Date(a.updtime || 0));

      const total = filteredData.length;
      const paginatedData = filteredData.slice(offset, offset + limit);

      return { data: paginatedData, total, limit, offset };
    } catch (error) {
      logger.error(`Error getting rekap data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(moduleName = null) {
    try {
      const data = await this._getData(moduleName);

      const summary = {
        total: data.length,
        byStatus: {},
        byCab: {},
        byModule: {},
      };

      data.forEach(item => {
        const status = item.status || "unknown";
        const cab = item.cab || "unknown";
        const module = item.module_name || "unknown";
        
        summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
        summary.byCab[cab] = (summary.byCab[cab] || 0) + 1;
        summary.byModule[module] = (summary.byModule[module] || 0) + 1;
      });

      return summary;
    } catch (error) {
      logger.error(`Error getting summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add or update record
   */
  async upsertRecord(data) {
    try {
      const [record, created] = await RekapRemote.upsert(data, { returning: true });

      logger.info(`${created ? "Created" : "Updated"} rekap_remote record: ${data.cab}-${data.kdtk}-${data.module_name}`);
      return { record: record.get({ plain: true }), created };
    } catch (error) {
      logger.error(`Error upserting rekap_remote record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete records
   */
  async deleteRecords(where) {
    try {
      // Find modules affected by deletion
      const affectedRecords = await RekapRemote.findAll({ where });
      const affectedModules = [...new Set(affectedRecords.map(r => r.module_name))];

      const deletedCount = await RekapRemote.destroy({ where });

      // Sync affected modules
      for (const moduleName of affectedModules) {
        await this.syncToJsonFile(moduleName);
      }

      logger.info(`Deleted ${deletedCount} rekap_remote records`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error deleting rekap_remote records: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of records
   */
  async getCount(filters = {}) {
    try {
      const data = await this._getData(filters.moduleName);
      const filteredData = data.filter(item => {
        if (filters.cab && item.cab !== filters.cab) return false;
        if (filters.kdtk && item.kdtk !== filters.kdtk) return false;
        if (filters.moduleName && item.module_name !== filters.moduleName) return false;
        return true;
      });
      return filteredData.length;
    } catch (error) {
      logger.error(`Error getting count: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all rekap data without pagination
   */
  async getAllRekapData(filters = {}) {
    try {
      const data = await this._getData(filters.moduleName);
      let filteredData = [];

      for (const item of data) {
        if (filters.cab && item.cab !== filters.cab) continue;
        if (filters.kdtk && item.kdtk !== filters.kdtk) continue;
        if (filters.moduleName && item.module_name !== filters.moduleName) continue;

        filteredData.push({
          cab: item.cab,
          kdtk: item.kdtk,
          module_name: item.module_name,
          status: item.status,
          updtime: item.updtime,
          message: item.message || null,
        });
      }

      filteredData.sort((a, b) => new Date(b.updtime || 0) - new Date(a.updtime || 0));
      return filteredData;
    } catch (error) {
      logger.error(`Error getting all rekap data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get last mass scan time per module and cabang
   */
  async getLastMassScan() {
    try {
      // Load all data
      await this.ensureDataLoaded();
      const allData = this._getCombinedData();

      const grouped = {};
      allData.forEach(item => {
        const key = `${item.module_name}_${item.cab}`;
        if (!grouped[key]) {
          grouped[key] = { module_name: item.module_name, cab: item.cab, records: [] };
        }
        grouped[key].records.push({
          kdtk: item.kdtk,
          updtime: new Date(item.updtime),
          status: item.status,
        });
      });

      const results = [];
      Object.values(grouped).forEach(group => {
        group.records.sort((a, b) => b.updtime - a.updtime);
        if (group.records.length === 0) return;

        const deltas = [];
        for (let i = 0; i < group.records.length - 1; i++) {
          const delta = Math.abs(group.records[i].updtime - group.records[i + 1].updtime) / 1000;
          deltas.push({ index: i, delta: delta, updtime: group.records[i].updtime });
        }

        if (deltas.length === 0) {
          results.push({
            module_name: group.module_name,
            cab: group.cab,
            last_mass_scan: group.records[0].updtime.toISOString().replace("T", " ").substring(0, 19),
            stores_count: 1,
          });
          return;
        }

        const sortedDeltas = [...deltas].sort((a, b) => a.delta - b.delta);
        const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)].delta;
        const tolerance = medianDelta * 2 || 300;

        let clusters = [];
        let currentCluster = [deltas[0]];

        for (let i = 1; i < deltas.length; i++) {
          if (Math.abs(deltas[i].delta - deltas[i - 1].delta) <= tolerance) {
            currentCluster.push(deltas[i]);
          } else {
            if (currentCluster.length > 0) clusters.push([...currentCluster]);
            currentCluster = [deltas[i]];
          }
        }
        if (currentCluster.length > 0) clusters.push(currentCluster);

        const largestCluster = clusters.reduce((max, cluster) => (cluster.length > max.length ? cluster : max), clusters[0] || []);

        if (largestCluster && largestCluster.length > 0) {
          const latestInCluster = largestCluster.reduce((latest, item) => item.updtime > latest.updtime ? item : latest);
          results.push({
            module_name: group.module_name,
            cab: group.cab,
            last_mass_scan: latestInCluster.updtime.toISOString().replace("T", " ").substring(0, 19),
            stores_count: largestCluster.length + 1,
          });
        }
      });

      const summary = {};
      results.forEach(item => {
        if (!summary[item.module_name]) {
          summary[item.module_name] = { module_name: item.module_name, last_mass_scan: item.last_mass_scan, total_stores: 0, cabangs: [] };
        }
        summary[item.module_name].cabangs.push({
          cab: item.cab,
          last_scan: moment.utc(item.last_mass_scan).utcOffset(7).format("YYYY-MM-DD HH:mm:ss"),
          stores_count: item.stores_count,
        });
        summary[item.module_name].total_stores += item.stores_count;
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
