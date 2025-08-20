/**
 * Service for tracking reconciliation progress
 */
const EventEmitter = require('events');
const logger = require('../../config/logger');

class RekonProgressService {
  constructor() {
    this.progressMap = new Map();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Initialize progress tracking for a reconciliation process
   * @param {string} cab - Branch code (or 'All' for all branches)
   * @param {string} periode - Period in YYMM format
   * @param {number} totalItems - Total number of items to process
   * @returns {string} - Progress ID
   */
  initProgress(cab, periode, totalItems) {
    // Gunakan ID yang tetap untuk memudahkan deteksi
    const progressId = `rekon_${cab}_${periode}`;
    
    this.progressMap.set(progressId, {
      id: progressId,
      cab,
      periode,
      totalItems,
      processedItems: 0,
      completedItems: 0,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      errors: [],
      details: [],
      lastUpdate: Date.now(),
    });

    logger.info(`Initialized progress tracking for ${cab} ${periode} with ID ${progressId}`);
    return progressId;
  }

  /**
   * Update progress for a reconciliation process
   * @param {string} progressId - Progress ID
   * @param {Object} update - Progress update
   * @param {number} update.processedItems - Number of processed items
   * @param {number} update.completedItems - Number of completed items
   * @param {number} update.percentage - Percentage of completion (0-100)
   * @param {string} update.status - Status of the process
   * @param {Array} update.errors - Errors encountered
   * @param {Object} update.details - Additional details
   */
  updateProgress(progressId, update) {
    if (!this.progressMap.has(progressId)) {
      logger.warn(`Progress ID ${progressId} not found`);
      return;
    }

    const progress = this.progressMap.get(progressId);
    const updatedProgress = { ...progress, ...update, lastUpdate: Date.now() };
    
    // If status is completed or failed, set endTime
    if (update.status === 'completed' || update.status === 'failed') {
      updatedProgress.endTime = Date.now();
    }

    this.progressMap.set(progressId, updatedProgress);

    // Calculate percentage if not provided
    let percentage = update.percentage;
    if (percentage === undefined) {
      percentage = updatedProgress.totalItems > 0 
        ? Math.round((updatedProgress.processedItems / updatedProgress.totalItems) * 100) 
        : 0;
    }
    
    // Ensure percentage is a number and between 0-100
    percentage = Number(percentage) || 0;
    percentage = Math.max(0, Math.min(100, percentage));

    const progressData = {
      ...updatedProgress,
      percentage,
    };

    // Emit general progress event
    this.eventEmitter.emit('progress', progressData);
    
    // Emit progress-specific event
    this.eventEmitter.emit(`progress:${progressId}`, progressData);

    logger.debug(`Updated progress for ${progressId}: ${percentage}% (${updatedProgress.processedItems}/${updatedProgress.totalItems})`);
  }

  /**
   * Get progress for a reconciliation process
   * @param {string} progressId - Progress ID
   * @returns {Object} - Progress object
   */
  getProgress(progressId) {
    if (!this.progressMap.has(progressId)) {
      return null;
    }

    const progress = this.progressMap.get(progressId);
    
    // Use existing percentage if available, otherwise calculate
    let percentage = progress.percentage;
    if (percentage === undefined) {
      percentage = progress.totalItems > 0 
        ? Math.round((progress.processedItems / progress.totalItems) * 100) 
        : 0;
    }
    
    // Ensure percentage is a number and between 0-100
    percentage = Number(percentage) || 0;
    percentage = Math.max(0, Math.min(100, percentage));

    return {
      ...progress,
      percentage,
    };
  }

  /**
   * Get latest progress for a branch and period
   * @param {string} cab - Branch code
   * @param {string} periode - Period in YYMM format
   * @returns {Object} - Progress object
   */
  getLatestProgress(cab, periode) {
    let latestProgress = null;
    let latestTime = 0;

    for (const [_, progress] of this.progressMap.entries()) {
      if (progress.cab === cab && progress.periode === periode && progress.startTime > latestTime) {
        latestProgress = progress;
        latestTime = progress.startTime;
      }
    }

    if (!latestProgress) {
      return null;
    }

    // Use existing percentage if available, otherwise calculate
    let percentage = latestProgress.percentage;
    if (percentage === undefined) {
      percentage = latestProgress.totalItems > 0 
        ? Math.round((latestProgress.processedItems / latestProgress.totalItems) * 100) 
        : 0;
    }
    
    // Ensure percentage is a number and between 0-100
    percentage = Number(percentage) || 0;
    percentage = Math.max(0, Math.min(100, percentage));

    return {
      ...latestProgress,
      percentage,
    };
  }

  /**
   * Subscribe to progress updates
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    this.eventEmitter.on('progress', callback);
    return () => {
      this.eventEmitter.off('progress', callback);
    };
  }

  /**
   * Listen for a specific event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
    return () => {
      this.eventEmitter.off(event, callback);
    };
  }

  /**
   * Clean up old progress data
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupOldProgress(maxAge = 24 * 60 * 60 * 1000) { // Default: 24 hours
    const now = Date.now();
    
    for (const [progressId, progress] of this.progressMap.entries()) {
      // Remove if older than maxAge
      if (now - progress.lastUpdate > maxAge) {
        this.progressMap.delete(progressId);
        logger.debug(`Removed old progress data for ${progressId}`);
      }
    }
  }
}

// Create a singleton instance
const rekonProgressService = new RekonProgressService();

// Setup periodic cleanup
setInterval(() => {
  rekonProgressService.cleanupOldProgress();
}, 60 * 60 * 1000); // Run every hour

module.exports = rekonProgressService;