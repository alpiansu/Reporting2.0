/**
 * PrepClosing Routes
 * Defines API endpoints for prep closing operations
 */
import express from 'express';
import { param, query } from 'express-validator';
import prepClosingController from './prep_closing.controller.js';

const {
  getAllPrepClosing,
  getPrepClosingById,
  createPrepClosing,
  updatePrepClosing,
  deletePrepClosing,
  getPrepClosingStats,
  createPrepClosingValidation,
  updatePrepClosingValidation
} = prepClosingController;

const router = express.Router();

// Validation middleware
const validateIdParam = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

const validateQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('cab')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Cab must be maximum 10 characters'),
  query('kdtk')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Kdtk must be maximum 10 characters'),
  query('key')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Key must be maximum 50 characters'),
  query('valid')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('Valid must be 0 or 1')
];

// Routes
/**
 * @route GET /api/prep-closing
 * @desc Get all prep closing records with optional filters and pagination
 * @access Public
 */
router.get('/', validateQuery, getAllPrepClosing);

/**
 * @route GET /api/prep-closing/stats
 * @desc Get prep closing statistics
 * @access Public
 */
router.get('/stats', getPrepClosingStats);

/**
 * @route GET /api/prep-closing/:id
 * @desc Get prep closing record by ID
 * @access Public
 */
router.get('/:id', validateIdParam, getPrepClosingById);

/**
 * @route POST /api/prep-closing
 * @desc Create new prep closing record
 * @access Public
 */
router.post('/', createPrepClosingValidation, createPrepClosing);

/**
 * @route PUT /api/prep-closing/:id
 * @desc Update prep closing record by ID
 * @access Public
 */
router.put('/:id', updatePrepClosingValidation, updatePrepClosing);

/**
 * @route DELETE /api/prep-closing/:id
 * @desc Delete prep closing record by ID
 * @access Public
 */
router.delete('/:id', validateIdParam, deletePrepClosing);

export default router;