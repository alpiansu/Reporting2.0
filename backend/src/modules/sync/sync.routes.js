/**
 * Routes for synchronization
 */
const express = require('express');
const SyncController = require('./sync.controller');
const syncController = new SyncController();
const { authenticateJWT } = require('../../middlewares');

const router = express.Router();

// Protect all sync routes with authentication
router.use(authenticateJWT);

// Trigger manual synchronization
router.post('/trigger', syncController.triggerSync.bind(syncController));

module.exports = router;