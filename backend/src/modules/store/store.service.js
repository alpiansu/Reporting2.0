/**
 * Service for handling store operations using JSON file storage
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import syncConfig from "../../config/sync.config.js";
import wrcUtils from "../../utils/wrc.utils.js";

class StoreService {
  constructor() {
    // Get the absolute path to the JSON file
    this.filePath = path.join(process.cwd(), syncConfig.localStore.filePath);
    this.stores = [];
    this.initialized = false;
  }

  /**
   * Initialize the service
   * Alias for initialize() for compatibility with server.js
   */
  async init() {
    return this.initialize();
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(this.filePath, "utf8");
        this.stores = JSON.parse(data);
        logger.info(`Loaded ${this.stores.length} stores from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.stores = [];
          await this.saveToFile();
          logger.info("Created new stores.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize store service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save stores data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.stores, null, 2));
      // logger.info(`Saved ${this.stores.length} stores to JSON file`);
    } catch (error) {
      logger.error(`Failed to save stores to file: ${error.message}`);
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
   * Get all stores with pagination
   * @param {Object} options - Query options
   * @returns {Object} Paginated stores
   */
  /**
   * Get all stores with pagination
   * @param {Object} options - Query options
   * @returns {Object} Paginated stores
   */
  async getAllStores(options = {}) {
    const { page = 1, limit = 10, search = "", region, city, status } = options;

    try {
      await this.ensureInitialized();

      // Filter stores based on search criteria
      let filteredStores = [...this.stores];

      filteredStores = filteredStores.filter(store => store.notes === "INDUK");

      if (search) {
        const searchLower = search.toLowerCase();
        filteredStores = filteredStores.filter(
          store =>
            store.storeCode.toLowerCase().includes(searchLower) || store.storeName.toLowerCase().includes(searchLower)
        );
      }

      if (region) {
        filteredStores = filteredStores.filter(store => store.region === region);
      }

      if (city) {
        filteredStores = filteredStores.filter(store => store.city === city);
      }

      if (status) {
        const isActive = status === "active";
        filteredStores = filteredStores.filter(store => store.isActive === isActive);
      }

      // Hapus duplikat berdasarkan storeCode (ambil yang terbaru berdasarkan updatedAt)
      const uniqueStoresMap = new Map();
      for (const store of filteredStores) {
        const existing = uniqueStoresMap.get(store.storeCode);
        if (!existing || new Date(store.updatedAt) > new Date(existing.updatedAt)) {
          uniqueStoresMap.set(store.storeCode, store);
        }
      }
      filteredStores = Array.from(uniqueStoresMap.values());

      // Sort by updatedAt in descending order
      filteredStores.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Pastikan page & limit numerik
      const currentPage = Number(page) || 1;
      const itemsPerPage = Number(limit) || 10;
      const totalItems = filteredStores.length;

      // Apply pagination
      const offset = (currentPage - 1) * itemsPerPage;
      const paginatedStores = filteredStores.slice(offset, offset + itemsPerPage);

      // Hitung start & end item
      const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
      const endItem = totalItems === 0 ? 0 : Math.min(currentPage * itemsPerPage, totalItems);

      return {
        stores: paginatedStores,
        totalItems,
        totalPages: Math.ceil(totalItems / itemsPerPage),
        currentPage,
        itemsPerPage,
        startItem,
        endItem,
      };
    } catch (error) {
      logger.error(`Failed to get stores: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get store by ID
   * @param {number} id - Store ID
   * @returns {Object} Store data
   */
  async getStoreById(id) {
    try {
      await this.ensureInitialized();

      const numericId = Number(id);
      const store = this.stores.find(s => Number(s.id) === numericId);

      if (!store) {
        throw new Error("Store not found");
      }

      return store;
    } catch (error) {
      logger.error(`Failed to get store by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get store by store code
   * @param {string} storeCode - Store code
   * @returns {Object} Store data or null if not found
   */
  async getStoreByCode(storeCode) {
    try {
      await this.ensureInitialized();

      // Return the first INDUK store found for this code
      return this.stores.find(s => s.storeCode === storeCode && s.notes === "INDUK") || null;
    } catch (error) {
      logger.error(`Failed to get store by code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get store by store code and station
   * @param {string} storeCode - Store code
   * @param {string} station - Station name
   * @returns {Object} Store data or null if not found
   */
  async getStoreByCodeAndStation(storeCode, station) {
    try {
      await this.ensureInitialized();

      return this.stores.find(s => s.storeCode === storeCode && s.station === station) || null;
    } catch (error) {
      logger.error(`Failed to get store by code and station: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate stores against WRC master toko table
   * @param {Array} stores - Array of stores to validate
   * @param {string} branchCode - Branch code
   * @param {string} period - Period in YYMM format
   * @returns {Array} Array of validated stores (only active stores from WRC)
   */
  async validateStoresFromWRC(stores, branchCode, period) {
    try {
      if (!stores || stores.length === 0) {
        return [];
      }

      // Build query to get active stores from mstr_toko
      const query = `
      SELECT KodeToko, NamaToko, TokoTutup 
      FROM mstr_toko_${period} 
      WHERE KodeToko IN (${stores.map(s => `'${s.storeCode}'`).join(", ")})
    `;

      logger.info(`Validating ${stores.length} stores against WRC mstr_toko_${period}...`);

      // Get data from WRC (without date placeholder)
      const tempFile = await wrcUtils.getWrcData(
        branchCode,
        period,
        "mstr_toko",
        query,
        null // no shop filter needed
      );

      if (!tempFile) {
        logger.warn(`No WRC validation data found for branch ${branchCode}, returning original stores`);
        return stores;
      }

      // Read the result file
      const fileContent = await fs.readFile(tempFile, "utf8");
      const wrcStores = JSON.parse(fileContent);

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      // Create a Map of active stores from WRC
      const activeStoresMap = new Map();
      wrcStores.forEach(wrcStore => {
        // Store is active if TokoTutup is not '1' or is null/empty
        const isActive = wrcStore.TokoTutup !== "1";
        if (isActive) {
          activeStoresMap.set(wrcStore.KodeToko, {
            wrcName: wrcStore.NamaToko,
            tokoTutup: wrcStore.TokoTutup,
          });
        }
      });

      logger.info(`Found ${activeStoresMap.size} active stores in WRC out of ${stores.length} stores`);

      // Filter stores to only include those that exist and are active in WRC
      const validatedStores = stores.filter(store => {
        const isInWRC = activeStoresMap.has(store.storeCode);

        if (!isInWRC) {
          logger.debug(
            `Store ${store.storeCode} (${store.storeName}) not found or inactive in WRC mstr_toko_${period}`
          );
        }

        return isInWRC;
      });

      // Optional: Add WRC validation info to each store
      validatedStores.forEach(store => {
        const wrcData = activeStoresMap.get(store.storeCode);
        store.wrcValidated = true;
        store.wrcStoreName = wrcData.wrcName;
        store.validatedAt = new Date().toISOString();
      });

      logger.info(
        `Validated: ${validatedStores.length} active stores, ${
          stores.length - validatedStores.length
        } stores filtered out`
      );

      return validatedStores;
    } catch (error) {
      logger.error(`Error validating stores from WRC: ${error.message}`);
      // If validation fails, return original stores to avoid breaking the flow
      logger.warn(`Returning original stores without WRC validation`);
      return stores;
    }
  }

  /**
   * Get stores by branch code with WRC validation
   * @param {string} branchCode - Branch code
   * @param {boolean} onlyInduk - If true, only return stores with notes='INDUK'
   * @param {Object} options - Additional options
   * @param {boolean} options.validateWRC - If true, validate stores against WRC mstr_toko (default: false)
   * @param {string} options.period - Period in YYMM format (required if validateWRC is true)
   * @returns {Array} Array of store data
   */
  async getStoresByBranch(branchCode, onlyInduk = true, options = {}) {
    try {
      await this.ensureInitialized();

      let filteredStores = this.stores.filter(store => store.branch === branchCode || store.cab === branchCode);

      if (options.storeCode) {
        const storeCodes = Array.isArray(options.storeCode)
          ? options.storeCode.map(code => code.trim().toUpperCase())
          : [String(options.storeCode).trim().toUpperCase()];

        filteredStores = filteredStores.filter(store => {
          const code = (store.storeCode || store.kdtk || "").toUpperCase();
          const isMatch = storeCodes.includes(code);
          const isInduk = store.notes === "INDUK";
          return isMatch && isInduk;
        });
      } else if (!options.storeCode && onlyInduk) {
        filteredStores = filteredStores.filter(store => store.notes === "INDUK");
      }

      // WRC Validation: Check if stores are still active in mstr_toko
      if (options.validateWRC && options.period) {
        filteredStores = await this.validateStoresFromWRC(filteredStores, branchCode, options.period);
      }

      // Jika options.limit dikirim, batasi jumlah hasil
      if (options.limit && Number.isInteger(options.limit) && options.limit > 0) {
        filteredStores = filteredStores.slice(0, options.limit);
      }

      return filteredStores;
    } catch (error) {
      logger.error(`Failed to get stores by branch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get store IP and host information for a specific store code
   * @param {string} storeCode - Store code
   * @param {string} cab - Branch code (optional)
   * @returns {Promise<Object>} Store information with dbHost and storeName
   */
  async getStoreIPHost(storeCode) {
    try {
      await this.ensureInitialized();

      // Create filter conditions
      let storeFilter = s => s.storeCode === storeCode && s.notes === "INDUK";

      // Find the store
      const store = this.stores.find(storeFilter);

      if (!store) {
        logger.warn(`Store not found or not an INDUK store ${storeCode}`);
        return null;
      }

      return {
        dbHost: store.dbHost,
        storeName: store.storeName,
      };
    } catch (error) {
      logger.error(`Error getting store IP for store ${storeCode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get stores by branch with pagination
   * @param {string} branchCode - Branch code
   * @param {Object} options - Query options
   * @returns {Object} Paginated stores by branch
   */
  async getStoresByBranchPaginated(branchCode, options = {}) {
    const { page = 1, limit = 10, search = "", onlyInduk = true, status } = options;

    try {
      await this.ensureInitialized();

      // Filter stores by branch
      let filteredStores = this.stores.filter(store => store.branch === branchCode || store.cab === branchCode);

      // Filter by induk if specified
      if (onlyInduk) {
        filteredStores = filteredStores.filter(store => store.notes === "INDUK");
      }

      // Filter by search term
      if (search) {
        const searchLower = search.toLowerCase();
        filteredStores = filteredStores.filter(
          store =>
            store.storeCode.toLowerCase().includes(searchLower) || store.storeName.toLowerCase().includes(searchLower)
        );
      }

      // Filter by status
      if (status) {
        const isActive = status === "active";
        filteredStores = filteredStores.filter(store => store.isActive === isActive);
      }

      // Sort by updatedAt in descending order
      filteredStores.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Apply pagination
      const offset = (page - 1) * limit;
      const paginatedStores = filteredStores.slice(offset, offset + limit);

      return {
        stores: paginatedStores,
        totalItems: filteredStores.length,
        totalPages: Math.ceil(filteredStores.length / limit),
        currentPage: page,
        branchCode: branchCode,
      };
    } catch (error) {
      logger.error(`Failed to get stores by branch with pagination: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new store
   * @param {Object} storeData - Store data
   * @returns {Object} Created store
   */
  async createStore(storeData) {
    try {
      await this.ensureInitialized();

      // Generate a new ID
      const newId = this.stores.length > 0 ? Math.max(...this.stores.map(s => s.id)) + 1 : 1;

      // Create store with timestamps and only required fields
      const now = new Date().toISOString();
      const store = {
        id: newId,
        storeCode: storeData.storeCode,
        station: storeData.station,
        dbHost: storeData.dbHost,
        notes: storeData.notes.toUpperCase(),
        storeName: storeData.storeName,
        // Ensure branch is set from storeCode first character or from provided branch
        branch: storeData.branch || (storeData.storeCode ? storeData.storeCode.substring(0, 1) : ""),
        updtime: storeData.updtime || now,
        createdAt: now,
        updatedAt: now,
      };

      // Add to stores array
      this.stores.push(store);

      // Save to file
      await this.saveToFile();

      // logger.info(`New store created: ${store.storeName} (${store.storeCode})`);

      return store;
    } catch (error) {
      logger.error(`Failed to create store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update store data
   * @param {number} id - Store ID
   * @param {Object} storeData - Updated store data
   * @returns {Object} Updated store
   */
  async updateStore(id, storeData) {
    try {
      await this.ensureInitialized();

      // Normalize id ke number untuk memastikan tipe data konsisten
      const numericId = Number(id);

      if (isNaN(numericId)) {
        throw new Error("Invalid store ID");
      }

      const index = this.stores.findIndex(s => Number(s.id) === numericId);

      if (index === -1) {
        throw new Error("Store not found");
      }

      // Update store data with only required fields
      const now = new Date().toISOString();
      const updatedStore = {
        ...this.stores[index],
        storeCode: storeData.storeCode || this.stores[index].storeCode,
        station: storeData.station || this.stores[index].station,
        dbHost: storeData.dbHost || this.stores[index].dbHost,
        notes: (storeData.notes || this.stores[index].notes)?.toUpperCase(),
        storeName: storeData.storeName || this.stores[index].storeName,
        // Ensure branch is updated from cab if provided
        branch: storeData.branch || this.stores[index].branch,
        updtime: storeData.updtime || now,
        updatedAt: now,
      };

      // Remove unnecessary fields if they exist
      delete updatedStore.dbUser;
      delete updatedStore.dbPassword;
      delete updatedStore.dbName;
      delete updatedStore.dbPort;
      delete updatedStore.isActive;
      delete updatedStore.cab; // Remove cab field as we use branch instead

      this.stores[index] = updatedStore;

      // Save to file
      await this.saveToFile();

      // logger.info(`Store updated: ${updatedStore.storeName} (${updatedStore.storeCode})`);

      return updatedStore;
    } catch (error) {
      logger.error(`Failed to update store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a store
   * @param {number} id - Store ID
   * @returns {boolean} Success status
   */
  async deleteStore(id) {
    try {
      await this.ensureInitialized();

      const numericId = Number(id);
      const index = this.stores.findIndex(s => Number(s.id) === numericId);

      if (index === -1) {
        throw new Error("Store not found");
      }

      const deletedStore = this.stores[index];

      // Remove from stores array
      this.stores.splice(index, 1);

      // Save to file
      await this.saveToFile();

      logger.info(`Store deleted: ${deletedStore.storeName} (${deletedStore.storeCode})`);

      return true;
    } catch (error) {
      logger.error(`Failed to delete store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update or create a store based on store code and station
   * @param {Object} storeData - Store data with storeCode and station
   * @returns {Object} Updated or created store
   */
  async upsertStore(storeData) {
    try {
      await this.ensureInitialized();

      const { storeCode, station, notes } = storeData;

      if (!storeCode || !station) {
        throw new Error("Store code and station are required");
      }

      const isInduk = notes === "INDUK";
      let existingStore = null;

      if (isInduk) {
        // For INDUK, we only allow ONE per storeCode regardless of station name
        existingStore = await this.getStoreByCode(storeCode);
      } else {
        // For STB or others, check by both code and station
        existingStore = await this.getStoreByCodeAndStation(storeCode, station);
      }

      if (existingStore) {
        // Update existing store
        return this.updateStore(existingStore.id, storeData);
      } else {
        // Create new store
        return this.createStore(storeData);
      }
    } catch (error) {
      logger.error(`Failed to upsert store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove duplicate entries from stores.json
   * Keeps the most recently updated entry for each storeCode + notes combination
   * @returns {Object} Cleanup results
   */
  async deduplicateStores() {
    try {
      await this.ensureInitialized();
      const initialCount = this.stores.length;

      // Group by storeCode and notes
      const uniqueMap = new Map();
      const duplicatesToRemove = [];

      // Sort by updatedAt descending to keep the latest one easily
      const sortedStores = [...this.stores].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.updtime || 0);
        const dateB = new Date(b.updatedAt || b.updtime || 0);
        return dateB - dateA;
      });

      const cleanedStores = [];
      const seen = new Set();

      for (const store of sortedStores) {
        const key = `${store.storeCode}_${store.notes}`;
        if (!seen.has(key)) {
          seen.add(key);
          cleanedStores.push(store);
        } else {
          duplicatesToRemove.push(store);
        }
      }

      // Restore original internal ID sorting if preferred, or keep as is
      this.stores = cleanedStores.sort((a, b) => a.id - b.id);

      await this.saveToFile();

      const removedCount = initialCount - this.stores.length;
      logger.info(`Deduplication completed: Removed ${removedCount} duplicate stores.`);

      return {
        success: true,
        initialCount,
        currentCount: this.stores.length,
        removedCount
      };
    } catch (error) {
      logger.error(`Failed to deduplicate stores: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get stores by array of store codes
   * @param {string[]} storeCodes - Array of store codes
   * @param {boolean} onlyInduk - If true, only return stores with notes='INDUK'
   * @returns {Array} Array of store data
   */
  async getStoresByCodes(storeCodes) {
    try {
      await this.ensureInitialized();

      let filteredStores = this.stores.filter(store => storeCodes.includes(store.storeCode) && store.notes === "INDUK");

      return filteredStores;
    } catch (error) {
      logger.error(`Failed to get stores by codes: ${error.message}`);
      throw error;
    }
  }
}

// Export the class
export default StoreService;
