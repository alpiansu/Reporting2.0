/**
 * PrepClosing Routes
 * Defines HTTP endpoints for prep closing operations
 */
import express from 'express';
import { body, param, query } from 'express-validator';
import prepClosingController from './prep_closing.controller.js';

const router = express.Router();

// Validation middleware
const validatePrepClosingCreate = [
  body('cab')
    .isLength({ min: 1, max: 4 })
    .withMessage('Cab must be 1-4 characters')
    .notEmpty()
    .withMessage('Cab is required'),
  body('kdtk')
    .isLength({ min: 1, max: 4 })
    .withMessage('Kdtk must be 1-4 characters')
    .notEmpty()
    .withMessage('Kdtk is required'),
  body('key')
    .isLength({ min: 1, max: 35 })
    .withMessage('Key must be 1-35 characters')
    .notEmpty()
    .withMessage('Key is required'),
  body('nilai')
    .optional()
    .isLength({ max: 35 })
    .withMessage('Nilai must not exceed 35 characters'),
  body('valid')
    .optional()
    .isBoolean()
    .withMessage('Valid must be a boolean value')
];

const validatePrepClosingUpdate = [
  body('nilai')
    .optional()
    .isLength({ max: 35 })
    .withMessage('Nilai must not exceed 35 characters'),
  body('valid')
    .optional()
    .isBoolean()
    .withMessage('Valid must be a boolean value')
];

const validatePrimaryKey = [
  param('cab')
    .isLength({ min: 1, max: 4 })
    .withMessage('Cab must be 1-4 characters')
    .notEmpty()
    .withMessage('Cab is required'),
  param('kdtk')
    .isLength({ min: 1, max: 4 })
    .withMessage('Kdtk must be 1-4 characters')
    .notEmpty()
    .withMessage('Kdtk is required'),
  param('key')
    .isLength({ min: 1, max: 35 })
    .withMessage('Key must be 1-35 characters')
    .notEmpty()
    .withMessage('Key is required')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000')
];

const validateFilters = [
  query('cab')
    .optional()
    .isLength({ max: 4 })
    .withMessage('Cab filter must not exceed 4 characters'),
  query('kdtk')
    .optional()
    .isLength({ max: 4 })
    .withMessage('Kdtk filter must not exceed 4 characters'),
  query('key')
    .optional()
    .isLength({ max: 35 })
    .withMessage('Key filter must not exceed 35 characters'),
  query('nilai')
    .optional()
    .isLength({ max: 35 })
    .withMessage('Nilai filter must not exceed 35 characters'),
  query('valid')
    .optional()
    .isIn(['true', 'false', true, false])
    .withMessage('Valid filter must be true or false')
];

// Routes

/**
 * @route GET /api/prep-closing
 * @desc Get all prep closing records with pagination and filters
 * @access Public
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Records per page (default: 50, max: 1000)
 * @query {string} cab - Filter by cab
 * @query {string} kdtk - Filter by kdtk
 * @query {string} key - Filter by key
 * @query {string} nilai - Filter by nilai
 * @query {boolean} valid - Filter by valid status
 */
router.get('/', 
  validatePagination,
  validateFilters,
  prepClosingController.getAllPrepClosing
);

/**
 * @route GET /api/prep-closing/search
 * @desc Search prep closing records with filters
 * @access Public
 * @query {string} cab - Filter by cab
 * @query {string} kdtk - Filter by kdtk
 * @query {string} key - Filter by key
 * @query {string} nilai - Filter by nilai
 * @query {boolean} valid - Filter by valid status
 * @query {number} limit - Limit results (default: 100)
 * @query {number} offset - Offset for pagination (default: 0)
 */
router.get('/search',
  validateFilters,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  prepClosingController.searchPrepClosing
);

/**
 * @route GET /api/prep-closing/count
 * @desc Get count of prep closing records with filters
 * @access Public
 * @query {string} cab - Filter by cab
 * @query {string} kdtk - Filter by kdtk
 * @query {string} key - Filter by key
 * @query {string} nilai - Filter by nilai
 * @query {boolean} valid - Filter by valid status
 */
router.get('/count',
  validateFilters,
  prepClosingController.getCount
);

/**
 * @route GET /api/prep-closing/:cab/:kdtk/:key
 * @desc Get prep closing record by primary key
 * @access Public
 * @param {string} cab - Cab code
 * @param {string} kdtk - Kdtk code
 * @param {string} key - Key identifier
 */
router.get('/:cab/:kdtk/:key',
  validatePrimaryKey,
  prepClosingController.getPrepClosingByPk
);

/**
 * @route POST /api/prep-closing
 * @desc Create new prep closing record
 * @access Public
 * @body {string} cab - Cab code (required, max 4 chars)
 * @body {string} kdtk - Kdtk code (required, max 4 chars)
 * @body {string} key - Key identifier (required, max 35 chars)
 * @body {string} nilai - Value (optional, max 35 chars)
 * @body {boolean} valid - Valid status (optional, default: true)
 */
router.post('/',
  validatePrepClosingCreate,
  prepClosingController.createPrepClosing
);

/**
 * @route POST /api/prep-closing/bulk
 * @desc Bulk create prep closing records
 * @access Public
 * @body {Array} records - Array of prep closing records
 */
router.post('/bulk',
  body('records')
    .isArray({ min: 1 })
    .withMessage('Records must be a non-empty array'),
  body('records.*.cab')
    .isLength({ min: 1, max: 4 })
    .withMessage('Each record cab must be 1-4 characters'),
  body('records.*.kdtk')
    .isLength({ min: 1, max: 4 })
    .withMessage('Each record kdtk must be 1-4 characters'),
  body('records.*.key')
    .isLength({ min: 1, max: 35 })
    .withMessage('Each record key must be 1-35 characters'),
  body('records.*.nilai')
    .optional()
    .isLength({ max: 35 })
    .withMessage('Each record nilai must not exceed 35 characters'),
  body('records.*.valid')
    .optional()
    .isBoolean()
    .withMessage('Each record valid must be a boolean value'),
  prepClosingController.bulkCreatePrepClosing
);

/**
 * @route PUT /api/prep-closing/upsert
 * @desc Upsert prep closing record (create or update)
 * @access Public
 * @body {string} cab - Cab code (required, max 4 chars)
 * @body {string} kdtk - Kdtk code (required, max 4 chars)
 * @body {string} key - Key identifier (required, max 35 chars)
 * @body {string} nilai - Value (optional, max 35 chars)
 * @body {boolean} valid - Valid status (optional, default: true)
 */
router.put('/upsert',
  validatePrepClosingCreate,
  prepClosingController.upsertPrepClosing
);

/**
 * @route PUT /api/prep-closing/:cab/:kdtk/:key
 * @desc Update prep closing record
 * @access Public
 * @param {string} cab - Cab code
 * @param {string} kdtk - Kdtk code
 * @param {string} key - Key identifier
 * @body {string} nilai - Value (optional, max 35 chars)
 * @body {boolean} valid - Valid status (optional)
 */
router.put('/:cab/:kdtk/:key',
  validatePrimaryKey,
  validatePrepClosingUpdate,
  prepClosingController.updatePrepClosing
);

/**
 * @route DELETE /api/prep-closing/:cab/:kdtk/:key
 * @desc Delete prep closing record
 * @access Public
 * @param {string} cab - Cab code
 * @param {string} kdtk - Kdtk code
 * @param {string} key - Key identifier
 */
router.delete('/:cab/:kdtk/:key',
  validatePrimaryKey,
  prepClosingController.deletePrepClosing
);

export default router;