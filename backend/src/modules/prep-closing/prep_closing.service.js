/**
 * PrepClosing Service - JSON file based implementation
 * Handles prep closing data operations using JSON file storage
 */
import fs from 'fs/promises';
import path from 'path';
import logger from '../../config/logger.js';

class PrepClosingService {
  constructor() {
    this.dataPath = path.join(process.cwd(), 'data');
    this.filePath = path.join(this.dataPath, 'prep_closing.json');
    this.prepClosingData = [];
    this.isLoaded = false;
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  /**
   * Load data from JSON file
   */
  async loadData() {
    if (this.isLoaded) return;

    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      this.prepClosingData = JSON.parse(data);
      this.isLoaded = true;
      logger.info(`Loaded ${this.prepClosingData.length} prep closing records from JSON file`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, start with empty array
        this.prepClosingData = [];
        this.isLoaded = true;
        logger.info('Prep closing JSON file not found, starting with empty data');
      } else {
        logger.error('Error loading prep closing data:', error);
        throw error;
      }
    }
  }

  /**
   * Save data to JSON file
   */
  async saveData() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.prepClosingData, null, 2));
      logger.info(`Saved ${this.prepClosingData.length} prep closing records to JSON file`);
    } catch (error) {
      logger.error('Error saving prep closing data:', error);
      throw error;
    }
  }

  /**
   * Get all prep closing data
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} Array of prep closing records
   */
  async getAllPrepClosing(filters = {}) {
    await this.loadData();
    
    let filteredData = [...this.prepClosingData];

    // Apply filters
    if (filters.cab) {
      filteredData = filteredData.filter(item => item.cab === filters.cab);
    }
    if (filters.kdtk) {
      filteredData = filteredData.filter(item => item.kdtk === filters.kdtk);
    }
    if (filters.key) {
      filteredData = filteredData.filter(item => item.key === filters.key);
    }
    if (filters.valid !== undefined) {
      filteredData = filteredData.filter(item => item.valid === filters.valid);
    }

    return filteredData;
  }

  /**
   * Get prep closing by composite primary key
   * @param {string} cab - Cabang code
   * @param {string} kdtk - Toko code
   * @param {string} key - Key
   * @returns {Promise<Object|null>} Prep closing record or null
   */
  async getPrepClosingByKey(cab, kdtk, key) {
    await this.loadData();
    
    return this.prepClosingData.find(item => 
      item.cab === cab && item.kdtk === kdtk && item.key === key
    ) || null;
  }

  /**
   * Add new prep closing record
   * @param {Object} prepClosingData - Prep closing data
   * @returns {Promise<Object>} Created prep closing record
   */
  async addPrepClosing(prepClosingData) {
    await this.loadData();
    
    // Check if record already exists
    const existing = await this.getPrepClosingByKey(
      prepClosingData.cab, 
      prepClosingData.kdtk, 
      prepClosingData.key
    );
    
    if (existing) {
      throw new Error(`Prep closing record already exists for cab: ${prepClosingData.cab}, kdtk: ${prepClosingData.kdtk}, key: ${prepClosingData.key}`);
    }

    // Add timestamps
    const newRecord = {
      ...prepClosingData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.prepClosingData.push(newRecord);
    await this.saveData();
    
    logger.info(`Added prep closing record: ${prepClosingData.cab}-${prepClosingData.kdtk}-${prepClosingData.key}`);
    return newRecord;
  }

  /**
   * Update prep closing record
   * @param {string} cab - Cabang code
   * @param {string} kdtk - Toko code
   * @param {string} key - Key
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated prep closing record or null
   */
  async updatePrepClosing(cab, kdtk, key, updateData) {
    await this.loadData();
    
    const index = this.prepClosingData.findIndex(item => 
      item.cab === cab && item.kdtk === kdtk && item.key === key
    );
    
    if (index === -1) {
      return null;
    }

    // Update the record
    this.prepClosingData[index] = {
      ...this.prepClosingData[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    await this.saveData();
    
    logger.info(`Updated prep closing record: ${cab}-${kdtk}-${key}`);
    return this.prepClosingData[index];
  }

  /**
   * Delete prep closing record
   * @param {string} cab - Cabang code
   * @param {string} kdtk - Toko code
   * @param {string} key - Key
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deletePrepClosing(cab, kdtk, key) {
    await this.loadData();
    
    const index = this.prepClosingData.findIndex(item => 
      item.cab === cab && item.kdtk === kdtk && item.key === key
    );
    
    if (index === -1) {
      return false;
    }

    this.prepClosingData.splice(index, 1);
    await this.saveData();
    
    logger.info(`Deleted prep closing record: ${cab}-${kdtk}-${key}`);
    return true;
  }

  /**
   * Get count of prep closing records
   * @param {Object} filters - Filter criteria
   * @returns {Promise<number>} Count of records
   */
  async getCount(filters = {}) {
    const data = await this.getAllPrepClosing(filters);
    return data.length;
  }

  /**
   * Bulk insert prep closing records
   * @param {Array} prepClosingArray - Array of prep closing records
   * @returns {Promise<Array>} Array of created records
   */
  async bulkInsert(prepClosingArray) {
    await this.loadData();
    
    const createdRecords = [];
    
    for (const prepClosingData of prepClosingArray) {
      // Check if record already exists
      const existing = await this.getPrepClosingByKey(
        prepClosingData.cab, 
        prepClosingData.kdtk, 
        prepClosingData.key
      );
      
      if (!existing) {
        const newRecord = {
          ...prepClosingData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        this.prepClosingData.push(newRecord);
        createdRecords.push(newRecord);
      }
    }
    
    if (createdRecords.length > 0) {
      await this.saveData();
      logger.info(`Bulk inserted ${createdRecords.length} prep closing records`);
    }
    
    return createdRecords;
  }
}

export default PrepClosingService;