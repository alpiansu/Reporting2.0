/**
 * Controller for sales per department data
 */
import SalesPerDeptService from './sales_per_dept.service.js';
import logger from '../../config/logger.js';
import { apiResponse } from '../../utils/index.js';

// Create a singleton instance of the service
const salesPerDeptServiceInstance = new SalesPerDeptService();

/**
 * Trigger data synchronization for sales per department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const syncSalesPerDept = async (req, res, next) => {
  try {
    const { cab, periode } = req.body;

    if (!cab || !periode) {
      return apiResponse.badRequest(res, "Cabang (cab) and periode are required");
    }

    logger.info(`Triggering sales per department synchronization for cab: ${cab}, periode: ${periode}`);

    const result = await salesPerDeptServiceInstance.extractSalesPerDept(cab, periode);

    if (result.success) {
      return apiResponse.success(res, {
        message: "Sales per department data synchronization completed successfully",
        data: result.data,
      });
    } else {
      return apiResponse.error(res, result.message, 500);
    }
  } catch (error) {
    logger.error(`Error in syncSalesPerDept: ${error.message}`);
    next(error);
  }
};

/**
 * Get sales per department data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getSalesPerDept = async (req, res, next) => {
  try {
    const { cab, periode, tipestore } = req.query;

    if (!cab || !periode || !tipestore) {
      return apiResponse.badRequest(res, "Cabang (cab), tipestore and periode are required");
    }

    const filters = {
      cab,
      periode,
      tipestore: tipestore,
    };

    const data = await salesPerDeptServiceInstance.getSalesPerDept(filters);

    return apiResponse.success(res, {
      message: "Sales per department data retrieved successfully",
      data,
    });
  } catch (error) {
    logger.error(`Error in getSalesPerDept: ${error.message}`);
    next(error);
  }
};

/**
 * Compare sales per department data between two periods
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const compareSalesPerDept = async (req, res, next) => {
  try {
    const { cab, periode1, periode2, tipestore } = req.query;

    if (!cab || !periode1 || !periode2) {
      return apiResponse.badRequest(res, "Cabang (cab), periode1, and periode2 are required");
    }

    const filters = {
      cab,
      periode1,
      periode2,
      tipestore: tipestore || "ALL",
    };

    const data = await salesPerDeptServiceInstance.compareSalesPerDept(filters);

    return apiResponse.success(res, {
      message: "Sales per department comparison data retrieved successfully",
      data,
    });
  } catch (error) {
    logger.error(`Error in compareSalesPerDept: ${error.message}`);
    next(error);
  }
};

// Removed default export - using named exports only
