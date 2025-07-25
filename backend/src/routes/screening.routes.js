const express = require('express');
const { screeningController } = require('../controllers');
const { authenticateJWT, authorizeRole } = require('../middlewares');

const router = express.Router();

/**
 * @route GET /api/screenings
 * @desc Get all screenings with pagination
 * @access Private
 */
router.get('/', authenticateJWT, screeningController.getAllScreenings);

/**
 * @route GET /api/screenings/:id
 * @desc Get screening by ID
 * @access Private
 */
router.get('/:id', authenticateJWT, screeningController.getScreeningById);

/**
 * @route POST /api/screenings
 * @desc Start a new screening process
 * @access Private
 */
router.post('/', authenticateJWT, screeningController.startScreening);

/**
 * @route GET /api/screenings/:id/progress
 * @desc Get screening progress
 * @access Private
 */
router.get('/:id/progress', authenticateJWT, screeningController.getProgress);

/**
 * @route POST /api/screenings/:id/cancel
 * @desc Cancel an in-progress screening
 * @access Private
 */
router.post('/:id/cancel', authenticateJWT, screeningController.cancelScreening);

/**
 * @route GET /api/screenings/statistics
 * @desc Get screening statistics
 * @access Private (Admin/Manager only)
 */
router.get('/statistics', authenticateJWT, authorizeRole(['admin', 'manager']), screeningController.getStatistics);

module.exports = router;