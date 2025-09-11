/**
 * PrepClosing Staging Service
 * Handles database operations and synchronization with JSON file
 */
import { DataTypes } from 'sequelize';
import { getSequelizeConnection } from '../../config/database.js';
import PrepClosingService from './prep_closing.service.js';
import logger from '../../config/logger.js';

class PrepClosingStagingService {
  constructor() {
    this.prepClosingService = new PrepClosingService();
    this.model = null;
  }

  /**
   * Get or create Sequelize model
   */
  async getModel() {
    if (!this.model) {
      const sequelize = await getSequelizeConnection();
      this.model = sequelize.define('PrepClosing', {
        cab: {
          type: DataTypes.CHAR(4),
          primaryKey: true,
          allowNull: false,
          comment: 'Kode cabang'
        },
        kdtk: {
          type: DataTypes.CHAR(4),
          primaryKey: true,
          allowNull: false,
          comment: 'Kode toko'
        },
        key: {
          type: DataTypes.STRING(35),
          primaryKey: true,
          allowNull: false,
          comment: 'Key identifier'
        },
        nilai: {
          type: DataTypes.STRING(35),
          allowNull: true,
          comment: 'Nilai/value'
        },
        valid: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Status validitas'
        }
      }, {
        tableName: 'prep_closing',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['cab', 'kdtk', 'key']
          },
          {
            fields: ['cab']
          },
          {
            fields: ['kdtk']
          },
          {
            fields: ['valid']
          }
        ]
      });
    }
    return this.model;
  }

  /**
   * Synchronize data from database to JSON file
   */
  async syncToJsonFile() {
    try {
      const model = await this.getModel();
      const dbData = await model.findAll({
        order: [['cab', 'ASC'], ['kdtk', 'ASC'], ['key', 'ASC']]
      });

      // Convert Sequelize instances to plain objects
      const plainData = dbData.map(item => item.get({ plain: true }));
      
      // Update the JSON service data
      this.prepClosingService.prepClosingData = plainData;
      this.prepClosingService.isLoaded = true;
      await this.prepClosingService.saveData();
      
      logger.info(`Synchronized ${plainData.length} prep_closing records to JSON file`);
      return plainData;
    } catch (error) {
      logger.error('Error synchronizing prep_closing data to JSON:', error);
      throw error;
    }
  }

  /**
   * Get prep closing data with filters
   * @param {Object} filters - Filter criteria
   * @param {number} limit - Limit results
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} Result with data and pagination info
   */
  async getPrepClosingData(filters = {}, limit = null, offset = 0) {
    try {
      const model = await this.getModel();
      const whereClause = {};

      // Build where clause from filters
      if (filters.cab) whereClause.cab = filters.cab;
      if (filters.kdtk) whereClause.kdtk = filters.kdtk;
      if (filters.key) whereClause.key = filters.key;
      if (filters.valid !== undefined) whereClause.valid = filters.valid;

      const queryOptions = {
        where: whereClause,
        order: [['cab', 'ASC'], ['kdtk', 'ASC'], ['key', 'ASC']]
      };

      if (limit) {
        queryOptions.limit = limit;
        queryOptions.offset = offset;
      }

      const { count, rows } = await model.findAndCountAll(queryOptions);
      
      return {
        data: rows.map(item => item.get({ plain: true })),
        total: count,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Error fetching prep_closing data from database:', error);
      throw error;
    }
  }

  /**
   * Get count of prep closing records
   * @param {Object} filters - Filter criteria
   * @returns {Promise<number>} Count of records
   */
  async getCount(filters = {}) {
    try {
      const model = await this.getModel();
      const whereClause = {};

      if (filters.cab) whereClause.cab = filters.cab;
      if (filters.kdtk) whereClause.kdtk = filters.kdtk;
      if (filters.key) whereClause.key = filters.key;
      if (filters.valid !== undefined) whereClause.valid = filters.valid;

      return await model.count({ where: whereClause });
    } catch (error) {
      logger.error('Error counting prep_closing records:', error);
      throw error;
    }
  }

  /**
   * Create prep closing record in database and sync to JSON
   * @param {Object} data - Prep closing data
   * @returns {Promise<Object>} Created record
   */
  async createPrepClosing(data) {
    try {
      const model = await this.getModel();
      const result = await model.create(data);
      
      // Sync to JSON file after database operation
      await this.syncToJsonFile();
      
      logger.info(`Created prep_closing record: ${data.cab}-${data.kdtk}-${data.key}`);
      return result.get({ plain: true });
    } catch (error) {
      logger.error('Error creating prep_closing record:', error);
      throw error;
    }
  }

  /**
   * Update prep closing record in database and sync to JSON
   * @param {Object} data - Update data
   * @param {Object} where - Where clause
   * @returns {Promise<Array>} Update result
   */
  async updatePrepClosing(data, where) {
    try {
      const model = await this.getModel();
      const result = await model.update(data, { where });
      
      // Sync to JSON file after database operation
      await this.syncToJsonFile();
      
      logger.info(`Updated prep_closing records: ${JSON.stringify(where)}`);
      return result;
    } catch (error) {
      logger.error('Error updating prep_closing record:', error);
      throw error;
    }
  }

  /**
   * Delete prep closing records from database and sync to JSON
   * @param {Object} where - Where clause
   * @returns {Promise<number>} Number of deleted records
   */
  async deletePrepClosing(where) {
    try {
      const model = await this.getModel();
      const result = await model.destroy({ where });
      
      // Sync to JSON file after database operation
      await this.syncToJsonFile();
      
      logger.info(`Deleted ${result} prep_closing records: ${JSON.stringify(where)}`);
      return result;
    } catch (error) {
      logger.error('Error deleting prep_closing records:', error);
      throw error;
    }
  }

  /**
   * Bulk create prep closing records
   * @param {Array} dataArray - Array of prep closing data
   * @returns {Promise<Array>} Created records
   */
  async bulkCreatePrepClosing(dataArray) {
    try {
      const model = await this.getModel();
      const result = await model.bulkCreate(dataArray, {
        updateOnDuplicate: ['nilai', 'valid', 'updated_at']
      });
      
      // Sync to JSON file after database operation
      await this.syncToJsonFile();
      
      logger.info(`Bulk created ${result.length} prep_closing records`);
      return result.map(item => item.get({ plain: true }));
    } catch (error) {
      logger.error('Error bulk creating prep_closing records:', error);
      throw error;
    }
  }

  /**
   * Upsert prep closing record
   * @param {Object} data - Prep closing data
   * @returns {Promise<Object>} Upsert result
   */
  async upsertPrepClosing(data) {
    try {
      const model = await this.getModel();
      const [instance, created] = await model.upsert(data);
      
      // Sync to JSON file after database operation
      await this.syncToJsonFile();
      
      logger.info(`${created ? 'Created' : 'Updated'} prep_closing record: ${data.cab}-${data.kdtk}-${data.key}`);
      return {
        data: instance.get({ plain: true }),
        created
      };
    } catch (error) {
      logger.error('Error upserting prep_closing record:', error);
      throw error;
    }
  }

  /**
   * Find or create prep closing record
   * @param {Object} where - Where clause
   * @param {Object} defaults - Default values for creation
   * @returns {Promise<Object>} Find or create result
   */
  async findOrCreatePrepClosing(where, defaults) {
    try {
      const model = await this.getModel();
      const [instance, created] = await model.findOrCreate({
        where,
        defaults
      });
      
      if (created) {
        // Sync to JSON file after database operation
        await this.syncToJsonFile();
        logger.info(`Created prep_closing record: ${JSON.stringify(where)}`);
      }
      
      return {
        data: instance.get({ plain: true }),
        created
      };
    } catch (error) {
      logger.error('Error finding or creating prep_closing record:', error);
      throw error;
    }
  }
}

export default PrepClosingStagingService;