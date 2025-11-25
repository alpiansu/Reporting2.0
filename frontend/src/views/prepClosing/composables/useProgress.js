// src/pages/PrepClosing/composables/useProgress.js

import { ref, computed } from "vue";
import prepClosingApi from "@/services/prepClosing.service.js";
import { AUTO_REFRESH_INTERVALS } from "../utils/constants";

export function useProgress(username) {
  const progress = ref(null);
  const isMonitoring = ref(false);
  const progressError = ref(null);
  let pollInterval = null;

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

  const fetchProgress = async () => {
    try {
      progressError.value = null;
      const response = await prepClosingApi.getProgress(username);
      progress.value = response.data;

      // Auto stop monitoring if completed or failed
      if (isCompleted.value || isFailed.value) {
        stopMonitoring();
      }

      return response.data;
    } catch (err) {
      progressError.value = err.response?.data?.message || "Gagal memuat progress";
      console.error("Error fetching progress:", err);
    }
  };

  const startMonitoring = () => {
    if (isMonitoring.value) return;

    isMonitoring.value = true;

    // Initial fetch
    fetchProgress();

    // Start polling
    pollInterval = setInterval(() => {
      if (!isCompleted.value && !isFailed.value) {
        fetchProgress();
      } else {
        stopMonitoring();
      }
    }, AUTO_REFRESH_INTERVALS.PROGRESS);
  };

  const stopMonitoring = () => {
    isMonitoring.value = false;

    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  const resetProgress = () => {
    stopMonitoring();
    progress.value = null;
    progressError.value = null;
  };

  return {
    progress,
    percentage,
    isMonitoring,
    isCompleted,
    isFailed,
    progressError,
    fetchProgress,
    startMonitoring,
    stopMonitoring,
    resetProgress,
  };
}
