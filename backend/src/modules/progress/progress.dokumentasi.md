# Progress Tracking Module Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Module Structure](#module-structure)
- [Installation & Setup](#installation--setup)
- [API Reference](#api-reference)
- [Service Methods](#service-methods)
- [Events](#events)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The Progress Tracking Module is designed to monitor and track long-running tasks in real-time. It provides mechanisms for registering tasks, updating progress, and delivering live updates to clients via Server-Sent Events (SSE).

## ✨ Features

- ✅ **Real-time Tracking** - Live progress updates via SSE
- ✅ **Concurrent Control** - Limit simultaneous running tasks
- ✅ **State Persistence** - Save progress state in JSON file
- ✅ **Modular Design** - Easy integration with other modules
- ✅ **Multiple SSE Endpoints** - Flexible streaming options
- ✅ **Auto Cleanup** - Automatic cleanup of completed tasks
- ✅ **Error Handling** - Graceful error handling
- ✅ **RESTful API** - Comprehensive monitoring API

## 📁 Module Structure

```
src/modules/progress/
├── index.js                 # Module entry point
├── progress.config.js       # Configuration
├── progress.controller.js   # HTTP & SSE controllers
├── progress.routes.js       # Route definitions
└── progress.service.js      # Business logic
```

## 🚀 Installation & Setup

### 1. Import and Initialize

```javascript
// app.js or main server file
import progressModule from "./modules/progress/index.js";

// Initialize module
const { progressService } = progressModule.initialize(app);
```

### 2. Basic Integration

```javascript
// In your service module
import progressService from "../progress/progress.service.js";

class MyService {
  async longRunningProcess(data) {
    const taskId = `process-${Date.now()}`;

    try {
      // Register progress
      await progressService.startProgress(taskId, data.length, {
        module: "my-module",
        description: "Processing data",
      });

      // Process items
      for (let i = 0; i < data.length; i++) {
        await this.processItem(data[i]);
        await progressService.updateProgress(taskId, i + 1, {
          currentItem: data[i].id,
          detail: `Processed ${i + 1}/${data.length} items`,
        });
      }

      // Mark as completed
      await progressService.completeProgress(taskId);
    } catch (error) {
      await progressService.failProgress(taskId, error.message);
      throw error;
    }
  }
}
```

## 🌐 API Reference

### SSE Stream Endpoints

#### 1. Global Stream - All Tasks

```http
GET /api/progress/stream
```

**Purpose:** Admin dashboard monitoring all tasks

**Events:**

- `init` - Initial state of all tasks
- `start` - New task registered
- `update` - Progress updated
- `complete` - Task completed
- `fail` - Task failed
- `remove` - Task removed

#### 2. Task-specific Stream

```http
GET /api/progress/stream/task/:taskId
```

**Purpose:** Monitor specific task only

**Features:**

- Auto-closes when task completes/fails
- Only receives updates for subscribed task

#### 3. Module-specific Stream

```http
GET /api/progress/stream/module/:moduleName
```

**Purpose:** Monitor tasks for specific module

**Example:**

```http
GET /api/progress/stream/module/rekon-wt-harian
```

### REST API Endpoints

#### Get All Tasks

```http
GET /api/progress
```

**Response:**

```json
{
  "success": true,
  "data": {
    "task-123": {
      "id": "task-123",
      "total": 100,
      "completed": 75,
      "percentage": 75,
      "status": "in-progress",
      "module": "rekon-wt-harian",
      "info": "Processing store 001",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    }
  },
  "count": 1
}
```

#### Get Active Tasks

```http
GET /api/progress/active
```

#### Get Specific Task

```http
GET /api/progress/:taskId
```

#### Get Tasks by Module

```http
GET /api/progress/module/:moduleName
```

#### Get Queue Status

```http
GET /api/progress/queue
```

**Response:**

```json
{
  "success": true,
  "data": {
    "maxConcurrent": 3,
    "currentActive": 2,
    "canAcceptNew": true,
    "activeTasks": [
      {
        "id": "task-123",
        "module": "rekon-wt-harian",
        "percentage": 75,
        "info": "Processing store 001",
        "status": "in-progress"
      }
    ]
  }
}
```

#### Manual Cleanup (Admin)

```http
POST /api/progress/cleanup
```

**Body:**

```json
{
  "maxAgeHours": 6
}
```

## 🔧 Service Methods

### startProgress(taskId, total, info)

Register a new progress task.

**Parameters:**

- `taskId` (string) - Unique task identifier
- `total` (number) - Total progress units (default: 100)
- `info` (string|object) - Additional information

**Returns:** `Promise<taskObject>`

**Throws:** Error if maximum concurrent tasks reached

**Example:**

```javascript
const task = await progressService.startProgress("task-123", 100, {
  module: "my-module",
  description: "Processing data",
  userId: "user123",
});
```

### updateProgress(taskId, completed, info)

Update progress of a running task.

**Parameters:**

- `taskId` (string) - Task identifier
- `completed` (number) - Completed progress units
- `info` (string|object) - Additional information (optional)

**Returns:** `Promise<taskObject>`

**Throws:** Error if task not found

### completeProgress(taskId)

Mark task as completed.

**Parameters:**

- `taskId` (string) - Task identifier

**Returns:** `Promise<taskObject>`

### failProgress(taskId, errorMessage)

Mark task as failed.

**Parameters:**

- `taskId` (string) - Task identifier
- `errorMessage` (string) - Error description

**Returns:** `Promise<taskObject>`

### getProgress(taskId)

Get specific task or all tasks.

**Parameters:**

- `taskId` (string) - Task identifier (optional)

**Returns:** `taskObject` or all tasks

### getActiveTasks()

Get only active tasks.

**Returns:** `Array<taskObject>`

### getTasksByModule(moduleName)

Get tasks by module name.

**Parameters:**

- `moduleName` (string) - Module identifier

**Returns:** `Array<taskObject>`

### getQueueStatus()

Get system capacity status.

**Returns:** `Object`

## 📡 Events

The service emits these events:

### progressStart

Emitted when new task is registered.

```javascript
progressService.on("progressStart", task => {
  console.log("Task started:", task.id);
});
```

### progressUpdate

Emitted when task progress is updated.

```javascript
progressService.on("progressUpdate", task => {
  console.log("Progress updated:", task.percentage + "%");
});
```

### progressComplete

Emitted when task completes.

```javascript
progressService.on("progressComplete", task => {
  console.log("Task completed:", task.id);
});
```

### progressFailed

Emitted when task fails.

```javascript
progressService.on("progressFailed", task => {
  console.log("Task failed:", task.error);
});
```

### progressRemoved

Emitted when task is removed.

```javascript
progressService.on("progressRemoved", taskId => {
  console.log("Task removed:", taskId);
});
```

## 💻 Usage Examples

### Backend Implementation

#### Basic Service Integration

```javascript
import progressService from "../progress/progress.service.js";

class DataProcessor {
  constructor() {
    this.moduleName = "data-processor";
  }

  async processBatch(data) {
    const taskId = `process-${Date.now()}`;

    try {
      // Register progress
      await progressService.startProgress(taskId, data.length, {
        module: this.moduleName,
        description: "Processing data batch",
        itemCount: data.length,
      });

      // Process items
      for (let i = 0; i < data.length; i++) {
        await this.processItem(data[i]);

        // Update progress
        await progressService.updateProgress(taskId, i + 1, {
          currentItem: data[i].id,
          processed: i + 1,
          remaining: data.length - i - 1,
        });
      }

      // Complete
      await progressService.completeProgress(taskId);

      return { success: true, taskId };
    } catch (error) {
      await progressService.failProgress(taskId, error.message);
      throw error;
    }
  }
}
```

#### Advanced Service with Error Handling

```javascript
class RobustService {
  async complexProcess(data) {
    const taskId = `complex-${Date.now()}`;

    // Check system capacity
    const queueStatus = progressService.getQueueStatus();
    if (!queueStatus.canAcceptNew) {
      throw new Error(`System busy. ${queueStatus.currentActive}/${queueStatus.maxConcurrent} tasks running.`);
    }

    try {
      // Register with detailed info
      await progressService.startProgress(taskId, 100, {
        module: "robust-service",
        description: "Complex data processing",
        dataSize: data.length,
        startTime: new Date().toISOString(),
        metadata: {
          type: "batch-processing",
          priority: "high",
        },
      });

      // Multi-step process
      await this.step1(data, taskId); // 0-30%
      await this.step2(data, taskId); // 30-60%
      await this.step3(data, taskId); // 60-90%
      await this.finalize(data, taskId); // 90-100%

      await progressService.completeProgress(taskId);
    } catch (error) {
      // Log additional error context
      await progressService.failProgress(taskId, error.message, {
        failedStep: this.currentStep,
        errorDetails: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async step1(data, taskId) {
    await progressService.updateProgress(taskId, 30, {
      step: "Data Validation",
      detail: "Validating input data...",
    });
    // ... implementation
  }
}
```

### Frontend Implementation

#### Global Monitor Component

```javascript
class GlobalProgressMonitor {
  constructor() {
    this.eventSource = null;
    this.tasks = new Map();
  }

  connect() {
    this.eventSource = new EventSource("/api/progress/stream");

    this.eventSource.onmessage = event => {
      if (event.data === ": heartbeat") return;
      this.handleEvent(event.type, JSON.parse(event.data));
    };

    // Event listeners
    this.eventSource.addEventListener("init", event => {
      const allTasks = JSON.parse(event.data);
      this.initializeTasks(allTasks);
    });

    this.eventSource.addEventListener("start", event => {
      const task = JSON.parse(event.data);
      this.addTask(task);
    });

    this.eventSource.addEventListener("update", event => {
      const task = JSON.parse(event.data);
      this.updateTask(task);
    });

    this.eventSource.addEventListener("complete", event => {
      const task = JSON.parse(event.data);
      this.completeTask(task);
    });

    this.eventSource.addEventListener("fail", event => {
      const task = JSON.parse(event.data);
      this.failTask(task);
    });

    this.eventSource.onerror = error => {
      console.error("SSE Error:", error);
      this.reconnect();
    };
  }

  initializeTasks(allTasks) {
    Object.values(allTasks).forEach(task => {
      this.tasks.set(task.id, task);
    });
    this.render();
  }

  addTask(task) {
    this.tasks.set(task.id, task);
    this.renderTask(task);
  }

  updateTask(task) {
    this.tasks.set(task.id, task);
    this.updateTaskUI(task.id);
  }

  completeTask(task) {
    task.status = "completed";
    this.tasks.set(task.id, task);
    this.updateTaskUI(task.id);

    // Auto-remove after delay
    setTimeout(() => {
      this.tasks.delete(task.id);
      this.removeTaskUI(task.id);
    }, 5000);
  }

  render() {
    const container = document.getElementById("progress-container");
    container.innerHTML = "";

    this.tasks.forEach(task => {
      container.appendChild(this.createTaskElement(task));
    });
  }

  createTaskElement(task) {
    const div = document.createElement("div");
    div.className = `progress-item ${task.status}`;
    div.id = `task-${task.id}`;

    div.innerHTML = `
      <div class="progress-header">
        <strong>${task.id}</strong>
        <span class="badge module">${task.module || "Unknown"}</span>
        <span class="badge status ${task.status}">${task.status}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${task.percentage}%"></div>
        <span class="progress-text">${task.percentage}%</span>
      </div>
      <div class="progress-info">
        <div class="info">${task.info || ""}</div>
        ${task.error ? `<div class="error">Error: ${task.error}</div>` : ""}
      </div>
      <div class="progress-meta">
        <small>Created: ${new Date(task.createdAt).toLocaleString()}</small>
        <small>Updated: ${new Date(task.updatedAt).toLocaleString()}</small>
      </div>
    `;

    return div;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}
```

#### Task-specific Monitor

```javascript
class TaskProgressMonitor {
  constructor(taskId, options = {}) {
    this.taskId = taskId;
    this.options = {
      autoClose: true,
      onUpdate: null,
      onComplete: null,
      onError: null,
      ...options,
    };
  }

  connect() {
    this.eventSource = new EventSource(`/api/progress/stream/task/${this.taskId}`);

    this.eventSource.onmessage = event => {
      if (event.data === ": heartbeat") return;

      const task = JSON.parse(event.data);

      // Call update callback
      if (this.options.onUpdate) {
        this.options.onUpdate(task);
      }

      this.updateUI(task);

      // Handle completion
      if (task.status === "completed" && this.options.autoClose) {
        if (this.options.onComplete) {
          this.options.onComplete(task);
        }
        this.disconnect();
      }

      // Handle failure
      if (task.status === "failed" && this.options.autoClose) {
        if (this.options.onError) {
          this.options.onError(task);
        }
        this.disconnect();
      }
    };
  }

  updateUI(task) {
    // Update progress bar
    const progressBar = document.querySelector(".progress-fill");
    const progressText = document.querySelector(".progress-text");

    if (progressBar) {
      progressBar.style.width = `${task.percentage}%`;
    }
    if (progressText) {
      progressText.textContent = `${task.percentage}%`;
    }

    // Update info
    const infoElement = document.querySelector(".progress-info");
    if (infoElement && task.info) {
      infoElement.textContent = task.info;
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Usage
const taskMonitor = new TaskProgressMonitor("task-123", {
  onUpdate: task => {
    console.log("Progress:", task.percentage + "%");
  },
  onComplete: task => {
    alert("Task completed successfully!");
  },
  onError: task => {
    alert(`Task failed: ${task.error}`);
  },
});

taskMonitor.connect();
```

#### Module-specific Dashboard

```javascript
class ModuleDashboard {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.eventSource = null;
    this.tasks = new Map();
  }

  connect() {
    this.eventSource = new EventSource(`/api/progress/stream/module/${this.moduleName}`);

    this.eventSource.onmessage = event => {
      if (event.data === ": heartbeat") return;

      const data = JSON.parse(event.data);
      this.handleModuleUpdate(data);
    };

    // Load initial state
    this.loadInitialData();
  }

  async loadInitialData() {
    try {
      const response = await fetch(`/api/progress/module/${this.moduleName}`);
      const result = await response.json();

      if (result.success) {
        result.data.forEach(task => {
          this.tasks.set(task.id, task);
        });
        this.render();
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }

  handleModuleUpdate(task) {
    if (Array.isArray(task)) {
      // Initial data
      task.forEach(t => this.tasks.set(t.id, t));
    } else {
      // Single task update
      this.tasks.set(task.id, task);
    }
    this.render();
  }

  render() {
    const container = document.getElementById("module-progress");
    container.innerHTML = "";

    this.tasks.forEach(task => {
      if (task.status === "in-progress") {
        container.appendChild(this.createTaskCard(task));
      }
    });
  }

  createTaskCard(task) {
    const card = document.createElement("div");
    card.className = "task-card";
    card.innerHTML = `
      <h4>${task.id}</h4>
      <div class="progress">
        <div class="progress-bar" style="width: ${task.percentage}%"></div>
      </div>
      <p>${task.info || ""}</p>
      <small>${task.percentage}% complete</small>
    `;
    return card;
  }
}

// Usage for rekon WT module
const rekonDashboard = new ModuleDashboard("rekon-wt-harian");
rekonDashboard.connect();
```

## ⚙️ Configuration

### progress.config.js

```javascript
import path from "path";

export default {
  // JSON file for storing progress state
  jsonPath: path.join(process.cwd(), "data/progress-state.json"),

  // Maximum concurrent tasks
  maxConcurrentTasks: 3,

  // Cleanup configuration
  cleanup: {
    enabled: true,
    maxAgeHours: 6, // Remove tasks older than 6 hours
    intervalMinutes: 30, // Cleanup interval
  },
};
```

### Environment-based Configuration

```javascript
// config/progress.config.js
export default {
  jsonPath: process.env.PROGRESS_STATE_FILE || "./data/progress-state.json",
  maxConcurrentTasks: parseInt(process.env.PROGRESS_MAX_CONCURRENT) || 3,
  cleanup: {
    enabled: process.env.PROGRESS_CLEANUP_ENABLED !== "false",
    maxAgeHours: parseInt(process.env.PROGRESS_CLEANUP_MAX_AGE) || 6,
    intervalMinutes: parseInt(process.env.PROGRESS_CLEANUP_INTERVAL) || 30,
  },
};
```

## 🏆 Best Practices

### 1. Task ID Generation

```javascript
// Good - descriptive and unique
const taskId = `rekon-wt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Good - with context
const taskId = `export-${userId}-${Date.now()}`;

// Avoid - non-descriptive
const taskId = "task-1"; // ❌
```

### 2. Progress Update Frequency

```javascript
// Good - reasonable intervals
for (let i = 0; i <= 100; i += 10) {
  await processChunk(data[i]);
  await progressService.updateProgress(taskId, i);
}

// Avoid - too frequent
for (let i = 0; i <= 100; i++) {
  await processItem(data[i]);
  await progressService.updateProgress(taskId, i); // ❌
}
```

### 3. Error Handling

```javascript
// Good - comprehensive error handling
try {
  await progressService.startProgress(taskId, total, info);

  try {
    await mainProcess();
    await progressService.completeProgress(taskId);
  } catch (processError) {
    await progressService.failProgress(taskId, processError.message);
    throw processError;
  }
} catch (progressError) {
  console.error("Progress registration failed:", progressError);
  throw progressError;
}
```

### 4. Information Structure

```javascript
// Good - structured information
const taskInfo = {
  module: "rekon-wt-harian",
  description: "Rekonsiliasi WT Harian",
  storeCount: 50,
  startedBy: "user123",
  startTime: new Date().toISOString(),
  metadata: {
    region: "central",
    period: "2024-01",
  },
};
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "Maximum concurrent progress reached"

**Problem:** System rejects new tasks due to concurrency limit.

**Solution:**

```javascript
// Check capacity before starting
const queueStatus = progressService.getQueueStatus();
if (!queueStatus.canAcceptNew) {
  throw new Error(
    `System busy. Please try again later. ` +
      `(${queueStatus.currentActive}/${queueStatus.maxConcurrent} tasks running)`
  );
}
```

#### 2. SSE Connection Drops

**Problem:** Client loses connection to SSE stream.

**Solution:**

```javascript
class RobustSSEClient {
  constructor() {
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.eventSource = new EventSource("/api/progress/stream");

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.eventSource.onerror = () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    };
  }
}
```

#### 3. File Permission Issues

**Problem:** Cannot read/write state file.

**Solution:**

```javascript
// Ensure directory exists
import fs from "fs";

const ensureDirectory = filePath => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};
```

### Monitoring

#### Health Check

```javascript
// Add to your routes
router.get("/progress/health", (req, res) => {
  const queueStatus = progressService.getQueueStatus();
  const stateFileExists = fs.existsSync(config.jsonPath);

  res.json({
    status: "healthy",
    queueStatus,
    stateFile: stateFileExists ? "exists" : "missing",
    timestamp: new Date().toISOString(),
  });
});
```

#### Logging

```javascript
// Add debug logging
progressService.on("progressStart", task => {
  console.log(`[Progress] START: ${task.id}`, task);
});

progressService.on("progressUpdate", task => {
  console.log(`[Progress] UPDATE: ${task.id} - ${task.percentage}%`);
});
```

## 📝 License

This module is part of the main application and follows the same licensing terms.

---

**Last Updated:** January 2024  
**Version:** 2.0.0  
**Compatibility:** Node.js 16+, Express 4+
