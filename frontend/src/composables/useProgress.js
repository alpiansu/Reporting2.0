// src/composables/useProgress.js

import { ref, computed } from "vue";
import progressService from "@/services/progress.service.js";

/**
 * Composable untuk monitoring progress task
 * @param {object} options - Opsi tambahan
 * @param {number} options.maxRetry - Maksimal retry untuk check task (default: 60)
 * @param {number} options.retryInterval - Interval retry dalam ms (default: 1000)
 * @returns {object} Progress state dan methods
 */
export function useProgress(options = {}) {
  const { maxRetry = 60, retryInterval = 1000 } = options;

  const progress = ref({
    percentage: 0,
    current: 0,
    total: 0,
    status: "idle",
    info: {},
    description: "",
  });

  const isVisible = ref(false);
  const isMonitoring = ref(false);
  const progressError = ref(null);

  let sseConnection = null;
  let retryCount = 0;
  let currentTaskId = null;

  const percentage = computed(() => {
    if (!progress.value || progress.value.total === 0) return 0;
    return Math.round((progress.value.current / progress.value.total) * 100);
  });

  const isCompleted = computed(() => {
    return progress.value?.status === "completed" || percentage.value >= 100;
  });

  const isFailed = computed(() => {
    return progress.value?.status === "failed";
  });

  const currentInfo = computed(() => {
    return progress.value?.info?.description || progress.value?.description || "";
  });

  const totalStores = computed(() => {
    return progress.value?.total || 0;
  });

  const currentStore = computed(() => {
    return progress.value?.current || 0;
  });

  const fetchProgress = async taskId => {
    if (!taskId) {
      console.warn("⚠️ No taskId provided to fetchProgress");
      return null;
    }

    try {
      progressError.value = null;
      const response = await progressService.getProgressTask(taskId);

      if (response) {
        progress.value = {
          ...response,
          percentage: response?.percentage || 0,
          current: response?.current || 0,
          total: response?.total || 0,
          status: response?.status || "processing",
          info: response?.info || {},
          description: response?.description || response?.info?.description || "",
        };

        // Auto stop monitoring if completed or failed
        if (isCompleted.value || isFailed.value) {
          stopMonitoring();
        }
      }

      return response;
    } catch (err) {
      progressError.value = err.message || "Gagal memuat progress";
      console.error("Error fetching progress:", err);
      return null;
    }
  };

  const startMonitoring = async (taskId, callbacks = {}) => {
    if (!taskId) {
      console.error("❌ No taskId provided to startMonitoring");
      progressError.value = "Task ID tidak tersedia";
      return;
    }

    if (isMonitoring.value) {
      console.log("⚠️ Progress monitoring already active");
      return;
    }

    try {
      stopMonitoring();
      currentTaskId = taskId;
      isMonitoring.value = true;
      isVisible.value = true;
      retryCount = 0;

      console.log(`🎬 Starting monitoring for task: ${taskId}`);
      await checkTaskLoop(callbacks);
    } catch (error) {
      console.error("❌ Error starting progress monitoring:", error);
      progressError.value = "Gagal memulai monitoring progress";
      console.log("🔄 Fallback: Starting direct monitoring...");
      startDirectMonitoring(callbacks);
    }
  };

  const checkTaskLoop = async callbacks => {
    if (!currentTaskId) return;

    const taskExists = await progressService.checkProgressTask(currentTaskId);

    if (taskExists) {
      //   console.log("✅ Task ditemukan, memulai direct monitoring...");
      startDirectMonitoring(callbacks);
      return;
    }

    retryCount++;
    console.log(`⚠️ Task not found (retry ${retryCount}/${maxRetry})`);

    if (retryCount >= maxRetry) {
      console.log("⛔ Batas retry tercapai. Stop monitoring.");
      stopMonitoring();
      progressError.value = "Progress tidak ditemukan setelah timeout.";
      if (callbacks.onError) {
        callbacks.onError({ description: progressError.value });
      }
      return;
    }

    setTimeout(() => {
      if (isMonitoring.value) {
        checkTaskLoop(callbacks);
      }
    }, retryInterval);
  };

  const startDirectMonitoring = (callbacks = {}) => {
    if (!currentTaskId) {
      console.error("❌ No taskId available for direct monitoring");
      return;
    }

    sseConnection = progressService.monitorProgress(
      currentTaskId,
      // onUpdate callback
      progressData => {
        progress.value = {
          ...progressData,
          percentage: progressData?.percentage || 0,
          current: progressData?.current || 0,
          total: progressData?.total || 0,
          status: progressData?.status || "processing",
          info: progressData?.info || {},
          description: progressData?.description || progressData?.info?.description || "",
        };

        progressError.value = null;

        // Call user's onUpdate callback if provided
        if (callbacks.onUpdate) {
          callbacks.onUpdate(progress.value);
        }
      },
      // onComplete callback
      progressData => {
        progress.value = {
          ...progressData,
          percentage: 100,
          status: "completed",
          description: progressData?.description || "Processing completed",
        };

        progressError.value = null;
        stopMonitoring();
        isMonitoring.value = false;
        isVisible.value = false;

        // Call user's onComplete callback if provided
        if (callbacks.onComplete) {
          callbacks.onComplete(progress.value);
        }
      },
      // onError callback
      errorData => {
        console.error("❌ Progress error:", errorData);

        progress.value = {
          percentage: 0,
          status: "failed",
          description: errorData?.description || "Processing failed",
          error: errorData,
        };

        progressError.value = errorData?.description || "Progress monitoring failed";
        stopMonitoring();

        // Call user's onError callback if provided
        if (callbacks.onError) {
          callbacks.onError(errorData);
        }
      },
      // onCancel callback - user-initiated cancellation, no error display
      cancelData => {
        console.log("ℹ️ Task cancelled by user:", cancelData);

        progress.value = {
          percentage: 0,
          status: "cancelled",
          description: "Proses dibatalkan oleh pengguna",
        };

        progressError.value = null;
        stopMonitoring();
        isMonitoring.value = false;
        isVisible.value = false;

        // Call user's onCancel callback if provided
        if (callbacks.onCancel) {
          callbacks.onCancel(cancelData);
        }
      }
    );
  };

  const stopMonitoring = () => {
    if (sseConnection) {
      console.log("🛑 Stopping SSE connection...");
      sseConnection.close();
      sseConnection = null;
    }

    isMonitoring.value = false;
    currentTaskId = null;
  };

  return {
    // State
    progress,
    percentage,
    isMonitoring,
    isCompleted,
    isFailed,
    progressError,
    isVisible,

    // Computed additional info
    currentInfo,
    totalStores,
    currentStore,

    // Methods
    fetchProgress,
    startMonitoring,
    stopMonitoring,
  };
}
