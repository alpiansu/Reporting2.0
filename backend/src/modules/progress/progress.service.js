/**
 * Service layer for managing progress tracking
 */
import fs from "fs";
import fsPromises from "fs/promises";
import EventEmitter from "events";
import config from "./progress.config.js";
import path from "path";
import { Mutex } from "async-mutex";
import logger from "../../config/logger.js";

class ProgressService extends EventEmitter {
  constructor() {
    super();
    this.progressMap = new Map();
    this.isInitialized = false;
    this.initializingPromise = null;
    this.cleanupTimer = null;
    this.mutex = new Mutex();
    // In-memory set of taskIds that have been requested to abort.
    // Checked by processing loops before starting each new store.
    this.abortSet = new Set();

    // In-memory map of taskId → string[] of store codes currently being processed.
    // No disk I/O, no mutex — purely for real-time SSE display.
    this.processingStoresMap = new Map();
  }

  /**
   * Signal that a task should be aborted.
   * Called by cancelTask() so running loops can detect it.
   */
  requestAbort(taskId) {
    this.abortSet.add(taskId);
    logger.info(`[ProgressService] Abort requested for task: ${taskId}`);
  }

  /**
   * Check whether a task has been requested to abort.
   * Called inside processing loops before starting each store.
   */
  isAborted(taskId) {
    return this.abortSet.has(taskId);
  }

  /**
   * Clear the abort flag for a task.
   * Called when a task finishes (complete / fail / cancel / new start).
   */
  clearAbort(taskId) {
    if (this.abortSet.has(taskId)) {
      this.abortSet.delete(taskId);
      logger.info(`[ProgressService] Abort flag cleared for task: ${taskId}`);
    }
  }

  /**
   * Register that a store is being processed for a task.
   * Emits a 'processingUpdate' SSE event with the full current set of stores.
   * Pure in-memory — no disk I/O, no mutex.
   * Safe under Node.js single-threaded model: push + emit are synchronous.
   */
  addProcessingStore(taskId, storeCode) {
    let stores = this.processingStoresMap.get(taskId);
    if (!stores) {
      stores = [];
      this.processingStoresMap.set(taskId, stores);
    }
    stores.push(storeCode);
    this.emit('processingUpdate', { taskId, stores: [...stores] });
  }

  /**
   * Remove a store from the processing set for a task.
   * Emits a 'processingUpdate' event with the remaining stores.
   */
  removeProcessingStore(taskId, storeCode) {
    const stores = this.processingStoresMap.get(taskId);
    if (!stores) return;
    const idx = stores.indexOf(storeCode);
    if (idx !== -1) stores.splice(idx, 1);
    if (stores.length === 0) {
      this.processingStoresMap.delete(taskId);
    }
    this.emit('processingUpdate', { taskId, stores: [...stores] });
  }

