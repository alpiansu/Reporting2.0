/**
 * Unified Progress Service for Rekon WT Harian
 * Combines progress tracking, SSE communication, and concurrency control
 */
import EventEmitter from 'events';
import logger from '../../config/logger.js';
import jwt from '../../config/jwt.js';
import config from '../../config/rekon_wt_harian.config.js';

class ProgressService {
  constructor() {
    // Progress tracking
    this.progressMap = new Map();
    this.eventEmitter = new EventEmitter();
    
    // SSE clients management
    this.clients = new Map();
    this.initialized = false;
    
    // Concurrency limits
    this.BRANCH_CONCURRENCY_LIMIT = config.parallelProcessing?.branchConcurrencyLimit || 3;
    this.STORE_CONCURRENCY_LIMIT = config.parallelProcessing?.concurrencyLimit || 5;
    this.MAX_WAVES = config.parallelProcessing?.maxWaves || 3;
  }

  // ==================== PROGRESS TRACKING ====================
  
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
      currentBranch: cab,
    });

    logger.info(`Initialized progress tracking for ${cab} ${periode} with ID ${progressId}`);
    return progressId;
  }

  /**
   * Update progress for a reconciliation process
   * @param {string} progressId - Progress ID
   * @param {Object} update - Progress update
   */
  updateProgress(progressId, update) {
    const progress = this.progressMap.get(progressId);
    if (!progress) {
      logger.warn(`Progress not found for ID: ${progressId}`);
      return;
    }

    // Update progress data
    Object.assign(progress, update, { lastUpdate: Date.now() });
    
    // Calculate percentage if not provided
    if (!update.percentage && progress.totalItems > 0) {
      progress.percentage = Math.round((progress.processedItems / progress.totalItems) * 100);
    }

    // Ensure frontend-expected fields are present
    if (!progress.currentBranch && progress.cab) {
      progress.currentBranch = progress.cab;
    }
    
    // Extract current store info from details if available
    if (progress.details && progress.details.currentStore) {
      progress.currentItem = progress.details.currentStore;
    }
    
    // Extract total differences from details if available
    if (progress.details && progress.details.totalDifferences !== undefined) {
      progress.totalDifferences = progress.details.totalDifferences;
    }

    // Emit progress event for SSE
    this.eventEmitter.emit(`progress:${progressId}`, progress);
    
    // Broadcast to SSE clients
    this.broadcastProgress(progressId, progress);

    logger.debug(`Progress updated for ${progressId}: ${progress.percentage}%`);
  }

  /**
   * Get progress data
   * @param {string} progressId - Progress ID
   * @returns {Object|null} Progress data
   */
  getProgress(progressId) {
    return this.progressMap.get(progressId) || null;
  }

  /**
   * Get latest progress for a branch and period
   * @param {string} cab - Branch code
   * @param {string} periode - Period
   * @returns {Object|null} Latest progress data
   */
  getLatestProgress(cab, periode) {
    const progressId = `${cab}_${periode}`;
    return this.getProgress(progressId);
  }

  /**
   * Get active process for a branch and period
   * @param {string} cab - Branch code
   * @param {string} periode - Period
   * @returns {Object|null} Active process data
   */
  getActiveProcess(cab, periode) {
    const progressId = `${cab}_${periode}`;
    const progress = this.getProgress(progressId);
    return progress && progress.status === 'running' ? progress : null;
  }

  /**
   * Check if there is any active reconciliation process running
   * @returns {Object|null} Any active process data
   */
  getAnyActiveProcess() {
    for (const [progressId, progress] of this.progressMap) {
      if (progress.status === 'running') {
        return progress;
      }
    }
    return null;
  }

  /**
   * Complete progress tracking
   * @param {string} progressId - Progress ID
   * @param {Object} finalData - Final completion data
   */
  completeProgress(progressId, finalData = {}) {
    const progress = this.progressMap.get(progressId);
    if (!progress) return;

    progress.status = 'completed';
    progress.endTime = Date.now();
    progress.percentage = 100;
    Object.assign(progress, finalData);

    this.eventEmitter.emit(`progress:${progressId}`, progress);
    this.broadcastProgress(progressId, progress);

    logger.info(`Progress completed for ${progressId}`);
  }

  /**
   * Mark progress as failed
   * @param {string} progressId - Progress ID
   * @param {string} error - Error message
   */
  failProgress(progressId, error) {
    const progress = this.progressMap.get(progressId);
    if (!progress) return;

    progress.status = 'failed';
    progress.endTime = Date.now();
    progress.errors.push(error);

    this.eventEmitter.emit(`progress:${progressId}`, progress);
    this.broadcastProgress(progressId, progress);

    logger.error(`Progress failed for ${progressId}: ${error}`);
  }

  /**
   * Clean up old progress data
   */
  cleanupOldProgress() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [progressId, progress] of this.progressMap.entries()) {
      if (now - progress.lastUpdate > maxAge) {
        this.progressMap.delete(progressId);
        logger.debug(`Removed old progress data for ${progressId}`);
      }
    }
  }

  // ==================== SSE COMMUNICATION ====================

  /**
   * Initialize progress service
   */
  initialize() {
    if (this.initialized) {
      logger.info("Progress update service already initialized");
      return;
    }

    try {
      this.initialized = true;
      logger.info("Progress service initialized");
    } catch (error) {
      logger.error(`Error initializing progress service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribe client to progress updates
   * @param {string} clientId - Client ID
   * @param {string} progressId - Progress ID to subscribe to
   */
  subscribeToProgress(clientId, progressId) {
    const clientData = this.clients.get(clientId);
    if (!clientData) return;

    // Add to client's subscriptions
    clientData.subscriptions.add(progressId);
    logger.info(`Client ${clientId} subscribed to progress ${progressId}`);

    // Get current progress if available
    const currentProgress = this.getProgress(progressId);
    if (currentProgress && clientData.response) {
      this.sendToClient(clientData.response, currentProgress);
    }

    // Listen for progress updates
    this.eventEmitter.on(`progress:${progressId}`, progressData => {
      if (clientData.response && clientData.subscriptions.has(progressId)) {
        this.sendToClient(clientData.response, progressData);
      }
    });
  }

  /**
   * Send data to SSE client
   * @param {Object} res - Response object
   * @param {Object} data - Data to send
   */
  sendToClient(res, data) {
    try {
      // Wrap progress data in the format expected by frontend
      const wrappedData = {
        type: 'progress',
        data: {
          ...data,
          // Ensure required fields are present
          processedItems: data.processedItems || 0,
          totalItems: data.totalItems || 0,
          percentage: data.percentage || 0,
          status: data.status || 'running',
          message: data.message || '',
          details: data.details || {}
        }
      };
      res.write(`data: ${JSON.stringify(wrappedData)}\n\n`);
    } catch (error) {
      logger.error(`Error sending SSE data: ${error.message}`);
    }
  }

  /**
   * Broadcast progress to all subscribed clients
   * @param {string} progressId - Progress ID
   * @param {Object} progressData - Progress data
   */
  broadcastProgress(progressId, progressData) {
    for (const [clientId, clientData] of this.clients.entries()) {
      if (clientData.subscriptions.has(progressId) && clientData.response) {
        this.sendToClient(clientData.response, progressData);
      }
    }
  }

  // ==================== CONCURRENCY CONTROL ====================

  /**
   * Process items with controlled concurrency
   * @param {Array} items - Items to process
   * @param {number} concurrencyLimit - Maximum concurrent operations
   * @param {Function} processor - Processing function
   * @returns {Promise<Array>} Results
   */
  async processConcurrent(items, concurrencyLimit, processor) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }

    return Promise.allSettled(results);
  }

  /**
   * Process stores with concurrency control
   * @param {Array} stores - Stores to process
   * @param {number} concurrencyLimit - Concurrency limit
   * @param {Function} processor - Store processor function
   * @returns {Promise<Array>} Results
   */
  async processConcurrentStores(stores, concurrencyLimit, processor) {
    return this.processConcurrent(stores, concurrencyLimit, processor);
  }

  /**
   * Process branches with concurrency control
   * @param {Array} branches - Branches to process
   * @param {Function} processor - Branch processor function
   * @returns {Promise<Array>} Results
   */
  async processConcurrentBranches(branches, processor) {
    return this.processConcurrent(branches, this.BRANCH_CONCURRENCY_LIMIT, processor);
  }
}

// Create singleton instance
const progressService = new ProgressService();

// Setup periodic cleanup
setInterval(() => {
  progressService.cleanupOldProgress();
}, 60 * 60 * 1000); // Run every hour

export default progressService;