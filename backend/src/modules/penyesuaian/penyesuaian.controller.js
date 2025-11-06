/**
 * Controller for Penyesuaian (Sesuai Toko)
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import penyesuaianService from "./penyesuaian.service.js";

/**
 * Start screening/reconciliation process
 * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
 * GET /api/penyesuaian/screening
 */
export const screeningByCabang = async (req, res) => {
  try {
    const { cabang, periode, kdtk } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    // Validate periode format (YYMM)
    if (!/^\d{4}$/.test(periode)) {
      return apiResponse.badRequest(res, "Format periode tidak valid. Gunakan format YYMM (contoh: 2511)");
    }

    const username = req.user?.username || "system";

    // LEVEL 3: Single store screening
    if (kdtk) {
      logger.info(`Starting screening for store: ${kdtk}, periode: ${periode}`);

      const result = await penyesuaianService.screening({
        kdtk,
        periode,
        username,
      });

      return apiResponse.success(res, result);
    }

    // LEVEL 1 & 2: Multi-store screening
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    logger.info(`Starting screening for cabang: ${cabParam}, periode: ${periode}`);

    const result = await penyesuaianService.screening({
      cabang: cabParam,
      periode,
      username,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
 * Only counts records with RECID='*'
 * GET /api/penyesuaian/summary
 */
export const getSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`Getting summary for cabang: ${cabParam}, periode: ${periode}`);

    const result = await penyesuaianService.getSummary({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting summary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get all records without pagination and filtering
 * Only returns records with RECID='*'
 * GET /api/penyesuaian/getData
 */
export const getAll = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    const options = {
      cabang: !cabang || cabang === "All" ? null : cabang,
      periode,
    };

    logger.info(`Getting all records: cabang=${cabang || "All"}, periode=${periode || "All"}`);

    const result = await penyesuaianService.getAll(options);

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[penyesuaian] Error getting all records without pagination and filtering: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get all records with pagination and filtering
 * Only returns records with RECID='*'
 * GET /api/penyesuaian
 */
export const getAllRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, cabang, periode, kdtk, searchQuery, sortColumn, sortOrder } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      cabang: !cabang || cabang === "All" ? null : cabang,
      periode,
      kdtk,
      searchQuery,
      sortColumn,
      sortOrder,
    };

    logger.info(
      `Getting records: page=${page}, limit=${limit}, cabang=${cabang || "All"}, periode=${periode || "All"}, kdtk=${
        kdtk || "All"
      }`
    );

    const result = await penyesuaianService.getAllRecords(options);

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting records: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get record by ID
 * GET /api/penyesuaian/:cabang/:kdtk/:periode/:prdcd
 */
export const getRecord = async (req, res) => {
  try {
    const { cabang, kdtk, periode, prdcd } = req.params;
    const result = await penyesuaianService.getRecord(cabang, kdtk, periode, prdcd);

    if (!result) {
      return apiResponse.notFound(res, "Record not found");
    }

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting record: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
