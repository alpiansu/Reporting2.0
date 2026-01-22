import { defineStore } from 'pinia';
import progressService from '../services/progress.service';

export const useProgressStore = defineStore('progress', {
  state: () => ({
    tasks: {}, // { taskId: { percentage, info, status, title } }
    eventSource: null,
    isInitialized: false,
    autoExpandOnNewTask: true
  }),

  getters: {
    activeTasks: (state) => {
      // Return tasks that are currently running
      // Any task that isn't explicitly completed or failed is considered active
      const inactiveStatuses = ['completed', 'failed', 'success', 'error'];
      return Object.values(state.tasks).filter(task => 
        task.status && !inactiveStatuses.includes(task.status.toLowerCase())
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
    }
  },

  actions: {
    initProgressMonitoring() {
      if (this.isInitialized && this.eventSource) return;
      
      this.isInitialized = true;
      
      this.eventSource = progressService.monitorAllProgress(
        // onInit
        (allTasks) => {
          if (allTasks && typeof allTasks === 'object') {
            Object.values(allTasks).forEach(task => {
              this.updateTask(task, false); // Don't auto-expand for old tasks
            });
          }
        },
        // onStart
        (task) => {
          this.updateTask(task, this.autoExpandOnNewTask);
        },
        // onUpdate
        (task) => {
          this.updateTask(task, false);
        },
        // onComplete
        (task) => {
          this.handleTaskConclusion(task.id || task.taskId, 'completed');
        },
        // onError
        (task) => {
          this.handleTaskConclusion(task.id || task.taskId, 'failed');
        }
      );

      // Handle connection errors
      this.eventSource.onerror = (err) => {
        console.error('❌ Global Monitoring Connection Error:', err);
        // Retry connection after 5 seconds if still required
        setTimeout(() => {
          if (this.isInitialized) {
            this.stopMonitoring();
            this.initProgressMonitoring();
          }
        }, 5000);
      };
    },

    updateTask(taskData, expand = false) {
      if (!taskData) return;
      const taskId = taskData.id || taskData.taskId;
      if (!taskId) return;
      
      // Determine better title
      let title = taskData.info?.title || taskData.processType || taskData.module;
      if (!title && taskId) {
        if (taskId.includes('rekonVirtualMargin')) title = 'Screening Virtual Margin';
        else if (taskId.includes('adjustment')) title = 'Adjustment Process';
        else title = 'System Process';
      }

      // Preserve status from info if set, otherwise use main status
      const status = taskData.info?.status || taskData.status || 'running';
      const info = taskData.info?.description || taskData.message || (typeof taskData.info === 'string' ? taskData.info : 'Processing...');

      // Update state
      this.tasks[taskId] = {
        taskId: taskId,
        percentage: taskData.percentage || 0,
        info: info,
        status: status,
        title: title || 'System Task'
      };

      // Trigger global event for widget to expand if needed
      if (expand) {
        window.dispatchEvent(new CustomEvent('progress-widget-expand'));
      }
    },

    handleTaskConclusion(taskId, finalStatus) {
      if (this.tasks[taskId]) {
        this.tasks[taskId].status = finalStatus;
        this.tasks[taskId].percentage = 100;
        
        // Remove from list after a few seconds so user sees it finish
        setTimeout(() => {
          if (this.tasks[taskId] && (this.tasks[taskId].status === 'completed' || this.tasks[taskId].status === 'failed')) {
            delete this.tasks[taskId];
          }
        }, 3000);
      }
    },

    stopMonitoring() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      // Keep isInitialized as true if we just want to restart, 
      // but typically we'd set to false if fully stopping.
      this.isInitialized = false;
    }
  }
});
