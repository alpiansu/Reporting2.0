/**
 * Controller for Rekon Virtual Margin Based
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import rekonVirtualService from "./rekon_virtual_mrg.service.js";
import notesService from "../notes/notes.service.js";
import noteCategoriesService from "../note_categories/noteCategories.service.js";

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
 * Update RECID field specifically
 */
export const updateRecid = async (req, res) => {
  try {
    const { recid, cabang, shop, tanggal, prdcd } = req.body;

    // Validate RECID value
    if (recid !== "1" && recid !== "*") {
      return apiResponse.badRequest(res, "RECID must be either '1' (adjusted) or '*' (not adjusted)");
    }

    //validate all params are provided
    if (!recid || !cabang || !shop || !tanggal || !prdcd) {
      return apiResponse.badRequest(res, "All parameters (recid, cabang, shop, tanggal, prdcd) are required");
    }

    const result = await rekonVirtualService.updateRecord(cabang, shop, tanggal, prdcd, { RECID: recid });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error updating RECID: ${error.message}`);
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

/**
 * Update or create note for a specific record
 * PUT /api/rekon-virtual-mrg/:cabang/:shop/:tanggal/:prdcd/note
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, shop, tanggal, prdcd } = req.params;
    const { noteText, categoryId } = req.body;
    const pic = req.user?.username || "system"; // Get username from authenticated user

    // Validate required fields
    if (!noteText && categoryId === undefined) {
      return apiResponse.badRequest(res, "Either noteText or categoryId must be provided");
    }

    // Construct unixKey
    const unixKey = `${shop}${tanggal}${prdcd}`;

    // Prepare note data
    const noteData = {
      Cabang: cabang,
      unixKey,
      noteText: noteText || "", // Default to empty string if not provided
      pic,
      categoryId: categoryId || null, // Allow null for categoryId
    };

    // Create or update note
    const note = await notesService.upsert(noteData);

    // Get category info if categoryId is provided
    let category = null;
    if (categoryId) {
      const categoryResult = await noteCategoriesService.getAll();
      const categories = categoryResult.data || [];
      category = categories.find(c => c.id === categoryId) || null;
    }

    return apiResponse.success(res, {
      ...note.toJSON(),
      category,
    });
  } catch (error) {
    logger.error(`Error updating note: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
