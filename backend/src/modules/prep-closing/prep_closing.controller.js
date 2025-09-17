/**
 * Controller for prep closing operations
 * Handles HTTP requests and responses for prep closing data
 */
import prepClosingService from './prep_closing.service.js';
import logger from '../../config/logger.js';
import { body, param, query, validationResult } from 'express-validator';
/**
 * Get all prep closing data with optional filters
 */
export const getAllPrepClosing = async (req, res) => {
  try {
    const { cab, kdtk, key, valid, limit = 100, offset = 0 } = req.query;
    
    const filters = {};
    if (cab) filters.cab = cab;
    if (kdtk) filters.kdtk = kdtk;
    if (key) filters.key = key;
    if (valid !== undefined) filters.valid = valid;

    const data = await prepClosingService.getAllPrepClosing(filters, parseInt(limit), parseInt(offset));
    const total = await prepClosingService.getCount(filters);
    
    res.json({
      success: true,
      data: data,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    logger.error('Error in getAllPrepClosing:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get prep closing by ID
 */
export const getPrepClosingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: id'
      });
    }

    const record = await prepClosingService.getPrepClosingById(parseInt(id));
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Prep closing record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    logger.error('Error in getPrepClosingById:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Create new prep closing record
 */
export const createPrepClosing = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { cab, kdtk, key, nilai, valid = 1 } = req.body;

    const prepClosingData = {
      cab,
      kdtk,
      key,
      nilai,
      valid: parseInt(valid)
    };

    const result = await prepClosingService.addPrepClosing(prepClosingData);
    
    res.status(201).json({
      success: true,
      message: 'Prep closing record created successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error in createPrepClosing:', error);
    
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      return res.status(409).json({
        success: false,
        message: 'Prep closing record already exists',
        error: error.message
      });
    }

    if (error.message.includes('Database sedang tidak tersedia')) {
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update prep closing record by ID
 */
export const updatePrepClosing = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: id'
      });
    }

    // Remove id from update data to prevent conflicts
    delete updateData.id;

    const result = await prepClosingService.updatePrepClosing(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Prep closing record updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error in updatePrepClosing:', error);
    
    if (error.message.includes('Record not found')) {
      return res.status(404).json({
        success: false,
        message: 'Prep closing record not found',
        error: error.message
      });
    }

    if (error.message.includes('Database sedang tidak tersedia')) {
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Delete prep closing record by ID
 */
export const deletePrepClosing = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: id'
      });
    }

    const result = await prepClosingService.deletePrepClosing(parseInt(id));

    res.json({
      success: true,
      message: 'Prep closing record deleted successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error in deletePrepClosing:', error);
    
    if (error.message.includes('Record not found')) {
      return res.status(404).json({
        success: false,
        message: 'Prep closing record not found',
        error: error.message
      });
    }

    if (error.message.includes('Database sedang tidak tersedia')) {
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get prep closing statistics
 */
export const getPrepClosingStats = async (req, res) => {
  try {
    const { cab, kdtk } = req.query;
    
    const filters = {};
    if (cab) filters.cab = cab;
    if (kdtk) filters.kdtk = kdtk;

    const total = await prepClosingService.getCount(filters);
    const valid = await prepClosingService.getCount({ ...filters, valid: 1 });
    const invalid = await prepClosingService.getCount({ ...filters, valid: 0 });
    
    const stats = {
      total,
      valid,
      invalid,
      filters
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error in getPrepClosingStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Validation rules
export const createPrepClosingValidation = [
  body('cab').notEmpty().withMessage('Cab is required').isLength({ max: 10 }).withMessage('Cab must be max 10 characters'),
  body('kdtk').notEmpty().withMessage('Kdtk is required').isLength({ max: 10 }).withMessage('Kdtk must be max 10 characters'),
  body('key').notEmpty().withMessage('Key is required').isLength({ max: 50 }).withMessage('Key must be max 50 characters'),
  body('nilai').optional().isDecimal().withMessage('Nilai must be a decimal number'),
  body('valid').optional().isInt({ min: 0, max: 1 }).withMessage('Valid must be 0 or 1')
];

export const updatePrepClosingValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('cab').optional().isLength({ max: 10 }).withMessage('Cab must be max 10 characters'),
  body('kdtk').optional().isLength({ max: 10 }).withMessage('Kdtk must be max 10 characters'),
  body('key').optional().isLength({ max: 50 }).withMessage('Key must be max 50 characters'),
  body('nilai').optional().isDecimal().withMessage('Nilai must be a decimal number'),
  body('valid').optional().isInt({ min: 0, max: 1 }).withMessage('Valid must be 0 or 1')
];

// Default export
export default {
  getAllPrepClosing,
  getPrepClosingById,
  createPrepClosing,
  updatePrepClosing,
  deletePrepClosing,
  getPrepClosingStats,
  createPrepClosingValidation,
  updatePrepClosingValidation
};