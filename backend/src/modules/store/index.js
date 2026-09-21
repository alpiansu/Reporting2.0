/**
 * Store module index
 */
import {
  getAllStores,
  getStoreById,
  getStoresByBranch,
  createStore,
  updateStore,
  deleteStore,
  testConnection,
  uploadTokomain,
  getSyncStatus,
  syncMaster,
} from './store.controller.js';
import storeRoutes from './store.routes.js';
import StoreService from './store.service.js';

const StoreController = {
  getAllStores,
  getStoreById,
  getStoresByBranch,
  createStore,
  updateStore,
  deleteStore,
  testConnection,
  uploadTokomain,
  getSyncStatus,
  syncMaster,
};

export default {
  StoreController,
  storeRoutes,
  StoreService,
  initialize: (app) => {
    // Initialize the store service
    const storeService = new StoreService();
    storeService.initialize();
    
    // Register routes
    app.use('/api/stores', storeRoutes);
    
    return {
      storeService
    };
  }
};