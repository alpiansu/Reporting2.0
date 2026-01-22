/**
 * Configuration for progress module
 */
import path from "path";

export default {
  // JSON file for storing progress states
  jsonPath: path.join(process.cwd(), "data/progress.json"),

  // Maximum number of concurrent running tasks
  maxConcurrentTasks: 1,

  // Cleanup configuration
  cleanup: {
    enabled: true,
    maxAgeHours: 6, // delete tasks older than 6 hours
    intervalMinutes: 30, // cleanup interval
  },
};
