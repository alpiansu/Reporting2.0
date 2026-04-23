/**
 * Configuration for buat_rmb module
 */

export default {
  // Query templates
  queries: {
    store: {
      init: [
        // Placeholder queries for init sequence
        `DROP TABLE IF EXISTS simul_rmb_mst`,
      ],
      insertTran: `
        -- Template query insert
        -- INSERT IGNORE INTO ... (KDTK, TANGGAL, PRDCD, NOHP, TRXID)
      `,
      finalize: [
        // Placeholder queries for finalize sequence
      ],
    },
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    concurrencyLimit: 5,
    branchConcurrencyLimit: 3,
    storeTimeoutMs: 10000, 
    queryTimeoutMs: 8000, 
  },

  taskProgressName: "rmbTask",
};
