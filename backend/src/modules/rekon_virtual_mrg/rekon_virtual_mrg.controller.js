/**
 * Controller for Rekon Virtual Margin Based
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import rekonVirtualService from "./rekon_virtual_mrg.service.js";

/**
 * Start screening/reconciliation process
 * GET /api/rekon-virtual-mrg/screening
 */
export const screeningByCabang = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    // Validate periode format (YYMM)
    if (!/^\d{4}$/.test(periode)) {
      return apiResponse.badRequest(res, "Format periode tidak valid. Gunakan format YYMM (contoh: 2507)");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`Starting screening for cabang: ${cabParam}, periode: ${periode}`);

    const result = await rekonVirtualService.screening({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
 * GET /api/rekon-virtual-mrg/summary
 */
export const getSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`Getting summary for cabang: ${cabParam}, periode: ${periode}`);

    const result = await rekonVirtualService.getSummary({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting summary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get all records with pagination and filtering
 * GET /api/rekon-virtual-mrg
 */
export const getAllRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, cabang, periode, shop, searchQuery, sortColumn, sortOrder } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      cabang: !cabang || cabang === "All" ? null : cabang,
      periode,
      shop,
      searchQuery,
      sortColumn,
      sortOrder,
    };

    logger.info(
      `Getting records: page=${page}, limit=${limit}, cabang=${cabang || "All"}, periode=${periode || "All"}`
    );

    const result = await rekonVirtualService.getAllRecords(options);

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting records: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get record by ID
 */
export const getRecord = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    const result = await rekonVirtualService.getRecord(cabang, shop, tanggal, prdcd);

    if (!result) {
      return apiResponse.notFound(res, "Record not found");
    }

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error getting record: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Create new record
 */
export const createRecord = async (req, res) => {
  try {
    const result = await rekonVirtualService.createRecord(req.body);
    return apiResponse.created(res, result);
  } catch (error) {
    logger.error(`Error creating record: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update record
 */
export const updateRecord = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    const result = await rekonVirtualService.updateRecord(cabang, shop, tanggal, prdcd, req.body);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error updating record: ${error.message}`);
    if (error.message === "Record not found") {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.error(res, error.message);
  }
};

/**
 * Delete record
 */
export const deleteRecord = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    await rekonVirtualService.deleteRecord(cabang, shop, tanggal, prdcd);
    return apiResponse.success(res, { message: "Record deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting record: ${error.message}`);
    if (error.message === "Record not found") {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.error(res, error.message);
  }
};

/**
 * Insert records from store
 */
export const insertFromStore = async (req, res) => {
  try {
    const { shop, year, month } = req.body;

    if (!shop || !year || !month) {
      return apiResponse.badRequest(res, "Shop, year, and month are required");
    }

    const result = await rekonVirtualService.insertFromStore(shop, year, month);
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error inserting from store: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
