import logger from "../../config/logger.js";
import adjustService from "./adjust.service.js";
import histAdjustStagingService from "./hist_adjust_staging.service.js";
import HistAdjust from "../../models/hist_adjust.model.js";
import { apiResponse } from "../../utils/index.js";

/**
 * Upload and process CSV file for item adjustment with progress tracking
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

    // Process the file synchronously and wait for completion
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
    logger.error(`Error starting adjust process: ${error.message}`);
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
    const { kdtk, pic, status, month, limit = 100, offset = 0 } = req.query;

    let computedDateFrom;
    let computedDateTo;

    if (month) {
      const [y, m] = month.split("-");
      const year = parseInt(y);
      const monthIndex = parseInt(m) - 1;
      const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      computedDateFrom = start.toISOString();
      computedDateTo = end.toISOString();
    }

    const filters = {
      kdtk,
      pic,
      status,
      dateFrom: computedDateFrom,
      dateTo: computedDateTo,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const result = await histAdjustStagingService.searchHistory(filters);

    return apiResponse.success(res, {
      message: "History retrieved successfully",
      data: result.data,
      totalCount: result.totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error(`Error getting adjust history: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};

/**
 * Get distinct filters (PIC, KDTK)
 * @param {Request} req
 * @param {Response} res
 */
export const getAdjustFilters = async (req, res) => {
  try {
    const picRows = await HistAdjust.findAll({ attributes: ["pic"], group: ["pic"], raw: true });
    const kdtkRows = await HistAdjust.findAll({ attributes: ["kdtk"], group: ["kdtk"], raw: true });

    const pics = picRows
      .map(r => r.pic)
      .filter(Boolean)
      .sort();
    const kdtks = kdtkRows
      .map(r => r.kdtk)
      .filter(Boolean)
      .sort();

    return apiResponse.success(res, {
      message: "Filters retrieved successfully",
      data: { pics, kdtks },
    });
  } catch (error) {
    logger.error(`Error getting adjust filters: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};

/**
 * Export adjustment history as CSV
 * @param {Request} req
 * @param {Response} res
 */
export const exportAdjustHistoryCsv = async (req, res) => {
  try {
    const kdtk = req.query["kdtk[]"] || req.query.kdtk;
    const { pic, status, month } = req.query;

    let computedDateFrom;
    let computedDateTo;
    if (month) {
      const [y, m] = month.split("-");
      const year = parseInt(y);
      const monthIndex = parseInt(m) - 1;
      const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      computedDateFrom = start.toISOString();
      computedDateTo = end.toISOString();
    }

    const filters = {
      kdtk,
      pic,
      status,
      dateFrom: computedDateFrom,
      dateTo: computedDateTo,
    };
    const result = await histAdjustStagingService.searchHistory(filters);
    const rows = result.data;

    const headers = ["kdtk", "prdcd", "qty_adj", "keter", "note", "pic", "updtime", "status"];

    const escape = value => {
      const v = value == null ? "" : String(value);
      if (v.includes(",") || v.includes("\n") || v.includes('"')) {
        return `"${v.replace(/\"/g, '"')}"`;
      }
      return v;
    };

    const csvLines = [headers.join(",")];
    for (const r of rows) {
      const line = [
        escape(r.kdtk),
        escape(r.prdcd),
        escape(r.qty_adj),
        escape(r.keter),
        escape(r.note),
        escape(r.picFullName),
        escape(r.updtime),
        escape(r.status),
      ].join(",");
      csvLines.push(line);
    }

    const csvContent = csvLines.join("\n");
    const filename = `adjust_history_${month || "all"}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    return res.send(csvContent);
  } catch (error) {
    logger.error(`Error exporting adjust history CSV: ${error.message}`);
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
