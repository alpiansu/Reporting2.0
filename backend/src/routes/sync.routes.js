/**
 * Routes for synchronization
 */
const express = require('express');
const { syncController } = require('../controllers');
const { authenticateJWT } = require('../middlewares');

const router = express.Router();

// Protect all sync routes with authentication
router.use(authenticateJWT);

// Trigger manual synchronization
router.post('/trigger', syncController.triggerSync);

module.exports = router;