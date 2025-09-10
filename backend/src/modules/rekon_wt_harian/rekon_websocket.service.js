// Menggunakan HTTP server untuk komunikasi karena ws tidak tersedia
import http from 'http';
import logger from '../../config/logger.js';
import rekonProgressService from './rekon_progress.service.js';
import jwt from '../../config/jwt.js';

class RekonWebSocketService {
  constructor() {
    this.server = null;
    this.clients = new Map(); // Map to track clients and their subscriptions
    this.initialized = false;
    this.eventSource = {}; // Untuk menyimpan event source connections
  }

  /**
   * Initialize SSE service (endpoint is now defined in routes)
   * @param {Object} app - Express app instance
   */
  initialize(app) {
    if (this.initialized) {
      logger.info("Progress update service already initialized");
      return;
    }

    try {
      // SSE endpoint is now defined in routes file
      // This service only handles the business logic for SSE connections
      
      this.initialized = true;
      logger.info("SSE service initialized for progress updates");
    } catch (error) {
      logger.error(`Error initializing SSE service: ${error.message}`);
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
    const currentProgress = rekonProgressService.getProgress(progressId);
    if (currentProgress && clientData.response) {
      clientData.response.write(
        `data: ${JSON.stringify({
          type: "progress",
          data: currentProgress,
        })}\n\n`
      );
    }

    // Set up listener for this specific progress ID
    rekonProgressService.on(`progress:${progressId}`, progressData => {
      this.sendProgressUpdate(clientId, progressId, progressData);
    });
  }

  /**
   * Send progress update to client
   * @param {string} clientId - Client ID
   * @param {string} progressId - Progress ID
   * @param {Object} progressData - Progress data
   */
  sendProgressUpdate(clientId, progressId, progressData) {
    const clientData = this.clients.get(clientId);
    if (!clientData || !clientData.response) return;

    if (clientData.subscriptions.has(progressId)) {
      try {
        // Ensure we're sending percentage as a number between 0-100
        let percentage = progressData.percentage;
        
        // If percentage is not provided or is 0 but we have processed items, calculate it
        if ((percentage === undefined || percentage === 0) && progressData.processedItems > 0) {
          percentage = progressData.totalItems > 0 ? 
            Math.round((progressData.processedItems / progressData.totalItems) * 100) : 0;
        }
        
        // Ensure percentage is a number
        percentage = Number(percentage) || 0;
        
        // Ensure percentage is between 0-100
        percentage = Math.max(0, Math.min(100, percentage));
        
        // Create a clean copy of progress data with percentage
        const cleanProgressData = {
          ...progressData,
          percentage: percentage,
          // Ensure these fields are always numbers
          processedItems: Number(progressData.processedItems) || 0,
          totalItems: Number(progressData.totalItems) || 0,
          // Include status and message
          status: progressData.status || 'running',
          message: progressData.message || '',
          // Wave information removed
          // Include branch and item information
          currentBranch: progressData.currentBranch || '',
          currentItem: progressData.currentItem || ''
        };
        
        // Send formatted progress data
        clientData.response.write(
          `data: ${JSON.stringify({
            type: "progress",
            progressId,
            data: cleanProgressData,
          })}\n\n`
        );

        // Log progress update for debugging
        logger.debug(`Progress update sent to client ${clientId}: ${percentage}% (${cleanProgressData.processedItems}/${cleanProgressData.totalItems})`);
      } catch (error) {
        logger.error(`Error sending progress update to client ${clientId}: ${error.message}`);
        logger.error(`Progress data that caused error: ${JSON.stringify(progressData)}`);
        // Remove client if connection is broken
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Send message to a client
   * @param {string} clientId - Client ID
   * @param {Object} data - Message data
   */
  sendToClient(clientId, data) {
    const clientData = this.clients.get(clientId);
    if (!clientData || !clientData.response) return;

    try {
      clientData.response.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}: ${error.message}`);
      // Remove client if connection is broken
      this.clients.delete(clientId);
    }
  }

  /**
   * Send error message to a client
   * @param {string} clientId - Client ID
   * @param {string} message - Error message
   */
  sendErrorToClient(clientId, message) {
    this.sendToClient(clientId, {
      type: "error",
      message,
    });
  }

  /**
   * Broadcast progress update to subscribed clients
   * @param {string} progressId - Progress ID
   * @param {Object} progressData - Progress data
   */
  broadcastProgress(progressId, progressData) {
    this.clients.forEach((clientData, ws) => {
      if (clientData.subscriptions.has(progressId)) {
        this.sendToClient(ws, {
          type: "progress",
          progressId,
          data: progressData,
        });
      }
    });
  }

  /**
   * Close WebSocket server
   */
  close() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      this.clients.clear();
      this.initialized = false;
      logger.info("WebSocket server closed");
    }
  }
}

export default new RekonWebSocketService();
