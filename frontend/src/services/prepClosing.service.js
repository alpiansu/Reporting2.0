import api from "./api";
import { EventSourcePolyfill } from "event-source-polyfill";

/**
 * Service for Prep Closing operations
 */
export default {
  /**
   * Start screening pra closing process
   * @param {String} strCab - Branch code
   * @param {String} strMonth - Month (2 digits)
   * @param {String} strYear - Year (4 digits)
   * @returns {Promise}
   */
  startScreening(strCab, strMonth, strYear) {
    return api.post('/prep-closing/screening', {
      strCab,
      strMonth,
      strYear
    });
  },

  /**
   * Get screening progress by progress ID
   * @param {String} progressId - Progress ID
   * @returns {Promise}
   */
  getProgress(progressId) {
    return api.get(`/prep-closing/progress/${progressId}`);
  },

  /**
   * Get latest screening progress
   * @param {String} cab - Branch code
   * @param {String} periode - Period in YYYYMM format
   * @returns {Promise}
   */
  getLatestProgress(cab, periode) {
    return api.get(`/prep-closing/progress/${cab}/${periode}`);
  },

  /**
   * Get screening results with pagination
   * @param {String} cab - Branch code
   * @param {String} periode - Period in YYYYMM format
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise}
   */
  getResults(cab, periode, params = {}) {
    const queryParams = new URLSearchParams({
      cab: cab || '',
      periode: periode || '',
      ...params
    });
    return api.get(`/prep-closing?${queryParams}`);
  },

  /**
   * Get screening summary
   * @param {String} cab - Branch code
   * @param {String} periode - Period in YYYYMM format
   * @returns {Promise}
   */
  getSummary(cab, periode) {
    return api.get(`/prep-closing/stats?cab=${cab}&periode=${periode}`);
  },

  /**
   * Connect to SSE progress stream
   * @param {String} progressId - Progress ID
   * @param {Function} onMessage - Message handler function
   * @param {Function} onError - Error handler function
   * @param {Function} onOpen - Open handler function
   * @returns {EventSource} EventSource instance
   */
  connectToProgressStream(progressId, onMessage, onError, onOpen) {
    const token = localStorage.getItem('token');
    const url = `${api.defaults.baseURL}/prep-closing/progress/stream/${progressId}`;
    
    const eventSource = new EventSourcePolyfill(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      heartbeatTimeout: 120000,
      retryDelayMs: 3000
    });

    if (onOpen) {
      eventSource.onopen = onOpen;
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) {
          onMessage(data);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
        if (onError) {
          onError(error);
        }
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (onError) {
        onError(error);
      }
    };

    return eventSource;
  },

  /**
   * Check if there's an existing screening process
   * @param {String} cab - Branch code
   * @param {String} periode - Period in YYYYMM format
   * @returns {Promise}
   */
  checkExistingProcess(cab, periode) {
    return this.getLatestProgress(cab, periode);
  }
};