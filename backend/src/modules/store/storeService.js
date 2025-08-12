/**
 * Store service module - provides compatibility layer for old storeService imports
 * This file ensures backward compatibility with code that imports from '../services/storeService'
 */

// Import the store service class
const StoreService = require('./store.service');

// Create a singleton instance of the store service
const storeService = new StoreService();

// Initialize the service
storeService.initialize().catch(err => {
  console.error('Failed to initialize store service:', err);
});

// Export the singleton instance for backward compatibility
module.exports = storeService;