const express = require('express');
const authRoutes = require('./auth.routes');
const storeRoutes = require('./store.routes');
const screeningRoutes = require('./screening.routes');

const router = express.Router();

// API Routes
router.use('/api/auth', authRoutes);
router.use('/api/stores', storeRoutes);
router.use('/api/screenings', screeningRoutes);

// API Documentation route
router.get('/api', (req, res) => {
  res.json({
    message: 'Web Reporting 2.0 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      stores: '/api/stores',
      screenings: '/api/screenings',
    },
  });
});

module.exports = router;