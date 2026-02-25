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
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      await this._ensureJsonFile();
      await this._loadProgressData();

      // Auto cleanup old tasks periodically
      if (config.cleanup.enabled && !this.cleanupTimer) {
        this.cleanupTimer = setInterval(() => {
          this.cleanupOldTasks(config.cleanup.maxAgeHours);
        }, config.cleanup.intervalMinutes * 60 * 1000);
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
        if (err.code === 'ENOENT') {
          this.progressMap = new Map();
          return;
        }

        if (attempt < maxRetries) {
          const waitTime = Math.min(100 * Math.pow(2, attempt - 1), 1000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          console.warn(`[ProgressService] Retry loading JSON (attempt ${attempt + 1}): ${err.message}`);
        }
      }
    }
    console.error("[ProgressService] Failed to load JSON after retries:", lastError.message);
    this.progressMap = new Map();
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
        const isRetryable = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EEXIST';
        
        if (isRetryable && attempt < maxRetries) {
          const waitTime = Math.min(100 * Math.pow(2, attempt - 1), 1000) + Math.random() * 50;
          console.warn(`[ProgressService] File busy/locked during save (${error.code}), retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error("[ProgressService] Failed to save progress data:", error.message);
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

      const activeCount = this._activeTaskCount();
      if (activeCount >= config.maxConcurrentTasks) {
        console.warn(
          `[ProgressService] Start task ${taskId} rejected: ${activeCount}/${config.maxConcurrentTasks} tasks active.`
        );
        throw new Error("Maximum concurrent progress reached. Please wait for other tasks to complete.");
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

      // Extract module from info if provided as object
      if (typeof info === "object" && info.module) {
        task.module = info.module;
      }

      this.progressMap.set(taskId, task);
      await this._saveProgressData();

      console.log(`[ProgressService] Task started: ${taskId} (${task.module || "no-module"})`);
      this.emit("progressStart", task);
      return task;
    } finally {
      release();
    }
  }

  /**
   * Update progress
   */
  async updateProgress(taskId, completed, info = "") {
    const release = await this.mutex.acquire();
    try {
      const task = this.progressMap.get(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);

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
      if (!task) throw new Error(`Task ${taskId} not found`);

      task.status = "failed";
      task.error = errorMessage;
      task.updatedAt = new Date().toISOString();

      this.progressMap.set(taskId, task);
      await this._saveProgressData();

      this.emit("progressFailed", task);
      return task;
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
    return [...this.progressMap.values()].filter(t => t.status === "in-progress").length;
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
    return [...this.progressMap.values()].filter(task => task.status === "in-progress");
  }

  /**
   * Get tasks by module name
   */
  getTasksByModule(moduleName) {
    return [...this.progressMap.values()].filter(task => task.module === moduleName);
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
      activeTasks: activeTasks.map(task => ({
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
