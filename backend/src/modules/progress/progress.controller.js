/**
 * Controller for Progress module
 * Handles Server-Sent Events (SSE) streaming for real-time updates
 */
import progressService from "./progress.service.js";

// SSE for ALL progress updates (global monitor)
export const streamAllProgress = async (req, res) => {
  setupSSEHeaders(res);

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial state of ALL tasks
  sendEvent("init", progressService.getProgress());

  // Listen for ALL updates
  const onStart = (task) => sendEvent("start", task);
  const onUpdate = (task) => sendEvent("update", task);
  const onComplete = (task) => sendEvent("complete", task);
  const onFail = (task) => sendEvent("fail", task);
  const onRemove = (taskId) => sendEvent("remove", { taskId });

  progressService.on("progressStart", onStart);
  progressService.on("progressUpdate", onUpdate);
  progressService.on("progressComplete", onComplete);
  progressService.on("progressFailed", onFail);
  progressService.on("progressRemoved", onRemove);

  setupSSECleanup(req, res, {
    progressStart: onStart,
    progressUpdate: onUpdate,
    progressComplete: onComplete,
    progressFailed: onFail,
    progressRemoved: onRemove,
  });
};

// SSE for SPECIFIC task progress
export const streamTaskProgress = async (req, res) => {
  const { taskId } = req.params;

  const task = progressService.getProgress(taskId);
  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found",
    });
  }

  setupSSEHeaders(res);

  const sendEvent = (event, data) => {
    // Only send if it's for our task
    if (data.id === taskId || data.taskId === taskId) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Send current task state immediately
  sendEvent("init", task);

  // Listen for updates for THIS SPECIFIC TASK
  const onStart = (task) => sendEvent("start", task);
  const onUpdate = (task) => sendEvent("update", task);
  const onComplete = (task) => {
    if (task.id === taskId) {
      sendEvent("complete", task);
      setTimeout(() => {
        if (!res.writableEnded) {
          res.end();
        }
      }, 2000);
    } else {
      sendEvent("complete", task);
    }
  };
  const onFail = (task) => {
    if (task.id === taskId) {
      sendEvent("fail", task);
      setTimeout(() => {
        if (!res.writableEnded) {
          res.end();
        }
      }, 2000);
    } else {
      sendEvent("fail", task);
    }
  };
  const onRemove = (taskId) => sendEvent("remove", { taskId });

  progressService.on("progressStart", onStart);
  progressService.on("progressUpdate", onUpdate);
  progressService.on("progressComplete", onComplete);
  progressService.on("progressFailed", onFail);
  progressService.on("progressRemoved", onRemove);

  setupSSECleanup(req, res, {
    progressStart: onStart,
    progressUpdate: onUpdate,
    progressComplete: onComplete,
    progressFailed: onFail,
    progressRemoved: onRemove,
  });
};

// SSE for MODULE-specific progress
export const streamModuleProgress = async (req, res) => {
  const { moduleName } = req.params;

  setupSSEHeaders(res);

  const sendEvent = (event, data) => {
    // Only send if it's for our module
    if (data.module === moduleName) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Send initial state of module tasks
  const moduleTasks = progressService.getTasksByModule(moduleName);
  sendEvent("init", moduleTasks);

  // Listen for updates for THIS MODULE
  const onStart = (task) => sendEvent("start", task);
  const onUpdate = (task) => sendEvent("update", task);
  const onComplete = (task) => sendEvent("complete", task);
  const onFail = (task) => sendEvent("fail", task);
  const onRemove = (taskId) => sendEvent("remove", { taskId });

  progressService.on("progressStart", onStart);
  progressService.on("progressUpdate", onUpdate);
  progressService.on("progressComplete", onComplete);
  progressService.on("progressFailed", onFail);
  progressService.on("progressRemoved", onRemove);

  setupSSECleanup(req, res, {
    progressStart: onStart,
    progressUpdate: onUpdate,
    progressComplete: onComplete,
    progressFailed: onFail,
    progressRemoved: onRemove,
  });
};

// Helper function to setup SSE headers
function setupSSEHeaders(res) {
  res.set({
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });
  res.flushHeaders();
}

// Helper function to setup SSE cleanup
function setupSSECleanup(req, res, listeners) {
  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": heartbeat\n\n");
    }
  }, 30000);

  // Cleanup on connection close
  req.on("close", () => {
    clearInterval(heartbeat);
    progressService.off("progressStart", listeners.progressStart);
    progressService.off("progressUpdate", listeners.progressUpdate);
    progressService.off("progressComplete", listeners.progressComplete);
    progressService.off("progressFailed", listeners.progressFailed);
    progressService.off("progressRemoved", listeners.progressRemoved);
    if (!res.writableEnded) {
      res.end();
    }
  });
}

// REST endpoints (tetap sama)
export const getAllProgress = async (req, res) => {
  try {
    const tasks = progressService.getProgress();

    res.json({
      success: true,
      data: tasks,
      count: Object.keys(tasks).length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTaskProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = progressService.getProgress(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getActiveProgress = async (req, res) => {
  try {
    const activeTasks = progressService.getActiveTasks();

    res.json({
      success: true,
      data: activeTasks,
      count: activeTasks.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getModuleProgress = async (req, res) => {
  try {
    const { moduleName } = req.params;
    const moduleTasks = progressService.getTasksByModule(moduleName);

    res.json({
      success: true,
      data: moduleTasks,
      count: moduleTasks.length,
      module: moduleName,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getQueueStatus = async (req, res) => {
  try {
    const queueStatus = progressService.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await progressService.cancelTask(taskId);
    res.json({
      success: true,
      message: `Task '${taskId}' berhasil dibatalkan`,
      data: task,
    });
  } catch (error) {
    const statusCode = error.message.includes("tidak ditemukan") ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

export const cleanupProgress = async (req, res) => {
  try {
    const { maxAgeHours = 6 } = req.body;
    await progressService.cleanupOldTasks(maxAgeHours);

    res.json({
      success: true,
      message: "Cleanup completed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
