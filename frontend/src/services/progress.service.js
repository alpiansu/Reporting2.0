import api from "./api.js";
import { EventSourcePolyfill } from "event-source-polyfill";

/**
 * Progress Service - Handles all progress tracking related API calls
 * Can be used by multiple modules (adjust, export, rekon, etc)
 */
class ProgressService {
  /**
   * Check if progress task exists
   * @param {string} taskId - Task identifier
   * @returns {Promise<boolean>} True if task exists
   */
  async checkProgressTask(taskId) {
    try {
      const response = await api.get("/progress");
      const tasks = response.data.data;
      return !!tasks[taskId];
    } catch (error) {
      console.error("Error checking progress task:", error);
      return false;
    }
  }

  /**
   * Get specific progress task
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object|null>} Task data or null
   */
  async getProgressTask(taskId) {
    try {
      const response = await api.get(`/progress/${taskId}`);
      return response.data.data;
    } catch (error) {
      console.error("Error getting progress task:", error);
      return null;
    }
  }

  /**
   * Get all progress tasks
   * @returns {Promise<Object>} All tasks
   */
  async getAllProgressTasks() {
    try {
      const response = await api.get("/progress");
      return response.data.data;
    } catch (error) {
      console.error("Error getting all progress tasks:", error);
      return {};
    }
  }

  /**
   * Get active progress tasks only
   * @returns {Promise<Array>} Active tasks
   */
  async getActiveProgressTasks() {
    try {
      const response = await api.get("/progress/active");
      return response.data.data;
    } catch (error) {
      console.error("Error getting active progress tasks:", error);
      return [];
    }
  }

  /**
   * Get tasks by module name
   * @param {string} moduleName - Module identifier
   * @returns {Promise<Array>} Module tasks
   */
  async getTasksByModule(moduleName) {
    try {
      const response = await api.get(`/progress/module/${moduleName}`);
      return response.data.data;
    } catch (error) {
      console.error("Error getting module tasks:", error);
      return [];
    }
  }

  /**
   * Get queue status and system capacity
   * @returns {Promise<Object>} Queue status
   */
  async getQueueStatus() {
    try {
      const response = await api.get("/progress/queue");
      return response.data.data;
    } catch (error) {
      console.error("Error getting queue status:", error);
      return null;
    }
  }

  /**
   * Monitor progress of any task using SSE
   * @param {string} taskId - Task identifier
   * @param {Function} onUpdate - Callback when progress updates
   * @param {Function} onComplete - Callback when task completes
   * @param {Function} onError - Callback when task fails
   * @returns {EventSourcePolyfill} - SSE connection instance
   */
  monitorProgress(taskId, onUpdate, onComplete, onError) {
    const apiUrl = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const sseUrl = `${apiUrl}/progress/stream/task/${taskId}`;

    // console.log("🔗 Progress Service - Connecting to SSE:", sseUrl);

    const eventSource = new EventSourcePolyfill(sseUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle different event types specifically
    eventSource.addEventListener("init", event => {
      try {
        const progressData = JSON.parse(event.data);
        // console.log("🎯 Progress INIT event:", progressData);
        if (onUpdate) onUpdate(progressData);
      } catch (error) {
        console.error("❌ Error parsing INIT event:", error);
      }
    });

    eventSource.addEventListener("update", event => {
      try {
        const progressData = JSON.parse(event.data);
        // console.log("🎯 Progress UPDATE event:", progressData);
        if (onUpdate) onUpdate(progressData);
      } catch (error) {
        console.error("❌ Error parsing UPDATE event:", error);
      }
    });

    eventSource.addEventListener("complete", event => {
      try {
        const progressData = JSON.parse(event.data);
        // console.log("🎯 Progress COMPLETE event:", progressData);
        if (onComplete) onComplete(progressData);
        eventSource.close();
      } catch (error) {
        console.error("❌ Error parsing COMPLETE event:", error);
      }
    });

    eventSource.addEventListener("fail", event => {
      try {
        const progressData = JSON.parse(event.data);
        // console.log("🎯 Progress FAIL event:", progressData);
        if (onError) onError(progressData);
        eventSource.close();
      } catch (error) {
        console.error("❌ Error parsing FAIL event:", error);
      }
    });

    // Generic message handler (fallback)
    eventSource.onmessage = event => {
      if (event.data === ": heartbeat") {
        console.log("💓 Progress SSE Heartbeat received");
        return;
      }

      try {
        const progressData = JSON.parse(event.data);
        // console.log("📨 Progress RAW message:", progressData);

        // Try to determine event type from data
        if (progressData.status === "completed" && onComplete) {
          onComplete(progressData);
          eventSource.close();
        } else if (progressData.status === "failed" && onError) {
          onError(progressData);
          eventSource.close();
        } else if (onUpdate) {
          onUpdate(progressData);
        }
      } catch (error) {
        console.error("❌ Error parsing RAW message:", error, "Data:", event.data);
      }
    };

    eventSource.onopen = () => {
      console.log("✅ Progress SSE Connection opened");
    };

    eventSource.onerror = err => {
      console.error("❌ Progress SSE Connection error:", err);
      if (onError) {
        onError({
          error: "SSE Connection failed",
          details: err,
        });
      }
      eventSource.close();
    };

    return eventSource;
  }

  /**
   * Monitor all progress tasks (global monitor)
   * @param {Function} onStart - Callback when new task starts
   * @param {Function} onUpdate - Callback when any task updates
   * @param {Function} onComplete - Callback when any task completes
   * @param {Function} onError - Callback when any task fails
   * @returns {EventSourcePolyfill} - SSE connection instance
   */
  monitorAllProgress(onStart, onUpdate, onComplete, onError) {
    const apiUrl = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const sseUrl = `${apiUrl}/progress/stream`;

    // console.log("🔗 Progress Service - Connecting to Global SSE:", sseUrl);

    const eventSource = new EventSourcePolyfill(sseUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle different event types for global stream
    eventSource.addEventListener("init", event => {
      try {
        const allTasks = JSON.parse(event.data);
        // console.log("🌐 Global INIT - All tasks:", allTasks);
      } catch (error) {
        console.error("❌ Error parsing Global INIT event:", error);
      }
    });

    eventSource.addEventListener("start", event => {
      try {
        const task = JSON.parse(event.data);
        // console.log("🌐 Global START - New task:", task);
        if (onStart) onStart(task);
      } catch (error) {
        console.error("❌ Error parsing Global START event:", error);
      }
    });

    eventSource.addEventListener("update", event => {
      try {
        const task = JSON.parse(event.data);
        // console.log("🌐 Global UPDATE - Task update:", task);
        if (onUpdate) onUpdate(task);
      } catch (error) {
        console.error("❌ Error parsing Global UPDATE event:", error);
      }
    });

    eventSource.addEventListener("complete", event => {
      try {
        const task = JSON.parse(event.data);
        // console.log("🌐 Global COMPLETE - Task completed:", task);
        if (onComplete) onComplete(task);
      } catch (error) {
        console.error("❌ Error parsing Global COMPLETE event:", error);
      }
    });

    eventSource.addEventListener("fail", event => {
      try {
        const task = JSON.parse(event.data);
        // console.log("🌐 Global FAIL - Task failed:", task);
        if (onError) onError(task);
      } catch (error) {
        console.error("❌ Error parsing Global FAIL event:", error);
      }
    });

    eventSource.onopen = () => {
      console.log("✅ Global Progress SSE Connection opened");
    };

    eventSource.onerror = err => {
      console.error("❌ Global Progress SSE Connection error:", err);
      eventSource.close();
    };

    return eventSource;
  }
}

export default new ProgressService();
