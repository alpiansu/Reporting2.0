/**
 * Service for handling store operations using JSON file storage
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import syncConfig from "../../config/sync.config.js";
import wrcUtils from "../../utils/wrc.utils.js";

const TOKOMAIN_SNAPSHOT_PATH = path.join(process.cwd(), "data/tokomain-snapshot.json");
const MASTER_CSV_SNAPSHOT_PATH = path.join(process.cwd(), "data/master-tokomain-csv-snapshot.json");

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
   * Get ALL raw stores from stores.json tanpa filter/pagination.
   * Dipakai untuk proses sync internal (INDUK + STB sekaligus).
   * @returns {Promise<Array>} Array semua store
   */
  async getAllStoresRaw() {
    await this.ensureInitialized();
    return [...this.stores];
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

      filteredStores = filteredStores.filter(store => store.notes === "INDUK");

      if (search) {
        const searchLower = search.toLowerCase();
        filteredStores = filteredStores.filter(
          store =>
            store.storeCode.toLowerCase().includes(searchLower) || store.storeName.toLowerCase().includes(searchLower),
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
        null, // no shop filter needed
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
            `Store ${store.storeCode} (${store.storeName}) not found or inactive in WRC mstr_toko_${period}`,
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
        } stores filtered out`,
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

      // --- PEMBATASAN UNTUK DEVELOPMENT ---
      // Jika environment development dan tidak ada limit yang diberikan,
      // batasi hasil ke 20 toko (untuk simulasi/pengetesan)
      if (process.env.NODE_ENV === "development" && !options.limit) {
        const originalCount = filteredStores.length;
        filteredStores = filteredStores.slice(0, 20);
        logger.info(`[DEV MODE] getStoresByBranch limited to 20 stores (was ${originalCount})`);
      }
      // Jika options.limit diberikan, tetap pakai limit tersebut
      else if (options.limit && Number.isInteger(options.limit) && options.limit > 0) {
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
            store.storeCode.toLowerCase().includes(searchLower) || store.storeName.toLowerCase().includes(searchLower),
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
        removedCount,
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

  /**
   * Validate a string as a valid IPv4 address
   * @param {string} ip
   * @returns {boolean}
   */
  isValidIpAddress(ip) {
    if (!ip) return false;
    const parts = String(ip).trim().split(".");
    if (parts.length !== 4) return false;
    return parts.every(part => {
      if (!/^\d{1,3}$/.test(part)) return false;
      const num = Number(part);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Parse TOKOMAIN.ini content. Only extracts kode toko + IP for
   * INDUK (IS_INDUK=1) and STB (STATION=STB) rows.
   * Column layout (caret-delimited):
   *   CABANG^TOKO^NAMA^STATION^IP^KONEKSI^REPORT^IS_INDUK
   * @param {Buffer|string} content - Raw file buffer or string
   * @returns {Object} { records, induk, stb, invalid, total }
   */
  parseTokomain(content) {
    const raw = Buffer.isBuffer(content) ? content.toString("utf8") : String(content || "");
    const lines = raw.split(/\r?\n/);
    const records = [];
    let induk = 0;
    let stb = 0;
    let invalid = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;

      const cols = line.split("^").map(c => c.trim());
      if (cols.length < 8) {
        invalid++;
        continue;
      }

      // Skip header line (e.g. CABANG^TOKO^...)
      if (/^cabang$/i.test(cols[0]) || /^toko$/i.test(cols[1])) {
        continue;
      }

      const toko = cols[1];
      const station = cols[3];
      const ip = cols[4];
      const isInduk = cols[7];

      if (!toko || !ip) {
        invalid++;
        continue;
      }

      // Determine type: INDUK if IS_INDUK=1, STB if station equals STB
      let type = null;
      if (isInduk === "1") {
        type = "INDUK";
      } else if (/^stb$/i.test(station)) {
        type = "STB";
      }

      if (!type) continue; // skip other stations (02, 03, ...) that are neither INDUK nor STB

      if (!this.isValidIpAddress(ip)) {
        invalid++;
        continue;
      }

      if (type === "INDUK") induk++;
      else stb++;

      records.push({
        storeCode: toko.toUpperCase(),
        station,
        ip,
        type,
      });
    }

    return { records, induk, stb, invalid, total: induk + stb };
  }

  /**
   * Persist the latest TOKOMAIN snapshot (single, newest-wins)
   * @param {Object} parsed - Result of parseTokomain
   * @param {Object} meta - { uploadedBy, deviceId, clientIp, sourcePath }
   * @returns {Promise<Object>} Saved snapshot
   */
  async saveTokomainSnapshot(parsed, meta = {}) {
    const snapshot = {
      updatedAt: new Date().toISOString(),
      uploadedBy: meta.uploadedBy || null,
      deviceId: meta.deviceId || null,
      clientIp: meta.clientIp || null,
      sourcePath: meta.sourcePath || null,
      stats: {
        induk: parsed.induk,
        stb: parsed.stb,
        invalid: parsed.invalid,
        total: parsed.total,
      },
      records: parsed.records,
    };

    await fs.mkdir(path.dirname(TOKOMAIN_SNAPSHOT_PATH), { recursive: true });
    await fs.writeFile(TOKOMAIN_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
    logger.info(`TOKOMAIN snapshot saved: ${parsed.total} records (${parsed.induk} induk, ${parsed.stb} stb)`);
    return snapshot;
  }

  /**
   * Get the latest TOKOMAIN snapshot
   * @returns {Promise<Object|null>}
   */
  async getTokomainSnapshot() {
    try {
      const data = await fs.readFile(TOKOMAIN_SNAPSHOT_PATH, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        logger.warn("TOKOMAIN snapshot corrupted, ignoring it");
        return null;
      }
      throw error;
    }
  }

  /**
   * Parse master-tokomain.csv content.
   * Header: kdcab,toko,nama,station,ip,is_induk,...
   * Hanya baris INDUK (is_induk=1) dan STB (station=STB) yang diambil.
   * @param {string} csvText - Raw CSV string (BOM-safe)
   * @returns {Object} { records, induk, stb, invalid, total }
   */
  parseMasterTokomainCsv(csvText) {
    const raw = String(csvText || "").replace(/^\ufeff/, "");
    const lines = raw.split(/\r?\n/);

    if (lines.length === 0) {
      return { records: [], induk: 0, stb: 0, invalid: 0, total: 0 };
    }

    // Normalisasi header ke lowercase agar case-insensitive
    const header = lines[0]
      .split(",")
      .map(c => c.trim().toLowerCase())
      .map(c => c.replace(/^"|"$/g, ""));

    const idx = {
      kdcab: header.indexOf("kdcab"),
      toko: header.indexOf("toko"),
      nama: header.indexOf("nama"),
      station: header.indexOf("station"),
      ip: header.indexOf("ip"),
      is_induk: header.indexOf("is_induk"),
    };

    const records = [];
    let induk = 0;
    let stb = 0;
    let invalid = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;

      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

      const kdcab = idx.kdcab >= 0 ? cols[idx.kdcab] : "";
      const toko = idx.toko >= 0 ? cols[idx.toko] : "";
      const nama = idx.nama >= 0 ? cols[idx.nama] : "";
      const station = idx.station >= 0 ? cols[idx.station] : "";
      const ip = idx.ip >= 0 ? cols[idx.ip] : "";
      const isInduk = idx.is_induk >= 0 ? cols[idx.is_induk] : "";

      if (!toko || !ip) {
        invalid++;
        continue;
      }

      const type = isInduk === "1" ? "INDUK" : /^stb$/i.test(station) ? "STB" : null;
      if (!type) continue;

      if (!this.isValidIpAddress(ip)) {
        invalid++;
        continue;
      }

      if (type === "INDUK") induk++;
      else stb++;

      records.push({
        storeCode: toko.toUpperCase(),
        station,
        storeName: nama || toko,
        ip,
        type,
      });
    }

    return { records, induk, stb, invalid, total: induk + stb };
  }

  /**
   * Persist the latest master-tokomain.csv snapshot.
   * @param {Object} parsed - Result of parseMasterTokomainCsv
   * @param {Object} meta - { uploadedBy, uploadedByFullName, clientIp, sourcePath }
   * @returns {Promise<Object>} Saved snapshot
   */
  async saveMasterCsvSnapshot(parsed, meta = {}) {
    const snapshot = {
      updatedAt: new Date().toISOString(),
      uploadedBy: meta.uploadedBy || null,
      uploadedByFullName: meta.uploadedByFullName || null,
      clientIp: meta.clientIp || null,
      sourcePath: meta.sourcePath || null,
      stats: {
        induk: parsed.induk,
        stb: parsed.stb,
        invalid: parsed.invalid,
        total: parsed.total,
      },
      records: parsed.records,
    };

    await fs.mkdir(path.dirname(MASTER_CSV_SNAPSHOT_PATH), { recursive: true });
    await fs.writeFile(MASTER_CSV_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
    logger.info(
      `Master CSV snapshot saved: ${parsed.total} records (${parsed.induk} induk, ${parsed.stb} stb)`,
    );
    return snapshot;
  }

  /**
   * Get the latest master-tokomain.csv snapshot
   * @returns {Promise<Object|null>}
   */
  async getMasterCsvSnapshot() {
    try {
      const data = await fs.readFile(MASTER_CSV_SNAPSHOT_PATH, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        logger.warn("master-tokomain-csv-snapshot.json corrupted, ignoring it");
        return null;
      }
      throw error;
    }
  }
}

// Export the class
export default StoreService;
