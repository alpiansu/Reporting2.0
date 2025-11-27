/**
 * Configuration for rekon_sales module
 */
export default {
  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    concurrencyLimit: 5, // Max stores at once
    branchConcurrencyLimit: 2, // Max branches at once
    storeTimeoutMs: 120000, // 2 minutes per store
    queryTimeoutMs: 10000, // 10 seconds per query
  },

  // Task progress name
  taskProgressName: "rekonSalesTask",

  // Cache TTL settings
  cache: {
    summaryTTL: 60 * 60 * 1000, // 1 hour for summary data
    detailTTL: 5 * 60 * 1000, // 5 minutes for detail data
    cleanupInterval: 10 * 60 * 1000, // Run cleanup every 10 minutes
    inactiveThreshold: 30 * 60 * 1000, // 30 minutes of inactivity before cleanup
  },

  // Storage paths
  storage: {
    baseDir: "data/rekon_sales", // Base directory for JSON files
    filePrefix: "rekon_sales", // Prefix for JSON files
  },

  // Tolerance for differences (in Rupiah)
  tolerance: 50,

  // Sub BKP Bebas PPN
  subBkpBebasPPN: "('K','D','M','U','A','Q','E','L','P','F','B','J','H','T','R','I','O','S')",
};
