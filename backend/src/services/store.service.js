const { Store } = require('../models');
const { createStoreConnection } = require('../config/database');
const logger = require('../config/logger');

/**
 * Service for handling store related operations
 */
class StoreService {
  /**
   * Get all stores with pagination
   * @param {Object} options - Query options
   * @returns {Object} Paginated stores
   */
  async getAllStores(options = {}) {
    const { page = 1, limit = 10, search = '', region, city, status } = options;
    
    try {
      const offset = (page - 1) * limit;
      
      // Build where clause
      const whereClause = {};
      
      if (search) {
        whereClause[sequelize.Op.or] = [
          { storeCode: { [sequelize.Op.like]: `%${search}%` } },
          { storeName: { [sequelize.Op.like]: `%${search}%` } },
        ];
      }
      
      if (region) {
        whereClause.region = region;
      }
      
      if (city) {
        whereClause.city = city;
      }
      
      if (status) {
        whereClause.isActive = status === 'active';
      }
      
      // Get stores with pagination
      const { count, rows } = await Store.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['updatedAt', 'DESC']],
      });
      
      return {
        stores: rows,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
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
      const store = await Store.findByPk(id);
      
      if (!store) {
        throw new Error('Store not found');
      }
      
      return store;
    } catch (error) {
      logger.error(`Failed to get store by ID: ${error.message}`);
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
      // Create store
      const store = await Store.create(storeData);
      
      logger.info(`New store created: ${store.storeName} (${store.storeCode})`);
      
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
      const store = await Store.findByPk(id);
      
      if (!store) {
        throw new Error('Store not found');
      }
      
      // Update store data
      await store.update(storeData);
      
      logger.info(`Store updated: ${store.storeName} (${store.storeCode})`);
      
      return store;
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
      const store = await Store.findByPk(id);
      
      if (!store) {
        throw new Error('Store not found');
      }
      
      await store.destroy();
      
      logger.info(`Store deleted: ${store.storeName} (${store.storeCode})`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete store: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Test connection to a store database
   * @param {Object} connectionData - Database connection data
   * @returns {Object} Connection status
   */
  async testConnection(connectionData) {
    try {
      const connection = createStoreConnection(connectionData);
      
      // Test connection
      await connection.authenticate();
      
      // Close connection
      await connection.close();
      
      logger.info(`Connection test successful for ${connectionData.host}`);
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      logger.error(`Connection test failed: ${error.message}`);
      
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }
}

module.exports = new StoreService();