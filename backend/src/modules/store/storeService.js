/**
 * Store service module - provides compatibility layer for old storeService imports
 * This file ensures backward compatibility with code that imports from '../services/storeService'
 */

// Import the store service class
import StoreService from './store.service.js';

// Create a singleton instance of the store service
const storeService = new StoreService();

// Initialize the service
storeService.initialize().catch(err => {
  console.error('Failed to initialize store service:', err);
});

// Export the singleton instance for backward compatibility
export default storeService;