/**
 * Controller for Penyesuaian (Sesuai Toko)
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import penyesuaianService from "./penyesuaian.service.js";
import notesService from "../notes/notes.service.js";

/**
 * Start screening/reconciliation process
 * GET /api/penyesuaian/screening
 */
export const screeningByCabang = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    // Validate periode format (YYMM)
    if (!/^\d{4}$/.test(periode)) {
      return apiResponse.badRequest(res, "Format periode tidak valid. Gunakan format YYMM (contoh: 2511)");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`Starting screening for cabang: ${cabParam}, periode: ${periode}`);

    const username = req.user?.username || "system";

    const result = await penyesuaianService.screening({ cabang: cabParam, periode, username });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
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

/**
 * Create new record
 */
export const createRecord = async (req, res) => {
  try {
    const result = await penyesuaianService.createRecord(req.body);
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
    const { cabang, kdtk, periode, prdcd } = req.params;
    const result = await penyesuaianService.updateRecord(cabang, kdtk, periode, prdcd, req.body);
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
    const { cabang, kdtk, periode, prdcd } = req.params;
    await penyesuaianService.deleteRecord(cabang, kdtk, periode, prdcd);
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
 * Update or create note for a specific record
 * PUT /api/penyesuaian/note/:cabang/:kdtk/:periode/:prdcd
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, kdtk, periode, prdcd } = req.params;
    const { noteText, categoryId } = req.body;
    const pic = req.user?.username || "system";

    const result = await notesService.saveOrUpdateNote({
      cabang,
      shop: kdtk,
      tanggal: periode,
      prdcd,
      noteText,
      categoryId,
      pic,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error updating note: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
