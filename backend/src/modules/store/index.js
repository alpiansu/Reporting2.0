/**
 * Store module index
 */
const StoreController = require('./store.controller');
const storeRoutes = require('./store.routes');
const StoreService = require('./store.service');

module.exports = {
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