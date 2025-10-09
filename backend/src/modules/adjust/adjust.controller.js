import logger from "../../config/logger.js";
import adjustService from "./adjust.service.js";
import { apiResponse } from "../../utils/index.js";

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
