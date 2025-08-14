const StoreService = require('./store.service');
const logger = require('../../config/logger');

const storeService = new StoreService();

/**
 * Controller for handling store related requests
 */
class StoreController {
  /**
   * Get all stores with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllStores(req, res, next) {
    try {
      const { page, limit, search, region, city, status } = req.query;
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        search: search || '',
        region,
        city,
        status,
      };
      
      const result = await storeService.getAllStores(options);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get store by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getStoreById(req, res, next) {
    try {
      const { id } = req.params;
      
      const store = await storeService.getStoreById(id);
      
      res.status(200).json(store);
    } catch (error) {
      if (error.message === 'Store not found') {
        return res.status(404).json({ message: 'Store not found' });
      }
      next(error);
    }
  }
  
  /**
   * Get stores by branch with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getStoresByBranch(req, res, next) {
    try {
      const { branchCode } = req.params;
      const { page, limit, search, onlyInduk, status } = req.query;
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        search: search || '',
        onlyInduk: onlyInduk !== 'false', // default true, false only if explicitly set to 'false'
        status,
      };
      
      const result = await storeService.getStoresByBranchPaginated(branchCode, options);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Create a new store
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createStore(req, res, next) {
    try {
      const storeData = req.body;
      
      // Validate required fields
      if (!storeData.storeCode || !storeData.storeName || !storeData.dbHost || !storeData.dbUser || !storeData.dbPassword || !storeData.dbName) {
        return res.status(400).json({ message: 'Missing required store information' });
      }
      
      const store = await storeService.createStore(storeData);
      
      res.status(201).json(store);
    } catch (error) {
      // Handle duplicate store code
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Store code already exists' });
      }
      next(error);
    }
  }
  
  /**
   * Update store data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateStore(req, res, next) {
    try {
      const { id } = req.params;
      const storeData = req.body;
      
      const store = await storeService.updateStore(id, storeData);
      
      res.status(200).json(store);
    } catch (error) {
      if (error.message === 'Store not found') {
        return res.status(404).json({ message: 'Store not found' });
      }
      // Handle duplicate store code
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Store code already exists' });
      }
      next(error);
    }
  }
  
  /**
   * Delete a store
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteStore(req, res, next) {
    try {
      const { id } = req.params;
      
      await storeService.deleteStore(id);
      
      res.status(200).json({ message: 'Store deleted successfully' });
    } catch (error) {
      if (error.message === 'Store not found') {
        return res.status(404).json({ message: 'Store not found' });
      }
      next(error);
    }
  }
  
  /**
   * Test connection to a store database
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async testConnection(req, res, next) {
    try {
      const connectionData = req.body;
      
      // Validate required fields
      if (!connectionData.host || !connectionData.username || !connectionData.password || !connectionData.database) {
        return res.status(400).json({ message: 'Missing required connection information' });
      }
      
      const result = await storeService.testConnection(connectionData);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

// Export the class
module.exports = StoreController;