import logger from "../../config/logger.js";
import adjustService from "./adjust.service.js";
import { apiResponse } from "../../utils/apiResponse.js";

/**
 * Upload and process CSV file for item adjustment
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const uploadAdjustCsv = async (req, res) => {
  try {
    if (!req.file) {
      return apiResponse.badRequest(res, "No file uploaded");
    }

    // File validation already handled by multer middleware
    // Process the file using the buffer from multer
    const results = await adjustService.processCsvAdjust(req.file.buffer);

    // Return response based on results
    if (results.failedStores.length > 0) {
      return apiResponse.partialContent(res, {
        message: "Process completed with some failures",
        data: results,
      });
    }

    return apiResponse.success(res, {
      message: "CSV processed successfully",
      data: results,
    });
  } catch (error) {
    logger.error(`Error processing adjust CSV: ${error.message}`);
    return apiResponse.serverError(res, error.message);
  }
};
