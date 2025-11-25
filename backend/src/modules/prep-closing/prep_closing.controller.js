/**
 * Controller for Prep Closing (Screening Pra Closing)
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import prepClosingService from "./prep_closing.service.js";
import notesService from "../notes/notes.service.js";
import UserService from "../user/user.service.js";

/**
 * Start screening process
 * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
 * GET /api/prep-closing/screening
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
      logger.info(`[prep_closing.controller] Starting screening for store: ${kdtk}, periode: ${periode}`);

      const result = await prepClosingService.screening({
        kdtk,
        periode,
        username,
      });

      return apiResponse.success(res, result);
    }

    // LEVEL 1 & 2: Multi-store screening
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    logger.info(`[prep_closing.controller] Starting screening for cabang: ${cabParam}, periode: ${periode}`);

    const result = await prepClosingService.screening({
      cabang: cabParam,
      periode,
      username,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
 * GET /api/prep-closing/summary
 */
export const getSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`[prep_closing.controller] Getting summary for cabang: ${cabParam}, periode: ${periode}`);

    const result = await prepClosingService.getSummary({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting summary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get resume by store (paginated)
 * GET /api/prep-closing/resumePerShop
 */
export const getResumeByKdtk = async (req, res) => {
  try {
    const {
      periode,
      cabang = "All",
      page = 1,
      limit = 10,
      sortColumn = "KDTK",
      sortOrder = "ASC",
      searchQuery,
    } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(
      `[prep_closing.controller] Get resume by KDTK: cabang=${cabParam}, periode=${periode}, page=${page}, limit=${limit}`
    );

    const result = await prepClosingService.getResumeByKdtk({
      cabang: cabParam,
      periode,
      page: parseInt(page),
      limit: parseInt(limit),
      searchQuery,
      sortColumn,
      sortOrder,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting resume by KDTK: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get detailed issues for a specific store
 * GET /api/prep-closing/details
 */
export const getStoreDetails = async (req, res) => {
  try {
    const { kdtk, periode } = req.query;

    if (!kdtk || !periode) {
      return apiResponse.badRequest(res, "kdtk and periode are required");
    }

    logger.info(`[prep_closing.controller] Get store details: kdtk=${kdtk}, periode=${periode}`);

    const result = await prepClosingService.getStoreDetails({ kdtk, periode });

    if (!result) {
      return apiResponse.notFound(res, "Store details not found");
    }

    return apiResponse.success(res, { data: result });
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting store details: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get issues grouped by category
 * GET /api/prep-closing/issuesByCategory
 */
export const getIssuesByCategory = async (req, res) => {
  try {
    const { cabang, periode } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`[prep_closing.controller] Get issues by category: cabang=${cabParam}, periode=${periode}`);

    const result = await prepClosingService.getIssuesByCategory({ cabang: cabParam, periode });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[prep_closing.controller] Error getting issues by category: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update or create note for a specific store and periode
 * PUT /api/prep-closing/note
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, kdtk, periode, noteText } = req.body;
    const pic = req.user?.username || "system";
    const tableName = `screening_praclosing`;
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
    logger.error(`[prep_closing.controller] Error updating note: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
