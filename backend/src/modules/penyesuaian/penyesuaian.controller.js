/**
 * Controller for Penyesuaian (Sesuai Toko)
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import penyesuaianService from "./penyesuaian.service.js";
import notesService from "../notes/notes.service.js";
import UserService from "../user/user.service.js";

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
      `[penyesuaian controllers getAllRecords] Getting records: page=${page}, limit=${limit}, cabang=${
        cabang || "All"
      }, periode=${periode || "All"}, kdtk=${kdtk || "All"}`
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

/**
 * Get resume nilai per KDTK untuk periode tertentu (paginated)
 * GET /api/penyesuaian/resume
 * Query params:
 *   - periode (wajib)
 *   - cabang (opsional, default = All)
 *   - page (opsional, default = 1)
 *   - limit (opsional, default = 10)
 *   - sortColumn (opsional, default = SESUAI)
 *   - sortOrder (opsional, default = ASC)
 */
export const getResumeByKdtk = async (req, res) => {
  try {
    const { periode, cabang = "All", page = 1, limit = 10, sortColumn = "SESUAI", sortOrder = "ASC" } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(
      `[penyesuaian.controller] Get resume by KDTK: cabang=${cabParam}, periode=${periode}, page=${page}, limit=${limit}, sort=${sortColumn} ${sortOrder}`
    );

    const result = await penyesuaianService.getResumeByKdtk({
      cabang: cabParam,
      periode,
      page: parseInt(page),
      limit: parseInt(limit),
      sortColumn,
      sortOrder,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[penyesuaian.controller] Error getting resume by KDTK: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

export const getSingleResumeKdtk = async (req, res) => {
  try {
    const { periode, kdtk } = req.query;

    if (!periode || !kdtk) {
      return apiResponse.badRequest(res, "Periode && kdtk is required");
    }

    logger.info(`[penyesuaian.controller] Get single resume kdtk: periode=${periode}, kdtk=${kdtk}`);

    const result = await penyesuaianService.getSingleResumeKdtk({
      periode,
      kdtk,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[penyesuaian.controller] Error getting single resume kdtk: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update or create note for a specific record
 * PUT /api/penyesuaian/note/
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, kdtk, periode, noteText } = req.body;
    const pic = req.user?.username || "system";
    const tableName = `sesuai_toko`;
    const unixKey = `${kdtk}${periode}`;

    if (!cabang || !kdtk || !periode) {
      return apiResponse.badRequest(res, "cabang, kdtk, dan periode wajib diisi");
    }

    if (noteText === undefined) {
      return apiResponse.badRequest(res, "noteText wajib diisi");
    }

    const userService = new UserService();
    const user = await userService.findByCredentials(pic);

    const noteData = {
      Cabang: cabang,
      unixKey,
      noteText: noteText || "",
      pic: pic,
      categoryId: null,
      tableName: tableName,
    };

    const note = await notesService.upsert(noteData);

    const result = { ...note.toJSON(), fullName: user?.fullName || null };

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[penyesuaian] Error updating note: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
