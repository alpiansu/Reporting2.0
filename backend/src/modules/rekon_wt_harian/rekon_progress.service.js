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
    // Wave tracking
    currentWave: 1,
    maxWaves: maxWaves,
    waveProgress: {},
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

  // Update wave information if provided
  if (update.currentWave && update.currentWave !== progress.currentWave) {
    // Store progress for the previous wave
    updatedProgress.waveProgress[progress.currentWave] = {
      processedItems: progress.processedItems,
      totalItems: progress.totalItems,
      completedAt: Date.now()
    };
    
    // Update current wave
    updatedProgress.currentWave = update.currentWave;
    
    logger.info(`Progress ${progressId} moved to wave ${update.currentWave} of ${updatedProgress.maxWaves}`);
  }

  this.progressMap.set(progressId, updatedProgress);

  // Calculate percentage if not provided, accounting for waves
  let percentage = update.percentage;
  if (percentage === undefined) {
    // Adjust percentage calculation to account for multiple waves
    // Each wave gets an equal portion of the progress bar
    const waveSize = 100 / updatedProgress.maxWaves;
    const basePercentage = (updatedProgress.currentWave - 1) * waveSize;
    
    // Calculate percentage within current wave
    const wavePercentage = updatedProgress.totalItems > 0 
      ? (updatedProgress.processedItems / updatedProgress.totalItems) * waveSize 
      : 0;
    
    percentage = Math.round(basePercentage + wavePercentage);
    
    // Log detailed percentage calculation for debugging
    logger.debug(`Percentage calculation: ${updatedProgress.currentWave}/${updatedProgress.maxWaves} waves, ` +
      `base=${basePercentage.toFixed(2)}%, wave=${wavePercentage.toFixed(2)}%, total=${percentage}%`);
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

  logger.debug(`Updated progress for ${progressId}: ${percentage}% (Wave ${updatedProgress.currentWave}/${updatedProgress.maxWaves}, ${updatedProgress.processedItems}/${updatedProgress.totalItems})`);
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

module.exports = rekonProgressService;