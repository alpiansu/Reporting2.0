const { Screening, Store } = require('../../models');
const { createStoreConnection } = require('../../config/database');
const { sequelize } = require('../../config/database');
const logger = require('../../config/logger');

/**
 * Service for handling screening related operations
 */
class ScreeningService {
  /**
   * Get all screenings with pagination
   * @param {Object} options - Query options
   * @returns {Object} Paginated screenings
   */
  async getAllScreenings(options = {}) {
    const { page = 1, limit = 10, storeId, userId, status, type } = options;
    
    try {
      const offset = (page - 1) * limit;
      
      // Build where clause
      const whereClause = {};
      
      if (storeId) {
        whereClause.storeId = storeId;
      }
      
      if (userId) {
        whereClause.userId = userId;
      }
      
      if (status) {
        whereClause.status = status;
      }
      
      if (type) {
        whereClause.screeningType = type;
      }
      
      // Get screenings with pagination
      const { count, rows } = await Screening.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          { association: 'store', attributes: ['id', 'storeCode', 'storeName'] },
          { association: 'user', attributes: ['id', 'username', 'fullName'] },
        ],
      });
      
      return {
        screenings: rows,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      };
    } catch (error) {
      logger.error(`Failed to get screenings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get screening by ID
   * @param {number} id - Screening ID
   * @returns {Object} Screening data
   */
  async getScreeningById(id) {
    try {
      const screening = await Screening.findByPk(id, {
        include: [
          { association: 'store', attributes: ['id', 'storeCode', 'storeName'] },
          { association: 'user', attributes: ['id', 'username', 'fullName'] },
        ],
      });
      
      if (!screening) {
        throw new Error('Screening not found');
      }
      
      return screening;
    } catch (error) {
      logger.error(`Failed to get screening by ID: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start a new screening process
   * @param {Object} screeningData - Screening data
   * @returns {Object} Created screening
   */
  async startScreening(screeningData) {
    const transaction = await sequelize.transaction();
    
    try {
      // Create screening record
      const screening = await Screening.create({
        ...screeningData,
        status: 'in_progress',
        startTime: new Date(),
        progress: 0,
      }, { transaction });
      
      // Update store status
      await Store.update(
        { 
          screeningStatus: 'in_progress',
          lastScreening: new Date(),
        },
        { 
          where: { id: screeningData.storeId },
          transaction,
        }
      );
      
      await transaction.commit();
      
      // Start the screening process asynchronously
      this.processScreening(screening.id).catch(error => {
        logger.error(`Screening process error: ${error.message}`);
      });
      
      logger.info(`Screening started: ID ${screening.id} for store ${screeningData.storeId}`);
      
      return screening;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Failed to start screening: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process a screening asynchronously
   * @param {number} screeningId - Screening ID
   */
  async processScreening(screeningId) {
    try {
      // Get screening data
      const screening = await Screening.findByPk(screeningId, {
        include: [{ association: 'store' }],
      });
      
      if (!screening || screening.status !== 'in_progress') {
        return;
      }
      
      const store = screening.store;
      
      // Create connection to store database
      const storeConnection = createStoreConnection({
        host: store.dbHost,
        port: store.dbPort,
        username: store.dbUser,
        password: store.dbPassword,
        database: store.dbName,
      });
      
      try {
        // Test connection
        await storeConnection.authenticate();
        
        // Update store connection status
        await store.update({ connectionStatus: 'connected' });
        
        // Execute screening based on type
        const result = await this.executeScreeningQuery(storeConnection, screening.screeningType);
        
        // Update screening record with success
        await screening.update({
          status: 'completed',
          endTime: new Date(),
          progress: 100,
          result,
          executionTime: new Date() - screening.startTime,
        });
        
        // Update store status
        await store.update({
          screeningStatus: 'completed',
          connectionStatus: 'connected',
        });
        
        logger.info(`Screening completed: ID ${screeningId}`);
      } catch (error) {
        // Update screening record with failure
        await screening.update({
          status: 'failed',
          endTime: new Date(),
          errorMessage: error.message,
          executionTime: new Date() - screening.startTime,
        });
        
        // Update store status
        await store.update({
          screeningStatus: 'failed',
          connectionStatus: 'disconnected',
        });
        
        logger.error(`Screening failed: ID ${screeningId} - ${error.message}`);
      } finally {
        // Close connection
        await storeConnection.close();
      }
    } catch (error) {
      logger.error(`Screening process error: ${error.message}`);
      
      // Update screening record with failure
      await Screening.update(
        {
          status: 'failed',
          endTime: new Date(),
          errorMessage: error.message,
        },
        { where: { id: screeningId } }
      );
    }
  }
  
  /**
   * Execute screening query based on type
   * @param {Object} connection - Database connection
   * @param {string} screeningType - Type of screening
   * @returns {Object} Query result
   */
  async executeScreeningQuery(connection, screeningType) {
    // This is a placeholder for different screening types
    // In a real application, you would implement different queries based on screeningType
    
    let query;
    
    switch (screeningType) {
      case 'inventory':
        query = 'SELECT * FROM inventory LIMIT 100';
        break;
      case 'sales':
        query = 'SELECT * FROM sales LIMIT 100';
        break;
      case 'customers':
        query = 'SELECT * FROM customers LIMIT 100';
        break;
      default:
        query = 'SELECT 1 as test';
    }
    
    const [results] = await connection.query(query);
    return results;
  }
  
  /**
   * Update screening progress
   * @param {number} id - Screening ID
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Object} Updated screening
   */
  async updateProgress(id, progress) {
    try {
      const screening = await Screening.findByPk(id);
      
      if (!screening) {
        throw new Error('Screening not found');
      }
      
      if (screening.status !== 'in_progress') {
        throw new Error('Cannot update progress for non-active screening');
      }
      
      await screening.update({ progress });
      
      return screening;
    } catch (error) {
      logger.error(`Failed to update screening progress: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Cancel an in-progress screening
   * @param {number} id - Screening ID
   * @returns {boolean} Success status
   */
  async cancelScreening(id) {
    const transaction = await sequelize.transaction();
    
    try {
      const screening = await Screening.findByPk(id, {
        include: [{ association: 'store' }],
        transaction,
      });
      
      if (!screening) {
        throw new Error('Screening not found');
      }
      
      if (screening.status !== 'in_progress') {
        throw new Error('Only in-progress screenings can be cancelled');
      }
      
      // Update screening status
      await screening.update(
        {
          status: 'failed',
          endTime: new Date(),
          errorMessage: 'Screening cancelled by user',
        },
        { transaction }
      );
      
      // Update store status
      await screening.store.update(
        { screeningStatus: 'failed' },
        { transaction }
      );
      
      await transaction.commit();
      
      logger.info(`Screening cancelled: ID ${id}`);
      
      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Failed to cancel screening: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get screening statistics
   * @returns {Object} Screening statistics
   */
  async getStatistics() {
    try {
      const totalScreenings = await Screening.count();
      
      const completedScreenings = await Screening.count({
        where: { status: 'completed' },
      });
      
      const failedScreenings = await Screening.count({
        where: { status: 'failed' },
      });
      
      const inProgressScreenings = await Screening.count({
        where: { status: 'in_progress' },
      });
      
      // Get average execution time for completed screenings
      const avgExecutionTime = await Screening.findOne({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('execution_time')), 'avgTime'],
        ],
        where: { 
          status: 'completed',
          executionTime: { [sequelize.Op.not]: null },
        },
        raw: true,
      });
      
      return {
        totalScreenings,
        completedScreenings,
        failedScreenings,
        inProgressScreenings,
        successRate: totalScreenings > 0 ? (completedScreenings / totalScreenings) * 100 : 0,
        avgExecutionTime: avgExecutionTime?.avgTime || 0,
      };
    } catch (error) {
      logger.error(`Failed to get screening statistics: ${error.message}`);
      throw error;
    }
  }
}

// Export the class
module.exports = ScreeningService;