/**
 * Progress Helper
 * Simplified interface for using GlobalProgressService
 * Provides easy-to-use methods for common progress operations
 */
import globalProgressService from './GlobalProgressService.js';
import logger from '../../config/logger.js';

class ProgressHelper {
  /**
   * Start a new progress tracking session
   * @param {Object} config - Configuration object
   * @param {string} config.cab - Branch code
   * @param {string} config.period - Period
   * @param {string} config.message - Initial message
   * @param {Object} config.details - Additional details
   * @returns {string} Progress ID
   */
  static start(config) {
    const { cab, period, message = 'Starting process...', details = {} } = config;
    const identifier = `${cab}_${period}`;
    const totalItems = details.totalStores || 0;
    
    const progressId = globalProgressService.initProgress('rekon_wt_harian', identifier, totalItems, {
      cab,
      period,
      ...details
    });
    
    // Send initial update
    globalProgressService.updateProgress(progressId, {
      message,
      processedItems: 0,
      percentage: 0,
      details: {
        ...details,
        cab,
        period
      }
    });
    
    logger.info(`Progress started: ${progressId} for ${cab} period ${period}`);
    return progressId;
  }

  /**
   * Update progress with current step
   * @param {string} progressId - Progress ID
   * @param {Object} update - Update object
   * @param {string} update.message - Progress message
   * @param {Object} update.details - Additional details
   * @param {number} update.currentStep - Current step (optional)
   */
  static updateStep(progressId, update) {
    const { message, details = {}, currentStep } = update;
    
    const updateData = {
      message,
      details: {
        ...details,
        updatedAt: new Date().toISOString()
      }
    };
    
    if (currentStep !== undefined) {
      updateData.processedItems = currentStep;
      updateData.details.currentStep = currentStep;
    }
    
    globalProgressService.updateProgress(progressId, updateData);
  }

  /**
   * Update progress with percentage
   * @param {string} progressId - Progress ID
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} message - Progress message
   * @param {Object} data - Additional data
   */
  static updatePercentage(progressId, percentage, message, data = {}) {
    globalProgressService.updateProgress(progressId, {
      percentage,
      message,
      details: {
        ...data,
        updatedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Update progress with both step and total items
   * @param {string} progressId - Progress ID
   * @param {number} processedItems - Number of processed items
   * @param {number} totalItems - Total number of items
   * @param {string} message - Progress message
   * @param {Object} data - Additional data
   */
  static updateProgress(progressId, processedItems, totalItems, message, data = {}) {
    globalProgressService.updateProgress(progressId, {
      processedItems,
      totalItems,
      message,
      details: {
        ...data,
        updatedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Add a log entry to progress
   * @param {string} progressId - Progress ID
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  static addLog(progressId, level, message, data = {}) {
    const progress = globalProgressService.getProgress(progressId);
    if (!progress) {
      logger.warn(`Progress not found for logging: ${progressId}`);
      return;
    }

    if (!progress.logs) {
      progress.logs = [];
    }

    progress.logs.push({
      level,
      message,
      timestamp: Date.now(),
      data
    });

    globalProgressService.updateProgress(progressId, {
      logs: progress.logs
    });
  }

  /**
   * Complete the progress
   * @param {string} progressId - Progress ID
   * @param {string} message - Completion message
   * @param {Object} finalData - Final data
   */
  static complete(progressId, message = 'Process completed successfully', finalData = {}) {
    globalProgressService.updateProgress(progressId, {
      message,
      ...finalData
    });
    
    globalProgressService.completeProgress(progressId, finalData);
    logger.info(`Progress completed: ${progressId}`);
  }

  /**
   * Fail the progress
   * @param {string} progressId - Progress ID
   * @param {string|Error} error - Error message or object
   * @param {Object} errorData - Additional error data
   */
  static fail(progressId, error, errorData = {}) {
    const errorMessage = error.message || error;
    
    globalProgressService.updateProgress(progressId, {
      message: `Process failed: ${errorMessage}`,
      details: {
        error: errorMessage,
        ...errorData,
        failedAt: new Date().toISOString()
      }
    });
    
    globalProgressService.failProgress(progressId, error);
    logger.error(`Progress failed: ${progressId} - ${errorMessage}`);
  }

  /**
   * Get progress data
   * @param {string} progressId - Progress ID
   * @returns {Object|null} Progress data
   */
  static getProgress(progressId) {
    return globalProgressService.getProgress(progressId);
  }

  /**
   * Get latest progress for a specific cab and period
   * @param {string} cab - Branch code
   * @param {string} period - Period
   * @returns {Object|null} Latest progress or null
   */
  static getLatestProgress(cab, period) {
    const identifier = `${cab}_${period}`;
    return globalProgressService.getLatestProgress('rekon_wt_harian', identifier);
  }

  /**
   * Get active process for a specific cab and period
   * @param {string} cab - Branch code
   * @param {string} period - Period
   * @returns {Object|null} Active process or null
   */
  static getActiveProcess(cab, period) {
    const identifier = `${cab}_${period}`;
    return globalProgressService.getActiveProcess('rekon_wt_harian', identifier);
  }

  /**
   * Get any active process (for checking if any process is running)
   * @returns {Object|null} Any active process or null
   */
  static getAnyActiveProcess() {
    return globalProgressService.getAnyActiveProcess('rekon_wt_harian');
  }

  /**
   * Get all active processes regardless of process type
   * @returns {Array} Array of active progress data
   */
  static getAllActiveProcesses() {
    return globalProgressService.getAllActiveProcesses();
  }

  /**
   * Check if there are any active processes in the entire system
   * @returns {Object|null} First active process found or null
   */
  static hasAnyActiveProcess() {
    return globalProgressService.hasAnyActiveProcess();
  }

  /**
   * Create SSE route for progress updates
   * @param {Function} authenticateSSE - Authentication middleware
   * @returns {Function} Route handler
   */
  static createSSERoute(authenticateSSE) {
    return globalProgressService.createSSEHandler(authenticateSSE);
  }

  /**
   * Initialize the progress service
   */
  static initialize() {
    globalProgressService.initialize();
  }

  /**
   * Get the underlying service instance (for advanced usage)
   * @returns {GlobalProgressService} Service instance
   */
  static getService() {
    return globalProgressService;
  }

  /**
   * Subscribe to progress updates via SSE
   * @param {string} progressId - Progress ID
   * @param {Object} response - Express response object
   * @returns {boolean} Success status
   */
  static subscribeToProgress(progressId, response) {
    return globalProgressService.subscribeToProgress(progressId, response);
  }

  /**
   * Unsubscribe from progress updates
   * @param {string} progressId - Progress ID
   * @param {Object} response - Express response object
   */
  static unsubscribeFromProgress(progressId, response) {
    return globalProgressService.unsubscribeFromProgress(progressId, response);
  }

  /**
   * Add SSE client
   * @param {string} clientId - Client ID
   * @param {Object} clientData - Client data
   */
  static addClient(clientId, clientData) {
    return globalProgressService.addClient(clientId, clientData);
  }

  /**
   * Get SSE client
   * @param {string} clientId - Client ID
   * @returns {Object} Client data
   */
  static getClient(clientId) {
    return globalProgressService.getClient(clientId);
  }

  /**
   * Remove SSE client
   * @param {string} clientId - Client ID
   */
  static removeClient(clientId) {
    return globalProgressService.removeClient(clientId);
  }
}

export default ProgressHelper;