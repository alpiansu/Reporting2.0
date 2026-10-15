import { defineStore } from "pinia";
import progressService from "../services/progress.service";
import { broadcastMessage } from "../utils/broadcastSync";

export const useProgressStore = defineStore("progress", {
  state: () => ({
    tasks: {}, // { taskId: { percentage, info, status, title } }
    // Track task IDs that are being cancelled to differentiate failure from cancellation
    cancelingTaskId: null,

    isInitialized: false,
    autoExpandOnNewTask: true,

    // Real-time tracking of which stores are currently being processed per task
    // shape: { [taskId]: string[] }
    processingStores: {},

    eventSource: null,
    pollInterval: null,
  }),

  getters: {
    activeTasks: (state) => {
      // Return tasks that are currently running
      // Any task that isn't explicitly completed or failed is considered active
      const inactiveStatuses = [
        "completed",
        "failed",
        "success",
        "error",
        "cancelled",
        "timed_out",
      ];
      return Object.values(state.tasks).filter(
        (task) =>
          task.status && !inactiveStatuses.includes(task.status.toLowerCase()),
      );
    },
    hasActiveTasks: (getters) => {
      return getters.activeTasks.length > 0;
    },
    totalPercentage: (getters) => {
      const active = getters.activeTasks;
      if (active.length === 0) return 0;
      const sum = active.reduce((acc, task) => acc + (task.percentage || 0), 0);
      return Math.round(sum / active.length);
    },
    mainTask: (getters) => {
      // Return the most relevant task (latest active task)
      return getters.activeTasks[getters.activeTasks.length - 1] || null;
    },
  },

  actions: {
    /**
     * Inisialisasi monitoring progress secara on-demand.
     * Tidak membuka SSE jika tidak ada task yang aktif.
     */
    async initProgressMonitoring() {
      if (this.isInitialized) return;
      this.isInitialized = true;

      await this.syncActiveTasks();
      this._startPolling();
    },

    _startPolling() {
      if (this.pollInterval) return;
      this.pollInterval = setInterval(() => {
        if (!this.eventSource) {
          this.syncActiveTasks();
        }
      }, 15000);
    },

    _stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    },

    async syncActiveTasks() {
      try {
        const active = await progressService.getActiveProgressTasks();
        if (active) {
          const taskList = Array.isArray(active) ? active : Object.values(active);
          if (taskList.length > 0) {
            taskList.forEach((task) => {
              this.updateTask(task, false, false);
            });
            if (!this.eventSource && this.hasActiveTasks) {
              this._startStream();
            }
          }
        }
      } catch (err) {
        // Silent on background poll error
      }
    },

    _startStream() {
      if (this.eventSource) return;

      this.eventSource = progressService.monitorAllProgress(
        // onInit
        (allTasks) => {
          if (allTasks && typeof allTasks === "object") {
            Object.values(allTasks).forEach((task) => {
              this.updateTask(task, false, false);
            });
            if (!this.hasActiveTasks) {
              this.stopMonitoring();
            }
          }
        },
        // onStart
        (task) => {
          this.updateTask(task, this.autoExpandOnNewTask, true);
        },
        // onUpdate
        (task) => {
          this.updateTask(task, false, true);
        },
        // onComplete
        (task) => {
          const tid = task.id || task.taskId;
          this.handleTaskConclusion(tid, "completed", true);
        },
        // onError
        (task) => {
          const tid = task.id || task.taskId;
          this.handleTaskConclusion(tid, "failed", true);
        },
        // onCancel - handle user-initiated cancellation gracefully
        (task) => {
          const tid = task.id || task.taskId;
          this.handleTaskConclusion(tid, "cancelled", true);
        },
        // onProcessing - real-time store processing tracking
        (data) => {
          this.handleProcessingUpdate(data, true);
        },
      );

      // Handle connection errors
      this.eventSource.onerror = (err) => {
        console.error("❌ Global Monitoring Connection Error:", err);
        this.stopMonitoring();
        if (this.hasActiveTasks) {
          setTimeout(() => {
            if (this.hasActiveTasks && !this.eventSource) {
              this._startStream();
            }
          }, 5000);
        }
      };
    },

    updateTask(taskData, expand = false, shouldBroadcast = true) {
      if (!taskData) return;
      const taskId = taskData.id || taskData.taskId;
      if (!taskId) return;

      // Determine better title
      let title = taskData.title || taskData.info?.title || taskData.module;

      if (!title && taskId) {
        const lowerId = taskId.toLowerCase();
        if (lowerId.includes("rekonvirtualmargin"))
          title = "Screening Virtual Margin";
        else if (
          lowerId.includes("adjustment") ||
          lowerId.includes("adjusttask")
        )
          title = "Adjustment Process";
        else if (lowerId.includes("penyesuaiantask"))
          title = "Screening Penyesuaian";
        else if (lowerId.includes("rekonsalestask"))
          title = "Screening Rekon Sales";
        else if (lowerId.includes("rekonpersediaantask"))
          title = "Screening Rekon Persediaan";
        else if (lowerId.includes("prepclosingtask"))
          title = "Screening Pra Closing";
        else if (lowerId.includes("buatrmbtask")) title = "Buat RMB Process";
        else title = "System Process";
      }

      // Preserve status from info if set, otherwise use main status
      let status = taskData.info?.status || taskData.status || "running";
      // If a task was cancelled by the user and server reports "failed", treat as "cancelled"
      if (status.toLowerCase() === 'failed' && this.cancelingTaskId && (taskData.id || taskData.taskId) === this.cancelingTaskId) {
        status = 'cancelled';
      }
      const info =
        taskData.info?.description ||
        taskData.message ||
        (typeof taskData.info === "string" ? taskData.info : "Processing...");

      // Update state
      this.tasks[taskId] = {
        taskId: taskId,
        percentage: taskData.percentage || 0,
        info: info,
        status: status,
        title: title || "System Task",
        startedBy:
          taskData.startedBy ||
          taskData.info?.startedBy ||
          this.tasks[taskId]?.startedBy ||
          null,
      };

      const inactiveStatuses = [
        "completed",
        "failed",
        "success",
        "error",
        "cancelled",
        "timed_out",
      ];
      if (!inactiveStatuses.includes(status.toLowerCase()) && !this.eventSource) {
        this._startStream();
      }

      // Trigger global event for widget to expand if needed
      if (expand) {
        window.dispatchEvent(new CustomEvent("progress-widget-expand"));
      }

      if (shouldBroadcast) {
        broadcastMessage("PROGRESS_UPDATE", { task: taskData, expand });
      }
    },

    handleTaskConclusion(taskId, finalStatus, shouldBroadcast = false) {
      if (this.tasks[taskId]) {
        this.tasks[taskId].status = finalStatus;

        // For cancelled tasks, remove quickly without error display
        if (finalStatus === "cancelled") {
          this.tasks[taskId].info = "Proses dibatalkan oleh pengguna";
          this.tasks[taskId].percentage = 0;
          setTimeout(() => {
            if (this.tasks[taskId] && this.tasks[taskId].status === "cancelled") {
              delete this.tasks[taskId];
              if (!this.hasActiveTasks) {
                this.stopMonitoring();
              }
            }
          }, 2000);
          if (shouldBroadcast) {
            broadcastMessage("PROGRESS_CONCLUSION", { taskId, status: "cancelled" });
          }
          return;
        }

        this.tasks[taskId].percentage = 100;

        // Remove from list after a few seconds so user sees it finish
        setTimeout(() => {
          if (
            this.tasks[taskId] &&
            (this.tasks[taskId].status === "completed" ||
              this.tasks[taskId].status === "failed")
          ) {
            delete this.tasks[taskId];
            if (!this.hasActiveTasks) {
              this.stopMonitoring();
            }
          }
        }, 3000);

        if (shouldBroadcast) {
          broadcastMessage("PROGRESS_CONCLUSION", { taskId, status: finalStatus });
        }
      }
    },

    stopMonitoring() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    },

    /**
     * Handle real-time processing store updates from SSE.
     * Updates the processingStores map so the widget can display which stores are active.
     */
    handleProcessingUpdate(data, shouldBroadcast = false) {
      if (!data || !data.taskId) return;
      if (data.stores && data.stores.length > 0) {
        this.processingStores[data.taskId] = data.stores;
      } else {
        delete this.processingStores[data.taskId];
      }

      if (shouldBroadcast) {
        broadcastMessage("PROGRESS_PROCESSING", data);
      }
    },

    async cancelTask(taskId) {
      try {
        this.cancelingTaskId = taskId;
        await progressService.cancelTask(taskId);
        // Optimistically update task status to cancelled locally
        if (this.tasks[taskId]) {
          this.tasks[taskId].status = 'cancelled';
          this.tasks[taskId].percentage = 0;
        }
        broadcastMessage("PROGRESS_CONCLUSION", { taskId, status: "cancelled" });
        this.cancelingTaskId = null;
      } catch (err) {
        console.error('Cancel failed:', err);
        this.cancelingTaskId = null;
        throw err;
      }
    },
  },
});
