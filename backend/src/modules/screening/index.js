/**
 * Screening module index
 */
const ScreeningController = require('./screening.controller');
const screeningRoutes = require('./screening.routes');
const ScreeningService = require('./screening.service');

module.exports = {
  ScreeningController,
  screeningRoutes,
  ScreeningService,
  initialize: (app) => {
    // Initialize services
    const screeningService = new ScreeningService();
    
    // Register routes
    app.use('/api/screenings', screeningRoutes);
    
    return {
      screeningService
    };
  }
};