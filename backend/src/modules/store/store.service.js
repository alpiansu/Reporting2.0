/**
 * Service for handling store operations using JSON file storage
 */
import fs from 'fs/promises';
import path from 'path';
import logger from '../../config/logger.js';
import syncConfig from '../../config/sync.config.js';

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
  async getAllStores(options = {}) {
    const { page = 1, limit = 10, search = "", region, city, status } = options;

    try {
      await this.ensureInitialized();

      // Filter stores based on search criteria
      let filteredStores = [...this.stores];

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

      const store = this.stores.find(s => s.id === id);

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

      return this.stores.find(s => s.storeCode === storeCode) || null;
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
   * Get stores by branch code
   * @param {string} branchCode - Branch code
   * @param {boolean} onlyInduk - If true, only return stores with notes='INDUK'
   * @returns {Array} Array of store data
   */
  async getStoresByBranch(branchCode, onlyInduk = true) {
    try {
      await this.ensureInitialized();

      let filteredStores = this.stores.filter(store => store.branch === branchCode || store.cab === branchCode);

      if (onlyInduk) {
        filteredStores = filteredStores.filter(store => store.notes === "INDUK");
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
      let storeFilter = (s) => s.storeCode === storeCode && s.notes === "INDUK";

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
            store.storeCode.toLowerCase().includes(searchLower) || 
            store.storeName.toLowerCase().includes(searchLower)
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
        branchCode: branchCode
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
        notes: storeData.notes,
        storeName: storeData.storeName,
        // Ensure branch is set from storeCode first character or from provided branch
        branch: storeData.branch || (storeData.storeCode ? storeData.storeCode.substring(0, 1) : ''),
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

      const index = this.stores.findIndex(s => s.id === id);

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
        notes: storeData.notes || this.stores[index].notes,
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

      const index = this.stores.findIndex(s => s.id === id);

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

      const { storeCode, station } = storeData;

      if (!storeCode || !station) {
        throw new Error("Store code and station are required");
      }

      // Find existing store by code and station
      const existingStore = await this.getStoreByCodeAndStation(storeCode, station);

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
}

// Export the class
export default StoreService;
