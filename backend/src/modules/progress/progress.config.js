/**
 * Configuration for progress module
 */
import path from "path";

export default {
  // JSON file for storing progress states
  jsonPath: path.join(process.cwd(), "data/progress.json"),

  // Maximum number of concurrent running tasks
  maxConcurrentTasks: 1,

  // Auto-expire tasks that have been stuck in "in-progress" for longer than this
  // (prevents crashed/killed processes from permanently blocking new tasks)
  //
  // Reasoning: during active screening, updateProgress() is called per-store completion
  // (worst-case gap = storeTimeoutMs = 90s). 120 minutes gives ~80x safety margin.
  // Only truly dead/crashed tasks (no updates for 2 hours) will be auto-expired.
  maxStaleMinutes: 120,

  // Cleanup configuration
  cleanup: {
    enabled: true,
    maxAgeHours: 6, // delete tasks older than 6 hours
    intervalMinutes: 30, // cleanup interval
  },
};
