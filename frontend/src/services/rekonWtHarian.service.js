import api from "./api";
import { EventSourcePolyfill } from "event-source-polyfill";

/**
 * Service for WT Harian reconciliation
 */
export default {
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
    const apiUrl = import.meta.env.VITE_API_URL;
    console.log('Creating SSE connection for progress ID:', progressId);
    console.log('SSE URL:', `${apiUrl}/rekon-wt-harian/sse/progress-updates/${progressId}`);

    // Get auth token
    const token = localStorage.getItem("token");

    // Create SSE connection with authorization header
    const sseUrl = `${apiUrl}/rekon-wt-harian/sse/progress-updates/${progressId}`;
    const eventSource = new EventSourcePolyfill(sseUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatTimeout: 60000, // 60 seconds
    });

    console.log('SSE connection options:', {
      heartbeatTimeout: 60000,
      headers: 'Auth headers included (not shown for security)',
      timestamp: new Date().toISOString()
    });

    eventSource.onopen = () => {
      console.log("SSE connection opened successfully for progress ID:", progressId, "at", new Date().toISOString());
    };

    // No need to send subscription message as the endpoint is already specific to the progressId

    eventSource.onmessage = event => {
      try {
        console.log('SSE message received at', new Date().toISOString(), ':', event.data);
        const data = JSON.parse(event.data);
        console.log('Parsed SSE data:', data);
        if (onMessage && typeof onMessage === "function") {
          onMessage(data);
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    // Handle heartbeat messages (empty comments)
    eventSource.addEventListener('heartbeat', event => {
      console.log("Heartbeat received at", new Date().toISOString());
    });

    // Listen for specific message types
    eventSource.addEventListener('progress', event => {
      console.log('Progress event received at', new Date().toISOString());
    });

    eventSource.addEventListener('connected', event => {
      console.log('Connected event received at', new Date().toISOString());
    });

    eventSource.addEventListener('error', event => {
      console.log('Error event received at', new Date().toISOString());
    });

    eventSource.onerror = error => {
      console.error("SSE connection error:", error);
      console.error('Error details:', {
        type: error.type,
        target: error.target ? 'EventSource' : 'Unknown',
        timestamp: new Date().toISOString()
      });
      if (error && error.message) {
        console.error('Error message:', error.message);
      }
      // Auto-reconnect is handled by EventSourcePolyfill
      // But we can add additional error handling if needed
    };

    // Return the EventSource with a custom close method for consistency
    return {
      ...eventSource,
      close: () => {
        console.log("Closing SSE connection");
        eventSource.close();
      },
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
