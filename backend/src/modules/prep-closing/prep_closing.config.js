/**
 * Configuration for prep_closing module
 */
export default {
  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    concurrencyLimit: 8, // Max stores at once
    branchConcurrencyLimit: 2, // Max branches at once
    storeTimeoutMs: 120000, // 2 minutes per store
    queryTimeoutMs: 10000, // 10 seconds per query
  },

  // Task progress name
  taskProgressName: "prepClosingTask",

  // Cache TTL (1 hour)
  cacheTTL: 60 * 60 * 1000,

  // Rules file path
  rulesPath: "src/modules/prep-closing/rules/rules.json",
};
