/**
 * PrepClosing Controller
 * Handles HTTP requests for prep closing operations
 */
import prepClosingModel from '../../models/prep_closing.model.js';
import logger from '../../config/logger.js';
import { validationResult } from 'express-validator';

class PrepClosingController {
  /**
   * Get all prep closing records with pagination and filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllPrepClosing(req, res) {
    try {
      const { page = 1, limit = 50, ...filterParams } = req.query;
      const filters = prepClosingModel.extractFilters(filterParams);
      
      const result = await prepClosingModel.getPaginatedData(
        filters,
        parseInt(page),
        parseInt(limit)
      );
      
      res.json({
        success: true,
        message: 'Prep closing data retrieved successfully',
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error getting prep closing data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve prep closing data',
        error: error.message
      });
    }
  }

  /**
   * Get prep closing record by primary key
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getPrepClosingByPk(req, res) {
    try {
      const { cab, kdtk, key } = req.params;
      
      if (!cab || !kdtk || !key) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: cab, kdtk, key'
        });
      }
      
      const record = await prepClosingModel.findByPk({ cab, kdtk, key });
      
      if (!record) {
        return res.status(404).json({
          success: false,
          message: 'Prep closing record not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Prep closing record retrieved successfully',
        data: record
      });
    } catch (error) {
      logger.error('Error getting prep closing record by PK:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve prep closing record',
        error: error.message
      });
    }
  }

  /**
   * Create new prep closing record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createPrepClosing(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      
      const { cab, kdtk, key, nilai, valid = true } = req.body;
      
      const newRecord = await prepClosingModel.create({
        cab,
        kdtk,
        key,
        nilai,
        valid
      });
      
      res.status(201).json({
        success: true,
        message: 'Prep closing record created successfully',
        data: newRecord
      });
    } catch (error) {
      logger.error('Error creating prep closing record:', error);
      
      // Handle unique constraint violation
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Prep closing record with this combination already exists',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create prep closing record',
        error: error.message
      });
    }
  }

  /**
   * Update prep closing record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updatePrepClosing(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      
      const { cab, kdtk, key } = req.params;
      const updateData = req.body;
      
      // Remove primary key fields from update data
      delete updateData.cab;
      delete updateData.kdtk;
      delete updateData.key;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }
      
      const [affectedRows] = await prepClosingModel.update(updateData, {
        where: { cab, kdtk, key }
      });
      
      if (affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Prep closing record not found or no changes made'
        });
      }
      
      // Get updated record
      const updatedRecord = await prepClosingModel.findByPk({ cab, kdtk, key });
      
      res.json({
        success: true,
        message: 'Prep closing record updated successfully',
        data: updatedRecord
      });
    } catch (error) {
      logger.error('Error updating prep closing record:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update prep closing record',
        error: error.message
      });
    }
  }

  /**
   * Delete prep closing record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deletePrepClosing(req, res) {
    try {
      const { cab, kdtk, key } = req.params;
      
      const deletedCount = await prepClosingModel.destroy({
        where: { cab, kdtk, key }
      });
      
      if (deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Prep closing record not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Prep closing record deleted successfully',
        deletedCount
      });
    } catch (error) {
      logger.error('Error deleting prep closing record:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete prep closing record',
        error: error.message
      });
    }
  }

  /**
   * Bulk create prep closing records
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkCreatePrepClosing(req, res) {
    try {
      const { records } = req.body;
      
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Records array is required and must not be empty'
        });
      }
      
      // Validate each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (!record.cab || !record.kdtk || !record.key) {
          return res.status(400).json({
            success: false,
            message: `Record at index ${i} is missing required fields: cab, kdtk, key`
          });
        }
      }
      
      const createdRecords = await prepClosingModel.bulkCreate(records);
      
      res.status(201).json({
        success: true,
        message: `${createdRecords.length} prep closing records created successfully`,
        data: createdRecords
      });
    } catch (error) {
      logger.error('Error bulk creating prep closing records:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk create prep closing records',
        error: error.message
      });
    }
  }

  /**
   * Upsert prep closing record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async upsertPrepClosing(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      
      const { cab, kdtk, key, nilai, valid = true } = req.body;
      
      const result = await prepClosingModel.upsert({
        cab,
        kdtk,
        key,
        nilai,
        valid
      });
      
      res.json({
        success: true,
        message: `Prep closing record ${result.created ? 'created' : 'updated'} successfully`,
        data: result.data,
        created: result.created
      });
    } catch (error) {
      logger.error('Error upserting prep closing record:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upsert prep closing record',
        error: error.message
      });
    }
  }

  /**
   * Get count of prep closing records
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCount(req, res) {
    try {
      const filters = prepClosingModel.extractFilters(req.query);
      const count = await prepClosingModel.count({ where: filters });
      
      res.json({
        success: true,
        message: 'Count retrieved successfully',
        count
      });
    } catch (error) {
      logger.error('Error getting prep closing count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get count',
        error: error.message
      });
    }
  }

  /**
   * Get prep closing records by filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchPrepClosing(req, res) {
    try {
      const filters = prepClosingModel.extractFilters(req.query);
      const { limit = 100, offset = 0 } = req.query;
      
      const records = await prepClosingModel.findAll({
        where: filters,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['cab', 'ASC'], ['kdtk', 'ASC'], ['key', 'ASC']]
      });
      
      res.json({
        success: true,
        message: 'Search completed successfully',
        data: records,
        filters
      });
    } catch (error) {
      logger.error('Error searching prep closing records:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search prep closing records',
        error: error.message
      });
    }
  }
}

export default new PrepClosingController();