// src/pages/PrepClosing/composables/useProgress.js

import { ref, computed } from "vue";
import progressService from "@/services/progress.service.js";

export function useProgress(username) {
  const taskid = `prepClosingTask_${username}`;
  const progress = ref(null);
  const isMonitoring = ref(false);
  const progressError = ref(null);
  let sseConnection = null;

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

  const fetchProgress = async () => {
    try {
      progressError.value = null;
      const response = await progressService.getProgressTask(taskid);

      if (response) {
        progress.value = response;

        // Auto stop monitoring if completed or failed
        if (isCompleted.value || isFailed.value) {
          stopMonitoring();
        }
      }

      return response;
    } catch (err) {
      progressError.value = err.message || "Gagal memuat progress";
      console.error("Error fetching progress:", err);
    }
  };

  const maxRetry = 60;
  let retryCount = 0;

  const startMonitoring = async () => {
    if (isMonitoring.value) {
      console.log("⚠️ Progress monitoring already active");
      return;
    }

    try {
      stopMonitoring();
      isMonitoring.value = true;
      retryCount = 0; // reset setiap mulai monitoring

      await checkTaskLoop();
    } catch (error) {
      console.error("❌ Error starting progress monitoring:", error);
      progressError.value = "Gagal memulai monitoring progress";
      console.log("🔄 Fallback: Starting direct monitoring...");
      startDirectMonitoring();
    }
  };

  const checkTaskLoop = async () => {
    const taskExists = await progressService.checkProgressTask(taskid);

    if (taskExists) {
      console.log("✅ Task ditemukan, memulai direct monitoring...");
      startDirectMonitoring();
      return;
    }

    // Kalau tidak ditemukan
    retryCount++;
    console.log(`⚠️ Task not found (retry ${retryCount}/${maxRetry})`);

    // Sudah mencapai batas retry
    if (retryCount >= maxRetry) {
      console.log("⛔ Batas retry tercapai. Stop monitoring.");
      stopMonitoring();
      progressError.value = "Progress tidak ditemukan setelah 1 menit.";
      return;
    }

    // Lanjut retry setelah 1 detik
    setTimeout(() => {
      if (isMonitoring.value) {
        checkTaskLoop();
      }
    }, 1000);
  };

  const startDirectMonitoring = () => {
    sseConnection = progressService.monitorProgress(
      taskid,
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
  };

  const resetProgress = () => {
    console.log("🔄 Resetting progress state...");
    stopMonitoring();
    progress.value = null;
    progressError.value = null;
  };

  return {
    // State
    progress,
    percentage,
    isMonitoring,
    isCompleted,
    isFailed,
    progressError,

    // Computed additional info
    currentInfo,
    totalStores,
    currentStore,

    // Methods
    fetchProgress,
    startMonitoring,
    stopMonitoring,
    resetProgress,
  };
}
