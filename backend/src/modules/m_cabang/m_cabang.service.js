/**
 * Service for m_cabang data using JSON file storage
 */
import fs from 'fs/promises';
import path from 'path';
import logger from '../../config/logger.js';

class MCabangService {
  constructor() {
    // Get the absolute path to the JSON file
    this.filePath = path.join(process.cwd(), "data/m_cabang.json");
    this.cabangList = [];
    this.initialized = false;

    // Initialize cabang data if not exists
    this.initCabangData();
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
        this.cabangList = JSON.parse(data);
        logger.info(`Loaded ${this.cabangList.length} cabang from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.cabangList = [];
          await this.saveToFile();
          logger.info("Created new m_cabang.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize m_cabang service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save cabang data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.cabangList, null, 2));
      // logger.info(`Saved ${this.cabangList.length} cabang to JSON file`);
    } catch (error) {
      logger.error(`Failed to save cabang to file: ${error.message}`);
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
   * Initialize cabang data from JSON file or create default data
   */
  async initCabangData() {
    try {
      await this.ensureInitialized();

      // If cabang list is empty, add default data
      if (this.cabangList.length === 0) {
        // Default cabang data
        const defaultCabangData = [
          { kdcab: "G033", namacab: "TANGERANG 2" },
          { kdcab: "G026", namacab: "TANGERANG 1" },
          { kdcab: "G107", namacab: "PARUNG" },
          { kdcab: "G113", namacab: "BOGOR 1" },
          { kdcab: "G117", namacab: "BOGOR 2" },
          { kdcab: "G157", namacab: "LEBAK" },
        ];

        // Add to cabang list
        this.cabangList = defaultCabangData;

        // Save to file
        await this.saveToFile();
        logger.info("Default cabang data initialized");
      }
    } catch (error) {
      logger.error(`Error initializing cabang data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all cabang
   * @returns {Promise<Array>} List of cabang
   */
  async getAllCabang() {
    try {
      await this.ensureInitialized();
      return [...this.cabangList].sort((a, b) => a.kdcab.localeCompare(b.kdcab));
    } catch (error) {
      logger.error(`Error in getAllCabang: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cabang by code
   * @param {string} kdcab - Cabang code
   * @returns {Promise<Object>} Cabang data
   */
  async getCabangByCode(kdcab) {
    try {
      await this.ensureInitialized();
      return this.cabangList.find(cabang => cabang.kdcab === kdcab) || null;
    } catch (error) {
      logger.error(`Error in getCabangByCode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new cabang
   * @param {Object} cabangData - Cabang data
   * @returns {Promise<Object>} Created cabang
   */
  async createCabang(cabangData) {
    try {
      await this.ensureInitialized();

      // Check if cabang already exists
      const existingCabang = await this.getCabangByCode(cabangData.kdcab);
      if (existingCabang) {
        throw new Error(`Cabang with code ${cabangData.kdcab} already exists`);
      }

      // Create new cabang
      const newCabang = {
        kdcab: cabangData.kdcab,
        namacab: cabangData.namacab,
      };

      // Add to cabang list
      this.cabangList.push(newCabang);

      // Save to file
      await this.saveToFile();

      return newCabang;
    } catch (error) {
      logger.error(`Error in createCabang: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing cabang
   * @param {string} kdcab - Cabang code
   * @param {Object} cabangData - Cabang data
   * @returns {Promise<Object>} Updated cabang
   */
  async updateCabang(kdcab, cabangData) {
    try {
      await this.ensureInitialized();

      // Find cabang index
      const index = this.cabangList.findIndex(cabang => cabang.kdcab === kdcab);
      if (index === -1) {
        throw new Error(`Cabang with code ${kdcab} not found`);
      }

      // Update cabang
      const updatedCabang = {
        ...this.cabangList[index],
        namacab: cabangData.namacab,
      };

      // Replace in list
      this.cabangList[index] = updatedCabang;

      // Save to file
      await this.saveToFile();

      return updatedCabang;
    } catch (error) {
      logger.error(`Error in updateCabang: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a cabang
   * @param {string} kdcab - Cabang code
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteCabang(kdcab) {
    try {
      await this.ensureInitialized();

      // Find cabang index
      const index = this.cabangList.findIndex(cabang => cabang.kdcab === kdcab);
      if (index === -1) {
        throw new Error(`Cabang with code ${kdcab} not found`);
      }

      // Remove from list
      this.cabangList.splice(index, 1);

      // Save to file
      await this.saveToFile();

      return true;
    } catch (error) {
      logger.error(`Error in deleteCabang: ${error.message}`);
      throw error;
    }
  }
}

export default MCabangService;
