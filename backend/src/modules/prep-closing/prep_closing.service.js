/**
 * Service for managing prep closing data
 * Handles database operations with JSON file synchronization
 * Konsep: Read dari JSON file, Write ke database + sync ke JSON
 */
import { DataTypes } from 'sequelize';
import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';
import resilientDb from '../../config/resilient-database.js';
import logger from '../../config/logger.js';
import wrcService from '../../services/wrc.service.js';
import storeService from '../store/storeService.js';
import config from '../../config/prep_closing.config.js';

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

  /**
   * Get all WRC saldo data for a branch (optimized - fetch once before loop)
   * @param {string} cab - Branch code
   * @param {string} year - Year (4 digits)
   * @param {string} month - Month (2 digits)
   * @param {Object} connection - Database connection
   * @returns {Promise<Map>} Map of store codes to saldo data
   */
  async getAllWrcData(cab, year, month, connection) {
    try {
      const period = `${year}${month.padStart(2, '0')}`;
      
      logger.debug(`Getting all WRC saldo data for cab: ${cab}, period: ${period}`);
      
      // Use query from config
      const query = config.queries.wrcSaldo;
      
      const [results] = await connection.execute(query, [cab, period]);
      
      // Convert to Map for fast lookup
      const wrcDataMap = new Map();
      results.forEach(row => {
        wrcDataMap.set(row.store_code, row);
      });
      
      logger.debug(`Retrieved WRC data for ${results.length} stores in cab ${cab}`);
      return wrcDataMap;
    } catch (error) {
      logger.error(`Error getting all WRC saldo data for cab ${cab}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a single store for screening (similar to rekon_wt_harian pattern)
   * @param {Object} store - Store object with storeCode, dbHost, storeName
   * @param {string} cab - Branch code
   * @param {string} year - Year (4 digits)
   * @param {string} month - Month (2 digits)
   * @param {Map} wrcDataMap - Pre-fetched WRC data map
   * @returns {Promise<Object>} Store screening result
   */
  async processStoreScreening(store, cab, year, month, wrcDataMap) {
    const storeCode = store.storeCode;
    const storeInfo = {
      dbHost: store.dbHost,
      storeName: store.storeName,
    };

    let screeningResult = {
      storeCode,
      storeName: storeInfo.storeName,
      status: 'UNKNOWN',
      wrcData: null,
      storeData: null,
      errors: [],
      connectionError: null,
      isReady: false
    };

    try {
      // 1. Get WRC saldo data from pre-fetched map
      const wrcSaldoData = wrcDataMap.get(storeCode);
      screeningResult.wrcData = wrcSaldoData;

      if (!wrcSaldoData) {
        screeningResult.errors.push(`No WRC saldo data found for store ${storeCode}`);
        screeningResult.status = 'NO_WRC_DATA';
        return screeningResult;
      }

      // 2. Connect to store database and check readiness
      if (!storeInfo.dbHost) {
        screeningResult.connectionError = `No dbHost found for store ${storeCode}`;
        screeningResult.errors.push(screeningResult.connectionError);
        screeningResult.status = 'NO_HOST';
        return screeningResult;
      }

      // Try connect to store database
      const dbStore = (await import('../../config/db_store.js')).default;
      const storeConnection = await dbStore.createDbStore(storeInfo.dbHost, 2);
      
      if (storeConnection) {
        try {
          // Execute store readiness query to get all checks
          const storeReadinessQuery = this.getStoreReadinessQuery(cab, year, month, {
            saldoBlnQty: wrcSaldoData?.SALDO_AKHIR || '0',
            saldoBlnRp: wrcSaldoData?.TOTAL_PENJUALAN || '0'
          });
          logger.debug(`[${storeCode}] Executing store readiness query...`);
          
          const queryTimeout = 15000; // 15 seconds timeout
          const queryPromise = storeConnection.query(storeReadinessQuery);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Query timeout")), queryTimeout);
          });
          
          const [storeData] = await Promise.race([queryPromise, timeoutPromise]);
          screeningResult.storeData = storeData;
          
          // Save each check result to prep_closing table
          if (storeData && storeData.length > 0) {
            for (const checkResult of storeData) {
              try {
                await this.addPrepClosing({
                  cab: checkResult.cab,
                  kdtk: checkResult.kdtk,
                  key: checkResult.key,
                  nilai: checkResult.nilai,
                  valid: checkResult.valid
                });
              } catch (error) {
                // Ignore duplicate key errors, just log them
                if (!error.message.includes('already exists')) {
                  logger.warn(`[${storeCode}] Error saving check result ${checkResult.key}: ${error.message}`);
                }
              }
            }
          }
          
          // Analyze overall readiness based on query results
          const failedChecks = storeData.filter(check => check.valid === 0);
          screeningResult.isReady = failedChecks.length === 0;
          screeningResult.status = screeningResult.isReady ? 'READY' : 'NOT_READY';
          screeningResult.failedChecks = failedChecks.map(check => check.key);
          screeningResult.totalChecks = storeData.length;
          screeningResult.passedChecks = storeData.length - failedChecks.length;
          
          logger.debug(`[${storeCode}] Screening completed: ${screeningResult.status} (${screeningResult.passedChecks}/${screeningResult.totalChecks} checks passed)`);
          
        } finally {
          // Close store connection
          if (storeConnection) {
            try {
              if (storeConnection.end) {
                await storeConnection.end();
              } else if (storeConnection.destroy) {
                storeConnection.destroy();
              }
            } catch (closeError) {
              logger.warn(`[${storeCode}] Error closing store connection: ${closeError.message}`);
            }
          }
        }
      } else {
        screeningResult.connectionError = `Could not connect to store database ${storeInfo.dbHost}`;
        screeningResult.errors.push(screeningResult.connectionError);
        screeningResult.status = 'CONNECTION_FAILED';
      }

    } catch (error) {
      const errorMsg = `Processing error for store ${storeCode}: ${error.message}`;
      logger.error(errorMsg);
      screeningResult.errors.push(errorMsg);
      
      if (error.message.includes('timeout')) {
        screeningResult.status = 'TIMEOUT';
      } else {
        screeningResult.status = 'ERROR';
      }
    }

    return screeningResult;
  }

  /**
   * Get screening query to check store readiness
   * @param {string} year - Year (4 digits)
   * @param {string} month - Month (2 digits)
   * @returns {string} SQL query
   */
  getScreeningQuery(year, month) {
    const period = `${year}${month.padStart(2, '0')}`;
    
    // Use query from config and replace period placeholder
    return config.queries.closingReadiness.replace('{period}', period);
  }

  /**
   * Get store readiness query with parameter replacement
   * @param {string} cab - Cabang code
   * @param {string} year - Year (4 digits)
   * @param {string} month - Month (2 digits)
   * @param {Object} params - Additional parameters
   * @returns {string} Query with replaced parameters
   */
  getStoreReadinessQuery(cab, year, month, params = {}) {
    let query = config.queries.storeReadiness;
    
    // Default parameters
    const defaultParams = {
      strBlnSlsWrc: `${year}${month.padStart(2, '0')}`,
      strPrd: `${year}${month.padStart(2, '0')}`,
      tblFilet: `filet${year}${month.padStart(2, '0')}`,
      tblFiletMaju: `filet${year}${(parseInt(month) + 1).toString().padStart(2, '0')}`,
      strMaxBlnAktWrc: `${year}${month.padStart(2, '0')}`,
      saldoBlnQty: '0',
      saldoBlnRp: '0'
    };
    
    // Merge with provided params
    const allParams = { ...defaultParams, ...params };
    
    // Replace all placeholders
    query = query.replace(/{cab}/g, cab);
    query = query.replace(/{year}/g, year);
    query = query.replace(/{month}/g, month.padStart(2, '0'));
    query = query.replace(/{strBlnSlsWrc}/g, allParams.strBlnSlsWrc);
    query = query.replace(/{strPrd}/g, allParams.strPrd);
    query = query.replace(/{tblFilet}/g, allParams.tblFilet);
    query = query.replace(/{tblFiletMaju}/g, allParams.tblFiletMaju);
    query = query.replace(/{strMaxBlnAktWrc}/g, allParams.strMaxBlnAktWrc);
    query = query.replace(/{saldoBlnQty}/g, allParams.saldoBlnQty);
    query = query.replace(/{saldoBlnRp}/g, allParams.saldoBlnRp);
    
    return query;
  }

  /**
   * Analyze store readiness based on query results
   * @param {Array} storeData - Store query results
   * @param {Object} wrcData - WRC saldo data
   * @returns {boolean} Whether store is ready for closing
   */
  analyzeStoreReadiness(storeData, wrcData) {
    if (!storeData || storeData.length === 0) {
      return false; // No data means not ready
    }

    // With UNION ALL query, we get multiple rows with individual check results
    // Store is ready if ALL checks pass (valid = 1)
    const failedChecks = storeData.filter(check => check.valid === 0);
    const allChecksPassed = failedChecks.length === 0;
    
    // Additional check: WRC data should exist (indicates store is tracked in WRC)
    const hasWrcData = wrcData && (wrcData.SALDO_AWAL !== undefined || wrcData.SALDO_AKHIR !== undefined);
    
    // Store is ready if all checks pass and WRC data exists
    return allChecksPassed && hasWrcData;
  }
}

export default new PrepClosingService();