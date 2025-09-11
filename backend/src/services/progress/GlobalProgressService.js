/**
 * Global Progress Service
 * Universal progress tracking service that can be used by any module
 * Provides SSE communication, progress tracking, and real-time updates
 */
import EventEmitter from 'events';
import logger from '../../config/logger.js';
import jwt from 'jsonwebtoken';

class GlobalProgressService {
  constructor() {
    // Progress tracking
    this.progressMap = new Map();
    this.eventEmitter = new EventEmitter();
    
    // SSE clients management
    this.clients = new Map();
    this.initialized = false;
  }

  // ==================== PROGRESS TRACKING ====================
  
  /**
   * Initialize progress tracking for any process
   * @param {string} processType - Type of process (e.g., 'rekon_wt_harian', 'sales_report', etc.)
   * @param {string} identifier - Unique identifier for the process (e.g., 'All_2507', 'branch_001_2507')
   * @param {number} totalItems - Total number of items to process
   * @param {Object} metadata - Additional metadata for the process
   * @returns {string} - Progress ID
   */
  initProgress(processType, identifier, totalItems, metadata = {}) {
    const progressId = `${processType}_${identifier}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.progressMap.set(progressId, {
      id: progressId,
      processType,
      identifier,
      totalItems,
      processedItems: 0,
      completedItems: 0,
      percentage: 0,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      errors: [],
      message: 'Initializing...',
      details: {},
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString()
      }
    });

    logger.info(`Progress initialized: ${progressId} for ${processType}`);
    return progressId;
  }

  /**
   * Update progress data
   * @param {string} progressId - Progress ID
   * @param {Object} update - Update data
   */
  updateProgress(progressId, update) {
    const progress = this.progressMap.get(progressId);
    if (!progress) {
      logger.warn(`Progress not found for ID: ${progressId}`);
      return;
    }

    // Update progress data
    Object.assign(progress, update, { lastUpdate: Date.now() });
    
    // Calculate percentage if not provided and we have processedItems
    if (update.processedItems !== undefined && progress.totalItems > 0) {
      progress.percentage = Math.round((progress.processedItems / progress.totalItems) * 100);
    }

    // Update metadata
    if (update.metadata) {
      progress.metadata = {
        ...progress.metadata,
        ...update.metadata,
        updatedAt: new Date().toISOString()
      };
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
   * Get latest progress for a process type and identifier
   * @param {string} processType - Type of process
   * @param {string} identifier - Process identifier
   * @returns {Object|null} Latest progress data or null if not found
   */
  getLatestProgress(processType, identifier) {
    let latestProgress = null;
    let latestTime = 0;

    for (const [progressId, progress] of this.progressMap.entries()) {
      if (
        progress.processType === processType &&
        progress.identifier === identifier
      ) {
        const progressTime = progress.metadata?.updatedAt ? new Date(progress.metadata.updatedAt).getTime() : (progress.metadata?.createdAt ? new Date(progress.metadata.createdAt).getTime() : progress.startTime);
        if (progressTime > latestTime) {
          latestTime = progressTime;
          latestProgress = progress;
        }
      }
    }

    return latestProgress;
  }

  /**
   * Get active process for a process type
   * @param {string} processType - Type of process
   * @param {string} identifier - Optional process identifier
   * @returns {Object|null} Active progress data or null if not found
   */
  getActiveProcess(processType, identifier = null) {
    for (const [progressId, progress] of this.progressMap.entries()) {
      if (
        progress.processType === processType &&
        progress.status === 'running' &&
        (identifier === null || progress.identifier === identifier)
      ) {
        return progress;
      }
    }

    return null;
  }

  /**
   * Get any active process for a process type
   * @param {string} processType - Process type
   * @returns {Object|null} Any active progress data
   */
  getAnyActiveProcess(processType) {
    for (const [progressId, progress] of this.progressMap.entries()) {
      if (progress.processType === processType && progress.status === 'running') {
        return progress;
      }
    }
    return null;
  }

  /**
   * Get all active processes regardless of process type
   * @returns {Array} Array of active progress data
   */
  getAllActiveProcesses() {
    const activeProcesses = [];
    for (const [progressId, progress] of this.progressMap.entries()) {
      if (progress.status === 'running') {
        activeProcesses.push(progress);
      }
    }
    return activeProcesses;
  }

  /**
   * Check if there are any active processes regardless of process type
   * @returns {Object|null} First active process found or null
   */
  hasAnyActiveProcess() {
    for (const [progressId, progress] of this.progressMap.entries()) {
      if (progress.status === 'running') {
        return progress;
      }
    }
    return null;
  }

  /**
   * Unsubscribe from progress updates
   * @param {string} progressId - Progress ID
   * @param {Object} response - Express response object
   */
  unsubscribeFromProgress(progressId, response) {
    if (this.clients.has(progressId)) {
      const clientSet = this.clients.get(progressId);
      clientSet.delete(response);
      
      // Remove the set if it's empty
      if (clientSet.size === 0) {
        this.clients.delete(progressId);
      }
    }
  }

  /**
   * Complete progress
   * @param {string} progressId - Progress ID
   * @param {Object} finalData - Final data
   */
  completeProgress(progressId, finalData = {}) {
    const progress = this.progressMap.get(progressId);
    if (!progress) {
      logger.warn(`Progress not found for completion: ${progressId}`);
      return;
    }

    progress.status = 'completed';
    progress.endTime = Date.now();
    progress.percentage = 100;
    progress.processedItems = progress.totalItems;
    progress.completedItems = progress.totalItems;
    Object.assign(progress, finalData);

    this.broadcastProgress(progressId, progress);
    logger.info(`Progress completed: ${progressId}`);
  }

  /**
   * Fail progress
   * @param {string} progressId - Progress ID
   * @param {string|Error} error - Error message or object
   */
  failProgress(progressId, error) {
    const progress = this.progressMap.get(progressId);
    if (!progress) {
      logger.warn(`Progress not found for failure: ${progressId}`);
      return;
    }

    progress.status = 'failed';
    progress.endTime = Date.now();
    progress.errors.push({
      message: error.message || error,
      timestamp: Date.now()
    });

    this.broadcastProgress(progressId, progress);
    logger.error(`Progress failed: ${progressId} - ${error.message || error}`);
  }

  /**
   * Clean up completed or failed progress entries older than specified time
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   */
  cleanupOldProgress(maxAgeMs = 60 * 60 * 1000) {
    const now = Date.now();
    const toDelete = [];

    for (const [progressId, progress] of this.progressMap.entries()) {
      if (
        (progress.status === 'completed' || progress.status === 'failed') &&
        (now - (progress.metadata?.updatedAt ? new Date(progress.metadata.updatedAt).getTime() : (progress.metadata?.createdAt ? new Date(progress.metadata.createdAt).getTime() : progress.startTime))) > maxAgeMs
      ) {
        toDelete.push(progressId);
      }
    }

    toDelete.forEach(progressId => {
      this.progressMap.delete(progressId);
      // Clean up any remaining SSE clients
      if (this.clients.has(progressId)) {
        this.clients.delete(progressId);
      }
    });

    if (toDelete.length > 0) {
      logger.info(`Cleaned up ${toDelete.length} old progress entries`);
    }
  }

  // ==================== SSE COMMUNICATION ====================

  /**
   * Initialize SSE service
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    logger.info('Global Progress Service initialized');
  }

  /**
   * Subscribe client to progress updates
   * @param {string} clientId - Client ID
   * @param {string} progressId - Progress ID to subscribe to
   */
  subscribeToProgress(clientId, progressId) {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn(`Client not found: ${clientId}`);
      return;
    }

    client.subscriptions.add(progressId);
    
    // Send current progress if it exists
    const currentProgress = this.getProgress(progressId);
    if (currentProgress) {
      this.sendToClient(client.response, currentProgress);
    }

    logger.info(`Client ${clientId} subscribed to progress ${progressId}`);
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
          details: data.details || {},
          metadata: data.metadata || {}
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

  /**
   * Create SSE route handler
   * @param {Function} authenticateSSE - Authentication middleware
   * @returns {Function} Route handler
   */
  createSSEHandler(authenticateSSE) {
    return (req, res) => {
      const progressId = req.params.progressId;

      // Set headers untuk SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.flushHeaders();

      // Kirim event awal
      res.write(`data: ${JSON.stringify({ type: "connected", progressId })}\n\n`);
      
      // Implement heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        res.write(":heartbeat\n\n");
      }, 30000); // Send heartbeat every 30 seconds

      // Simpan connection
      const clientId = `client-${Date.now()}`;
      this.clients.set(clientId, {
        id: clientId,
        response: res,
        subscriptions: new Set([progressId]),
        connectedAt: Date.now(),
        heartbeatInterval: heartbeatInterval
      });

      // Subscribe ke progress events
      this.subscribeToProgress(clientId, progressId);

      // Handle client disconnect
      req.on("close", () => {
        // Clear heartbeat interval when client disconnects
        if (this.clients.get(clientId)?.heartbeatInterval) {
          clearInterval(this.clients.get(clientId).heartbeatInterval);
        }
        this.clients.delete(clientId);
      });
    };
  }

  // ==================== CLIENT MANAGEMENT ====================
  
  /**
   * Add SSE client
   * @param {string} clientId - Client ID
   * @param {Object} clientData - Client data
   */
  addClient(clientId, clientData) {
    this.clients.set(clientId, clientData);
    logger.debug(`SSE client added: ${clientId}`);
  }

  /**
   * Get SSE client
   * @param {string} clientId - Client ID
   * @returns {Object} Client data
   */
  getClient(clientId) {
    return this.clients.get(clientId);
  }

  /**
   * Remove SSE client
   * @param {string} clientId - Client ID
   */
  removeClient(clientId) {
    const removed = this.clients.delete(clientId);
    if (removed) {
      logger.debug(`SSE client removed: ${clientId}`);
    }
    return removed;
  }
}

// Create singleton instance
const globalProgressService = new GlobalProgressService();

// Auto cleanup old progress every hour
setInterval(() => {
  globalProgressService.cleanupOldProgress();
}, 60 * 60 * 1000); // Run every hour

export default globalProgressService;