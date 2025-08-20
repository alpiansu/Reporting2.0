// Menggunakan HTTP server untuk komunikasi karena ws tidak tersedia
const http = require("http");
const logger = require("../../config/logger");
const rekonProgressService = require("./rekon_progress.service");

class RekonWebSocketService {
  constructor() {
    this.server = null;
    this.clients = new Map(); // Map to track clients and their subscriptions
    this.initialized = false;
    this.eventSource = {}; // Untuk menyimpan event source connections
  }

  /**
   * Initialize SSE endpoint for progress updates
   * @param {Object} app - Express app instance
   */
  initialize(app) {
    if (this.initialized) {
      logger.info("Progress update server already initialized");
      return;
    }

    try {
      // Custom authentication middleware for SSE
      const authenticateSSE = (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          res.setHeader("Content-Type", "text/event-stream");
          res.status(401);
          res.write(`data: ${JSON.stringify({ error: "Authorization header missing" })}\n\n`);
          return res.end();
        }

        const parts = authHeader.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer") {
          res.setHeader("Content-Type", "text/event-stream");
          res.status(401);
          res.write(`data: ${JSON.stringify({ error: "Invalid authorization format" })}\n\n`);
          return res.end();
        }

        const token = parts[1];
        const { jwt } = require("../../config");
        const decoded = jwt.verifyToken(token);

        if (!decoded) {
          res.setHeader("Content-Type", "text/event-stream");
          res.status(401);
          res.write(`data: ${JSON.stringify({ error: "Invalid or expired token" })}\n\n`);
          return res.end();
        }

        req.user = decoded;
        next();
      };

      // Gunakan endpoint HTTP untuk SSE (Server-Sent Events)
      app.get("/api/rekon-wt-harian/sse/progress-updates/:progressId", authenticateSSE, (req, res) => {
        const progressId = req.params.progressId;

        // Set headers untuk SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        // Kirim event awal
        res.write(`data: ${JSON.stringify({ type: "connected", progressId })}\n\n`);

        // Simpan connection
        const clientId = `client-${Date.now()}`;
        this.clients.set(clientId, {
          id: clientId,
          response: res,
          subscriptions: new Set([progressId]),
          connectedAt: Date.now(),
        });

        // Subscribe ke progress events
        this.subscribeToProgress(clientId, progressId);

        // Handle client disconnect
        req.on("close", () => {
          logger.info(`SSE client disconnected: ${clientId}`);
          this.clients.delete(clientId);
        });
      });

      this.initialized = true;
      logger.info("SSE endpoints initialized for progress updates");
    } catch (error) {
      logger.error(`Error initializing SSE server: ${error.message}`);
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
        clientData.response.write(
          `data: ${JSON.stringify({
            type: "progress",
            progressId,
            data: progressData,
          })}\n\n`
        );
      } catch (error) {
        logger.error(`Error sending progress update to client ${clientId}: ${error.message}`);
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

module.exports = new RekonWebSocketService();