  /**
   * Clear all processing stores for a task (used on task completion/failure/cancel).
   */
  clearProcessingStores(taskId) {
    if (this.processingStoresMap.has(taskId)) {
      this.processingStoresMap.delete(taskId);
      this.emit('processingUpdate', { taskId, stores: [] });
    }
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      await this._ensureJsonFile();
      await this._loadProgressData();

      // Reset all progress on startup to prevent stale tasks
      // from blocking new tasks after server crash/restart
      await this._resetProgressOnStartup();

      // Auto cleanup old tasks periodically
      if (config.cleanup.enabled && !this.cleanupTimer) {
        this.cleanupTimer = setInterval(
          () => {
            this.cleanupOldTasks(config.cleanup.maxAgeHours);
          },
          config.cleanup.intervalMinutes * 60 * 1000,
        );
      }

      this.isInitialized = true;
      this.initializingPromise = null;
    })();

    return this.initializingPromise;
  }

  async _ensureJsonFile() {
    const dir = path.dirname(config.jsonPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(config.jsonPath)) {
      fs.writeFileSync(config.jsonPath, "{}");
    }
  }

  async _loadProgressData(maxRetries = 5) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await fsPromises.readFile(config.jsonPath, "utf-8");
        const parsed = JSON.parse(data);

        // Replace the entire map to ensure consistency with disk
        const newMap = new Map();
        Object.entries(parsed).forEach(([taskId, task]) => {
          newMap.set(taskId, task);
        });
        this.progressMap = newMap;
        return;
      } catch (err) {
        lastError = err;
        if (err.code === "ENOENT") {
          this.progressMap = new Map();
          return;
        }

        if (attempt < maxRetries) {
          const waitTime = Math.min(100 * Math.pow(2, attempt - 1), 1000);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          console.warn(
            `[ProgressService] Retry loading JSON (attempt ${attempt + 1}): ${err.message}`,
          );
        }
      }
    }
    console.error(
      "[ProgressService] Failed to load JSON after retries:",
      lastError.message,
    );
    this.progressMap = new Map();
  }

  async _resetProgressOnStartup() {
    if (this.progressMap.size === 0) return;

    logger.info("[ProgressService] Server restart detected — clearing all progress data");
    this.progressMap.clear();
    await this._saveProgressData();
  }

  async _saveProgressData(maxRetries = 5) {
    const tempPath = `${config.jsonPath}.tmp`;
    const jsonData = Object.fromEntries(this.progressMap);
    const content = JSON.stringify(jsonData, null, 2);
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Atomic write approach
        await fsPromises.writeFile(tempPath, content, "utf-8");
        await fsPromises.rename(tempPath, config.jsonPath);
        return;
      } catch (error) {
        lastError = error;
        const isRetryable =
          error.code === "EBUSY" ||
          error.code === "EPERM" ||
          error.code === "EEXIST";

        if (isRetryable && attempt < maxRetries) {
          const waitTime =
            Math.min(100 * Math.pow(2, attempt - 1), 1000) + Math.random() * 50;
          console.warn(
            `[ProgressService] File busy/locked during save (${error.code}), retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          console.error(
            "[ProgressService] Failed to save progress data:",
            error.message,
          );
          // Don't throw here to avoid crashing the whole operation, but log it
          return;
        }
      }
    }
  }

  /**
   * Register new progress
   */
  async startProgress(taskId, total = 100, info = "") {
    await this.initialize();

    const release = await this.mutex.acquire();
    try {
      // Reload data from disk to ensure we have the latest state from all potential workers/processes
      await this._loadProgressData();

      // Auto-expire tasks that have been stuck in-progress for too long before checking capacity.
      // This ensures crashed/killed processes don't permanently block new ones.
      await this._expireStaleTasksLocked();

      // Clear any leftover abort flag from a previous run with the same taskId
      this.clearAbort(taskId);

      const activeCount = this._activeTaskCount();
      if (activeCount >= config.maxConcurrentTasks) {
        const activeTasks = this.getActiveTasks();
        console.warn(
          `[ProgressService] Start task ${taskId} rejected: ${activeCount}/${config.maxConcurrentTasks} tasks active.`,
        );
        const err = new Error(
          "Sistem sedang memproses task lain. Harap tunggu hingga proses selesai.",
        );
        err.code = "TASK_BUSY";
        err.activeTasks = activeTasks.map((t) => ({
          id: t.id,
          module: t.module || "unknown",
          title: t.title || t.id,
          percentage: t.percentage,
          status: t.status,
          updatedAt: t.updatedAt,
        }));
        throw err;
      }

      const task = {
        id: taskId,
        total,
        completed: 0,
        percentage: 0,
        info,
        status: "in-progress",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Extract module and title from info if provided as object
      if (typeof info === "object" && info.module) {
        task.module = info.module;
      }
      if (typeof info === "object" && info.title) {
        task.title = info.title;
      }
      if (typeof info === "object" && info.startedBy) {
        task.startedBy = info.startedBy;
      }

      this.progressMap.set(taskId, task);
      await this._saveProgressData();

      console.log(
        `[ProgressService] Task started: ${taskId} (${task.module || "no-module"})`,
      );
      this.emit("progressStart", task);
      return task;
    } finally {
      release();
    }
  }

  /**
   * Update progress
   * Gracefully returns null if task was deleted (e.g. by cancelTask) instead of throwing.
   */
  async updateProgress(taskId, completed, info = "") {
    const release = await this.mutex.acquire();
    try {
      const task = this.progressMap.get(taskId);

      // Task was deleted (e.g. by cancelTask) — silently skip instead of throwing
      if (!task) {
        logger.warn(
          `[ProgressService] updateProgress('${taskId}'): task not found — likely cancelled. Skipping update.`,
        );
        return null;
      }

      task.completed = Math.min(completed, task.total);
      task.percentage = Math.round((task.completed / task.total) * 100);
      task.info = info || task.info;
      task.updatedAt = new Date().toISOString();

      this.progressMap.set(taskId, task);
      await this._saveProgressData();

      this.emit("progressUpdate", task);
      return task;
    } finally {
      release();
    }
  }

  /**
   * Mark progress as completed
   */
  async completeProgress(taskId) {
    const release = await this.mutex.acquire();
    try {
      const task = this.progressMap.get(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);

      task.completed = task.total;
      task.percentage = 100;
      task.status = "completed";
      task.updatedAt = new Date().toISOString();

      this.progressMap.set(taskId, task);
      await this._saveProgressData();

      this.clearAbort(taskId);
      this.emit("progressComplete", task);

      // Auto remove after short delay - use separate release for the timeout
      setTimeout(async () => {
        const subRelease = await this.mutex.acquire();
        try {
          this.progressMap.delete(taskId);
          await this._saveProgressData();
          this.emit("progressRemoved", taskId);
        } finally {
          subRelease();
        }
      }, 2000);

      return task;
    } finally {
      release();
    }
  }

  /**
   * Fail a progress task
   */
  async failProgress(taskId, errorMessage) {
    const release = await this.mutex.acquire();
    try {
      const task = this.progressMap.get(taskId);

      // Task already deleted (e.g. by cancelTask) — don't throw, don't double-emit.
      if (!task) {
        this.clearAbort(taskId);
        logger.warn(
          `[ProgressService] failProgress('${taskId}'): task not found — already cleaned up by cancelTask. Skipping emit.`,
        );
        return null;
      }

      task.status = "failed";
      task.error = errorMessage;
      task.updatedAt = new Date().toISOString();

      this.progressMap.set(taskId, task);
      await this._saveProgressData();

      this.clearAbort(taskId);
      this.emit("progressFailed", task);
      return task;
    } finally {
      release();
    }
  }

  /**
   * Auto-expire in-progress tasks that have been stuck longer than config.maxStaleMinutes.
   * MUST be called while holding the mutex lock.
   */
  async _expireStaleTasksLocked() {
    const maxStaleMs = (config.maxStaleMinutes || 60) * 60 * 1000;
    const now = Date.now();
    let expired = 0;

    for (const [id, task] of this.progressMap.entries()) {
      if (task.status === "in-progress") {
        const age = now - new Date(task.updatedAt).getTime();
        if (age > maxStaleMs) {
          task.status = "timed_out";
          task.error = `Task otomatis kadaluarsa setelah tidak ada aktivitas selama ${config.maxStaleMinutes} menit`;
          task.updatedAt = new Date().toISOString();
          this.progressMap.set(id, task);
          expired++;
          logger.warn(
            `[ProgressService] Auto-expired stale task: ${id} (module: ${task.module || "unknown"}, last update: ${task.updatedAt})`,
          );
        }
      }
    }

    if (expired > 0) {
      await this._saveProgressData();
      logger.info(`[ProgressService] Auto-expired ${expired} stale task(s)`);
    }
  }

  /**
   * Cancel a specific task by ID (admin/manual override).
   *
   * The task is IMMEDIATELY deleted from progressMap so that a new task with
   * the same ID can be started right away without hitting the concurrency limit.
   * A snapshot of the task is captured before deletion for the SSE emit.
   */
  async cancelTask(taskId) {
    const release = await this.mutex.acquire();
    try {
      await this._loadProgressData();
      const task = this.progressMap.get(taskId);
      if (!task) throw new Error(`Task '${taskId}' tidak ditemukan`);

      // Signal running loops to stop
      this.requestAbort(taskId);

      // Build a rich snapshot for the SSE payload before we delete the task
      const snapshot = {
        ...task,
        status: "cancelled",
        error: "Task dibatalkan oleh pengguna",
        info: {
          ...(typeof task.info === "object" && task.info !== null
            ? task.info
            : {}),
          description: "Proses dibatalkan oleh pengguna",
          status: "cancelled",
        },
        updatedAt: new Date().toISOString(),
      };

      // Delete immediately — so startProgress for a new run doesn't see "in-progress"
      this.progressMap.delete(taskId);
      await this._saveProgressData();

      logger.info(
        `[ProgressService] Task cancelled and removed from progressMap: ${taskId}`,
      );

      // NOTE: Do NOT clear the abort flag here. The abort flag must remain set so that
      // still-running screening loops can detect the cancellation via isAborted().
      // The flag will be cleared by:
      //   1. failProgress() — when the loop calls it (task already deleted → clearAbort)
      //   2. startProgress() — when a new task with the same ID is started (clearAbort on init)

      // Notify all SSE listeners
      this.emit("progressFailed", snapshot);
      this.emit("progressRemoved", taskId);

      return snapshot;
    } finally {
      release();
    }
  }

  /**
   * Cleanup old tasks (older than maxAgeHours)
   */
  async cleanupOldTasks(maxAgeHours) {
    const release = await this.mutex.acquire();
    try {
      const now = Date.now();
      const threshold = maxAgeHours * 60 * 60 * 1000;
      let removed = 0;

      for (const [id, task] of this.progressMap.entries()) {
        const updated = new Date(task.updatedAt).getTime();
        if (now - updated > threshold) {
          this.progressMap.delete(id);
          removed++;
        }
      }

      if (removed > 0) {
        await this._saveProgressData();
        console.log(`[ProgressService] Cleaned up ${removed} old tasks`);
      }
    } finally {
      release();
    }
  }

  /**
   * Get active task count
   */
  _activeTaskCount() {
    return [...this.progressMap.values()].filter(
      (t) => t.status === "in-progress",
    ).length;
  }

  /**
   * Get current state of all tasks or one task
   */
  getProgress(taskId = null) {
    if (taskId) return this.progressMap.get(taskId) || null;
    return Object.fromEntries(this.progressMap);
  }

  /**
   * Get only active tasks (in-progress status)
   */
  getActiveTasks() {
    return [...this.progressMap.values()].filter(
      (task) => task.status === "in-progress",
    );
  }

  /**
   * Get tasks by module name
   */
  getTasksByModule(moduleName) {
    return [...this.progressMap.values()].filter(
      (task) => task.module === moduleName,
    );
  }

  /**
   * Get queue status and system capacity
   */
  getQueueStatus() {
    const activeTasks = this.getActiveTasks();
    const currentActive = activeTasks.length;
    const maxConcurrent = config.maxConcurrentTasks;

    return {
      maxConcurrent,
      currentActive,
      canAcceptNew: currentActive < maxConcurrent,
      activeTasks: activeTasks.map((task) => ({
        id: task.id,
        module: task.module,
        percentage: task.percentage,
        info: task.info,
        status: task.status,
      })),
    };
  }
}

const progressService = new ProgressService();
export default progressService;
