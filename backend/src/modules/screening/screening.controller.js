const ScreeningService = require('./screening.service');
const logger = require('../../config/logger');

const screeningService = new ScreeningService();

/**
 * Controller for handling screening related requests
 */
class ScreeningController {
  /**
   * Get all screenings with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllScreenings(req, res, next) {
    try {
      const { page, limit, storeId, userId, status, type } = req.query;
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        storeId: storeId ? parseInt(storeId) : null,
        userId: userId ? parseInt(userId) : null,
        status,
        type,
      };
      
      const result = await screeningService.getAllScreenings(options);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get screening by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getScreeningById(req, res, next) {
    try {
      const { id } = req.params;
      
      const screening = await screeningService.getScreeningById(id);
      
      res.status(200).json(screening);
    } catch (error) {
      if (error.message === 'Screening not found') {
        return res.status(404).json({ message: 'Screening not found' });
      }
      next(error);
    }
  }
  
  /**
   * Start a new screening process
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async startScreening(req, res, next) {
    try {
      const { storeId, screeningType } = req.body;
      
      // Validate required fields
      if (!storeId || !screeningType) {
        return res.status(400).json({ message: 'Store ID and screening type are required' });
      }
      
      const screeningData = {
        storeId,
        screeningType,
        userId: req.user.id,
      };
      
      const screening = await screeningService.startScreening(screeningData);
      
      res.status(201).json(screening);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get screening progress
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getProgress(req, res, next) {
    try {
      const { id } = req.params;
      
      const screening = await screeningService.getScreeningById(id);
      
      res.status(200).json({
        id: screening.id,
        status: screening.status,
        progress: screening.progress,
        startTime: screening.startTime,
        endTime: screening.endTime,
        errorMessage: screening.errorMessage,
      });
    } catch (error) {
      if (error.message === 'Screening not found') {
        return res.status(404).json({ message: 'Screening not found' });
      }
      next(error);
    }
  }
  
  /**
   * Cancel an in-progress screening
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async cancelScreening(req, res, next) {
    try {
      const { id } = req.params;
      
      await screeningService.cancelScreening(id);
      
      res.status(200).json({ message: 'Screening cancelled successfully' });
    } catch (error) {
      if (error.message === 'Screening not found') {
        return res.status(404).json({ message: 'Screening not found' });
      }
      if (error.message === 'Only in-progress screenings can be cancelled') {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
  
  /**
   * Get screening statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getStatistics(req, res, next) {
    try {
      const statistics = await screeningService.getStatistics();
      
      res.status(200).json(statistics);
    } catch (error) {
      next(error);
    }
  }
}

// Export the class
module.exports = ScreeningController;