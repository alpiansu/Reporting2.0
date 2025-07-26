const express = require('express');
const { userActivityController } = require('../controllers');
const { authenticateJWT } = require('../middlewares');

const router = express.Router();

/**
 * @route GET /api/user-activities
 * @desc Get user activities
 * @access Private
 */
router.get('/', authenticateJWT, userActivityController.getUserActivities);

/**
 * @route POST /api/user-activities
 * @desc Log a user activity (for testing purposes)
 * @access Private
 */
router.post('/', authenticateJWT, userActivityController.logActivity);

module.exports = router;