import api from "./api";
import { EventSourcePolyfill } from 'event-source-polyfill';

/**
 * Service for WT Harian reconciliation
 */
export default {
  /**
   * Get reconciliation progress
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  getProgress(progressId) {
    return api.get(`/rekon-wt-harian/progress/${progressId}`);
  },

  /**
   * Get latest reconciliation progress
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  getLatestProgress(cab, periode) {
    // If cab is empty, use 'All' as default value
    const cabParam = cab || "All";
    return api.get(`/rekon-wt-harian/latest-progress/${cabParam}/${periode}`);
  },

  /**
   * Create Server-Sent Events connection for real-time progress updates
   * @param {String} progressId - Progress ID to subscribe to
   * @param {Function} onMessage - Callback function for progress updates
   * @returns {EventSource} - SSE connection
   */
  createProgressWebSocket(progressId, onMessage) {
    // Get the API URL
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    
    // Get auth token
    const token = localStorage.getItem("token");
    
    // Create SSE connection with authorization header
    const sseUrl = `${apiUrl}/rekon-wt-harian/progress-updates/${progressId}`;
    const eventSource = new EventSourcePolyfill(sseUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    eventSource.onopen = () => {
      console.log("SSE connection established");
    };
    
    // No need to send subscription message as the endpoint is already specific to the progressId
     
     eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage && typeof onMessage === "function") {
          onMessage(data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      // Auto-reconnect is handled by the browser for SSE
    };
    
    // Return the EventSource with a custom close method for consistency
    return {
      ...eventSource,
      close: () => {
        console.log("Closing SSE connection");
        eventSource.close();
      }
    };
  },
  /**
   * Start reconciliation process
   * @param {Object} data - Contains cab and periode
   * @returns {Promise}
   */
  startReconciliation(data) {
    return api.post("/rekon-wt-harian", data);
  },

  /**
   * Get reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @param {Object} params - Query parameters (page, limit, tipe, toko, tgl1, sortColumn, sortOrder)
   * @returns {Promise}
   */
  getResults(cab, periode, params = {}) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "All";
    return api.get(`/rekon-wt-harian/${periode}/${cabParam}`, { params });
  },

  /**
   * Get summary of reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  getSummary(cab, periode) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "SEMUA";
    return api.get(`/rekon-wt-harian/${cabParam}/${periode}/summary`);
  },

  /**
   * Delete reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  deleteResults(cab, periode) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "SEMUA";
    return api.delete(`/rekon-wt-harian/${cabParam}/${periode}`);
  },
};
