/**
 * Prep Closing Module
 * Exports all prep closing related functionality
 */
import prepClosingController from './prep_closing.controller.js';
import prepClosingService from './prep_closing.service.js';
import prepClosingRoutes from './prep_closing.routes.js';

const prepClosingModule = {
  controller: prepClosingController,
  service: prepClosingService,
  routes: prepClosingRoutes,
  
  // Initialize service and register routes
  initialize: (app) => {
    // Initialize service
    prepClosingService.initialize().catch(error => {
      console.error('Failed to initialize prep closing service:', error);
    });
    
    // Register routes
    app.use('/api/prep-closing', prepClosingRoutes);
    
    return {
      prepClosingService
    };
  }
};

export default prepClosingModule;