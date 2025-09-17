/**
 * Service for managing prep closing data
 * Handles database operations with JSON file synchronization
 * Konsep: Read dari JSON file, Write ke database + sync ke JSON
 */
import { DataTypes } from 'sequelize';
import resilientDb from '../../config/resilient-database.js';
import logger from '../../config/logger.js';
import fs from 'fs/promises';
import path from 'path';

// Path untuk file JSON prep_closing
const PREP_CLOSING_JSON_PATH = path.join(process.cwd(), "data/prep_closing.json");

// Define PrepClosing model
let PrepClosing = null;

class PrepClosingService {
  constructor() {
    this.prepClosingData = [];
    this.initialized = false;
  }

  /**
   * Initialize the service by loading data from JSON file and setting up model
   */
  async initialize() {
    try {
      // Initialize model if database is available
      if (resilientDb.sequelize && !PrepClosing) {
        PrepClosing = resilientDb.sequelize.define('PrepClosing', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          cab: {
            type: DataTypes.STRING(10),
            allowNull: false
          },
          kdtk: {
            type: DataTypes.STRING(10),
            allowNull: false
          },
          key: {
            type: DataTypes.STRING(50),
            allowNull: false
          },
          nilai: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
          },
          valid: {
            type: DataTypes.TINYINT,
            allowNull: false,
            defaultValue: 1
          }
        }, {
          tableName: 'prep_closing',
          timestamps: true,
          underscored: true,
          indexes: [
            {
              unique: true,
              fields: ['cab', 'kdtk', 'key']
            }
          ]
        });
      }

      // Create directory if it doesn't exist
      const dir = path.dirname(PREP_CLOSING_JSON_PATH);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(PREP_CLOSING_JSON_PATH, "utf8");
        this.prepClosingData = JSON.parse(data);
        logger.info(`Loaded ${this.prepClosingData.length} prep_closing records from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.prepClosingData = [];
          await this.saveToFile();
          logger.info("Created new prep_closing.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
      logger.info('PrepClosingService initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize prep closing service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(PREP_CLOSING_JSON_PATH, JSON.stringify(this.prepClosingData, null, 2));
    } catch (error) {
      logger.error(`Failed to save prep_closing data to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Sync data from database to JSON file
   */
  async syncToJsonFile() {
    try {
      if (!resilientDb.isDatabaseAvailable() || !PrepClosing) {
        logger.warn('Database not available, skipping sync to JSON');
        return;
      }

      const records = await PrepClosing.findAll({
        order: [['id', 'ASC']]
      });
      this.prepClosingData = records.map(record => record.toJSON());
      await this.saveToFile();
      
      logger.info(`Synced ${this.prepClosingData.length} prep_closing records to JSON file`);
    } catch (error) {
      logger.error(`Failed to sync prep_closing data to JSON: ${error.message}`);
    }
  }

  /**
   * Get all prep closing data with optional filters (READ dari JSON)
   */
  async getAllPrepClosing(filters = {}, limit = 100, offset = 0) {
    await this.ensureInitialized();
    
    let filteredData = [...this.prepClosingData];

    // Apply filters
    if (filters.id) {
      filteredData = filteredData.filter(item => item.id === parseInt(filters.id));
    }
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
      filteredData = filteredData.filter(item => item.valid === parseInt(filters.valid));
    }

    // Apply pagination
    const startIndex = offset;
    const endIndex = startIndex + limit;
    
    return filteredData.slice(startIndex, endIndex);
  }

  /**
   * Get prep closing by ID (READ dari JSON)
   */
  async getPrepClosingById(id) {
    await this.ensureInitialized();
    const record = this.prepClosingData.find(item => item.id === parseInt(id));
    return record || null;
  }

  /**
   * Create new prep closing record (WRITE ke database + sync ke JSON)
   */
  async addPrepClosing(data) {
    try {
      if (!resilientDb.isDatabaseAvailable() || !PrepClosing) {
        throw new Error('Database sedang tidak tersedia. Operasi tulis tidak dapat dilakukan.');
      }

      // Check for duplicate based on unique constraint
      const existing = await PrepClosing.findOne({
        where: {
          cab: data.cab,
          kdtk: data.kdtk,
          key: data.key
        }
      });

      if (existing) {
        throw new Error(`Record already exists for cab: ${data.cab}, kdtk: ${data.kdtk}, key: ${data.key}`);
      }

      const record = await PrepClosing.create(data);
      
      // Sync to JSON after database operation
      await this.syncToJsonFile();

      return record.toJSON();
    } catch (error) {
      logger.error(`Error in addPrepClosing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update prep closing record by ID (WRITE ke database + sync ke JSON)
   */
  async updatePrepClosing(id, data) {
    try {
      if (!resilientDb.isDatabaseAvailable() || !PrepClosing) {
        throw new Error('Database sedang tidak tersedia. Operasi tulis tidak dapat dilakukan.');
      }

      const record = await PrepClosing.findByPk(id);
      if (!record) {
        throw new Error('Record not found');
      }

      await record.update(data);
      
      // Sync to JSON after database operation
      await this.syncToJsonFile();

      return record.toJSON();
    } catch (error) {
      logger.error(`Error in updatePrepClosing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete prep closing record by ID (WRITE ke database + sync ke JSON)
   */
  async deletePrepClosing(id) {
    try {
      if (!resilientDb.isDatabaseAvailable() || !PrepClosing) {
        throw new Error('Database sedang tidak tersedia. Operasi tulis tidak dapat dilakukan.');
      }

      const record = await PrepClosing.findByPk(id);
      if (!record) {
        throw new Error('Record not found');
      }

      const deletedRecord = record.toJSON();
      await record.destroy();
      
      // Sync to JSON after database operation
      await this.syncToJsonFile();

      return deletedRecord;
    } catch (error) {
      logger.error(`Error in deletePrepClosing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of records with filters (READ dari JSON)
   */
  async getCount(filters = {}) {
    await this.ensureInitialized();
    
    let filteredData = [...this.prepClosingData];

    // Apply same filters as getAllPrepClosing
    if (filters.id) {
      filteredData = filteredData.filter(item => item.id === parseInt(filters.id));
    }
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
      filteredData = filteredData.filter(item => item.valid === parseInt(filters.valid));
    }

    return filteredData.length;
  }
}

export default new PrepClosingService();