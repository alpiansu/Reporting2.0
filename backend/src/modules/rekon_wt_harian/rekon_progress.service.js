/**
 * Service for tracking reconciliation progress
 */
import EventEmitter from 'events';
import logger from '../../config/logger.js';

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
 * @param {number} maxWaves - Maximum number of waves for retry mechanism
 * @returns {string} - Progress ID
 */
initProgress(cab, periode, totalItems, maxWaves = 3) {
  const progressId = `${cab}_${periode}`;
  
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
    // Wave tracking removed
    currentBranch: cab, // Track current branch being processed
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
 * @param {number} update.currentWave - Current wave number
 * @param {string} update.currentBranch - Current branch being processed
 * @param {string} update.currentItem - Current item being processed
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

  // Wave information update removed

  this.progressMap.set(progressId, updatedProgress);

  // Calculate percentage if not provided, based on processed items and failed items
  let percentage = update.percentage;
  if (percentage === undefined) {
    // Percentage calculation based on successfully processed items + permanently failed items
    // This ensures progress doesn't get stuck at 33%
    const processedCount = updatedProgress.processedItems || 0;
    const permanentlyFailedCount = updatedProgress.permanentlyFailedItems || 0;
    const totalProcessed = processedCount + permanentlyFailedCount;
    
    percentage = updatedProgress.totalItems > 0 
      ? Math.round((totalProcessed / updatedProgress.totalItems) * 100) 
      : 0;
    
    // Log percentage calculation for debugging
    logger.debug(`Percentage calculation: (${processedCount} processed + ${permanentlyFailedCount} failed)/${updatedProgress.totalItems} items, total=${percentage}%`);
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
    
    // Always calculate percentage based on processed items vs total items
    // This ensures consistency with the updateProgress method
    let percentage = progress.totalItems > 0 
      ? Math.round((progress.processedItems / progress.totalItems) * 100) 
      : 0;
    
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

    // Always calculate percentage based on processed items vs total items
    // This ensures consistency with the updateProgress method
    let percentage = latestProgress.totalItems > 0 
      ? Math.round((latestProgress.processedItems / latestProgress.totalItems) * 100) 
      : 0;
    
    // Ensure percentage is a number and between 0-100
    percentage = Number(percentage) || 0;
    percentage = Math.max(0, Math.min(100, percentage));

    return {
      ...latestProgress,
      percentage,
    };
  }

  /**
   * Check if there is an active reconciliation process for a branch and period
   * @param {string} cab - Branch code
   * @param {string} periode - Period in YYMM format
   * @returns {Object|null} - Active progress object or null if none
   */
  getActiveProcess(cab, periode) {
    // For 'All' cabang, check if any process is running for this period
    if (cab === 'All') {
      for (const [_, progress] of this.progressMap.entries()) {
        if (progress.periode === periode && (progress.status === 'running' || progress.status === 'pending')) {
          return progress;
        }
      }
      return null;
    }
    
    // For specific cabang, check if any process is running for this cabang and period
    for (const [_, progress] of this.progressMap.entries()) {
      if ((progress.cab === cab || progress.cab === 'All') && 
          progress.periode === periode && 
          (progress.status === 'running' || progress.status === 'pending')) {
        return progress;
      }
    }
    
    return null;
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

export default rekonProgressService;