import logger from "../../config/logger.js";
import adjustService from "./adjust.service.js";
import histAdjustStagingService from "./hist_adjust_staging.service.js";
import { apiResponse } from "../../utils/index.js";

/**
 * Upload and process CSV file for item adjustment with history logging
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const uploadAdjustCsv = async (req, res) => {
  try {
    if (!req.file) {
      return apiResponse.badRequest(res, "No file uploaded");
    }

    // Get username from authenticated user
    const username = req.user?.username || "unknown";

    // Log the adjustment attempt
    logger.info(`User ${username} initiated adjustment process with file: ${req.file.originalname}`);

    // File validation already handled by multer middleware
    // Process the file using the buffer from multer with username for history
    const results = await adjustService.processCsvAdjust(req.file.buffer, username);

    // Log completion
    logger.info(
      `Adjustment process completed for user ${username}. Total stores: ${results.totalStores}, Success: ${results.successStores}, Failed: ${results.failedStores.length}`
    );

    // Return response based on results
    if (results.failedStores.length > 0) {
      return apiResponse.success(
        res,
        {
          message: "Process completed with some failures",
          data: results,
        },
        207
      ); // Using 207 Multi-Status for partial success
    }

    return apiResponse.success(res, {
      message: "CSV processed successfully",
      data: results,
    });
  } catch (error) {
    logger.error(`Error processing adjust CSV: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};

/**
 * Download CSV master format template
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const downloadCsvTemplate = async (req, res) => {
  try {
    logger.info("Generating CSV template for download");
    const template = adjustService.generateCsvTemplate();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="adjust_template.csv"');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    logger.info("CSV template generated successfully");
    res.send(template);
  } catch (error) {
    logger.error(`Error generating CSV template: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};

/**
 * Get adjustment history with filters
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const getAdjustHistory = async (req, res) => {
  try {
    const { kdtk, pic, status, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;

    const filters = {
      kdtk,
      pic,
      status,
      dateFrom,
      dateTo,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const result = await histAdjustStagingService.searchHistory(filters);

    return apiResponse.success(res, {
      message: "History retrieved successfully",
      data: result.data,
      totalCount: result.totalCount,
    });
  } catch (error) {
    logger.error(`Error getting adjust history: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};

/**
 * Get adjustment statistics
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const getAdjustStatistics = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const filters = { dateFrom, dateTo };
    const result = await histAdjustStagingService.getStatistics(filters);

    return apiResponse.success(res, {
      message: "Statistics retrieved successfully",
      data: result.statistics,
    });
  } catch (error) {
    logger.error(`Error getting adjust statistics: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};
