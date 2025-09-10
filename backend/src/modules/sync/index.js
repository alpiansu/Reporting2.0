/**
 * Sync module index
 */
import SyncController from './sync.controller.js';
import syncRoutes from './sync.routes.js';
import SyncService from './sync.service.js';
import TriggerSyncService from './trigger-sync.service.js';
import CronScheduler from './cron-scheduler.service.js';
import ExternalDbService from './external-db.service.js';

export default {
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