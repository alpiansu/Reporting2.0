/**
 * Configuration for ceklist_prep_closing module
 */
export default {
  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
  },

  // Cache TTL (1 hour)
  cacheTTL: 60 * 60 * 1000,

  // JSON fallback data directory
  dataDir: 'data/ceklist_prep_closing',

  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};
