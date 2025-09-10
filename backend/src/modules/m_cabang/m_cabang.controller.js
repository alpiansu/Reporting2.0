/**
 * Controller for m_cabang data
 */
import logger from '../../config/logger.js';
import { apiResponse } from '../../utils/index.js';
import MCabang from '../../models/m_cabang.model.js';
import mCabangService from './m_cabang.service.js';

/**
 * Get all cabang
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllCabang = async (req, res, next) => {
  try {
    const cabangList = await MCabang.findAll();

    // Return direct data array without message for successful response
    return res.status(200).json({
      success: true,
      data: cabangList
    });
  } catch (error) {
    logger.error(`Error in getAllCabang: ${error.message}`);
    next(error);
  }
};

/**
 * Get cabang by code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCabangByCode = async (req, res, next) => {
  try {
    const { kdcab } = req.params;

    if (!kdcab) {
      return apiResponse.badRequest(res, "Cabang code (kdcab) is required");
    }

    const cabang = await MCabang.findByPk(kdcab);

    if (!cabang) {
      return apiResponse.notFound(res, `Cabang with code ${kdcab} not found`);
    }

    // Return direct data without message for successful response
    return res.status(200).json({
      success: true,
      data: cabang
    });
  } catch (error) {
    logger.error(`Error in getCabangByCode: ${error.message}`);
    next(error);
  }
};

/**
 * Create a new cabang
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createCabang = async (req, res, next) => {
  try {
    const cabangData = req.body;

    if (!cabangData.kdcab || !cabangData.namacab) {
      return apiResponse.badRequest(res, "Cabang code (kdcab) and name (namacab) are required");
    }

    const cabang = await MCabang.create(cabangData);

    // Return direct data without message for successful response
    return res.status(201).json({
      success: true,
      data: cabang
    });
  } catch (error) {
    logger.error(`Error in createCabang: ${error.message}`);
    next(error);
  }
};

/**
 * Update an existing cabang
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateCabang = async (req, res, next) => {
  try {
    const { kdcab } = req.params;
    const cabangData = req.body;

    if (!kdcab) {
      return apiResponse.badRequest(res, "Cabang code (kdcab) is required");
    }

    if (!cabangData.namacab) {
      return apiResponse.badRequest(res, "Cabang name (namacab) is required");
    }

    // First check if cabang exists
    const existingCabang = await MCabang.findByPk(kdcab);
    if (!existingCabang) {
      return apiResponse.notFound(res, `Cabang with code ${kdcab} not found`);
    }

    // Update cabang using service
    const service = new mCabangService();
    const cabang = await service.updateCabang(kdcab, cabangData);

    // Return direct data without message for successful response
    return res.status(200).json({
      success: true,
      data: cabang
    });
  } catch (error) {
    logger.error(`Error in updateCabang: ${error.message}`);
    next(error);
  }
};

/**
 * Delete a cabang
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteCabang = async (req, res, next) => {
  try {
    const { kdcab } = req.params;

    if (!kdcab) {
      return apiResponse.badRequest(res, "Cabang code (kdcab) is required");
    }

    // First check if cabang exists
    const existingCabang = await MCabang.findByPk(kdcab);
    if (!existingCabang) {
      return apiResponse.notFound(res, `Cabang with code ${kdcab} not found`);
    }

    // Delete cabang using service
    const service = new mCabangService();
    await service.deleteCabang(kdcab);

    // Return success without data for successful response
    return res.status(200).json({
      success: true
    });
  } catch (error) {
    logger.error(`Error in deleteCabang: ${error.message}`);
    next(error);
  }
};

// Removed default export - using named exports only