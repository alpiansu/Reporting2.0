/**
 * Sync module index
 */
const SyncController = require('./sync.controller');
const syncRoutes = require('./sync.routes');
const SyncService = require('./sync.service');
const TriggerSyncService = require('./trigger-sync.service');
const CronScheduler = require('./cron-scheduler.service');
const ExternalDbService = require('./external-db.service');

module.exports = {
  SyncController,
  syncRoutes,
  SyncService,
  TriggerSyncService,
  CronScheduler,
  ExternalDbService,
  // Export a function to initialize the module
  init: async () => {
    const cronScheduler = new CronScheduler();
    await cronScheduler.init();
    return true;
  },
  // New initialize function for use with app.js
  initialize: (app) => {
    // Initialize services
    const externalDbService = new ExternalDbService();
    const syncService = new SyncService();
    const triggerSyncService = new TriggerSyncService();
    const cronScheduler = new CronScheduler();
    
    // Initialize cron scheduler
    cronScheduler.initialize();
    
    // Register routes
    app.use('/api/sync', syncRoutes);
    
    return {
      syncService,
      triggerSyncService,
      cronScheduler,
      externalDbService
    };
  }
};