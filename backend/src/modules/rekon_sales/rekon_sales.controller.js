/**
 * Controller for Rekon Sales (Sales Reconciliation)
 */
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import rekonSalesService from "./rekon_sales.service.js";
import notesService from "../notes/notes.service.js";
import UserService from "../user/user.service.js";

/**
 * Start screening process
 * Supports 3 levels: All cabang, 1 cabang, or 1 specific store
 * GET /api/rekon-sales/screening
 */
export const screeningByCabang = async (req, res) => {
  try {
    const { cabang, periode, kdtk } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode is required");
    }

    // Validate periode format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(periode)) {
      return apiResponse.badRequest(res, "Format periode tidak valid. Gunakan format YYYY-MM (contoh: 2025-11)");
    }

    const username = req.user?.username || "system";

    // LEVEL 3: Single store screening
    if (kdtk) {
      logger.info(`[rekon_sales.controller] Starting screening for store: ${kdtk}, periode: ${periode}`);

      const result = await rekonSalesService.screening({
        kdtk,
        periode,
        username,
      });

      return apiResponse.success(res, result);
    }

    // LEVEL 1 & 2: Multi-store screening
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    logger.info(`[rekon_sales.controller] Starting screening for cabang: ${cabParam}, periode: ${periode}`);

    const result = await rekonSalesService.screening({
      cabang: cabParam,
      periode,
      username,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error in screeningByCabang: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
 * GET /api/rekon-sales/summary
 */
export const getSummary = async (req, res) => {
  try {
    const { cabang, month, year } = req.query;

    if (!month || !year) {
      return apiResponse.badRequest(res, "Month and year are required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`[rekon_sales.controller] Getting summary for cabang: ${cabParam}, month: ${month}, year: ${year}`);

    const result = await rekonSalesService.getSummary({ cabang: cabParam, month, year });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getting summary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get resume by store (paginated)
 * GET /api/rekon-sales/resumePerShop
 */
export const getResumeByKdtk = async (req, res) => {
  try {
    const {
      month,
      year,
      cabang = "All",
      page = 1,
      limit = 10,
      sortColumn = "KDTK",
      sortOrder = "ASC",
      searchQuery,
    } = req.query;

    if (!month || !year) {
      return apiResponse.badRequest(res, "Month and year are required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(
      `[rekon_sales.controller] Get resume by KDTK: cabang=${cabParam}, month=${month}, year=${year}, page=${page}, limit=${limit}`
    );

    const result = await rekonSalesService.getResumeByKdtk({
      cabang: cabParam,
      month,
      year,
      page: parseInt(page),
      limit: parseInt(limit),
      searchQuery,
      sortColumn,
      sortOrder,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getting resume by KDTK: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get detailed data for a specific store and date
 * GET /api/rekon-sales/details
 */
export const getStoreDetails = async (req, res) => {
  try {
    const { kdtk, tanggal } = req.query;

    if (!kdtk || !tanggal) {
      return apiResponse.badRequest(res, "kdtk and tanggal are required");
    }

    logger.info(`[rekon_sales.controller] Get store details: kdtk=${kdtk}, tanggal=${tanggal}`);

    const result = await rekonSalesService.getStoreDetails({ kdtk, tanggal });

    if (!result) {
      return apiResponse.notFound(res, "Store details not found");
    }

    return apiResponse.success(res, { data: result });
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getting store details: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get detail differences (mtran vs closing detail)
 * GET /api/rekon-sales/differences
 */
export const getDifferences = async (req, res) => {
  try {
    const { kdtk, tanggal, page = 1, limit = 50 } = req.query;

    if (!kdtk || !tanggal) {
      return apiResponse.badRequest(res, "kdtk and tanggal are required");
    }

    logger.info(`[rekon_sales.controller] Get differences: kdtk=${kdtk}, tanggal=${tanggal}`);

    const result = await rekonSalesService.getDifferences({
      kdtk,
      tanggal,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getting differences: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get kode pesanan issues
 * GET /api/rekon-sales/kodePesananIssues
 */
export const getKodePesananIssues = async (req, res) => {
  try {
    const { kdtk, tanggal } = req.query;

    if (!kdtk || !tanggal) {
      return apiResponse.badRequest(res, "kdtk and tanggal are required");
    }

    logger.info(`[rekon_sales.controller] Get kode pesanan issues: kdtk=${kdtk}, tanggal=${tanggal}`);

    const result = await rekonSalesService.getKodePesananIssues({ kdtk, tanggal });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getting kode pesanan issues: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Export full data set for Excel
 * GET /api/rekon-sales/export-data
 */
export const getExportData = async (req, res) => {
  try {
    const { cabang, month, year, searchQuery } = req.query;

    if (!month || !year) {
      return apiResponse.badRequest(res, "Month and year are required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    const result = await rekonSalesService.getExportData({
      cabang: cabParam,
      month,
      year,
      searchQuery,
    });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getExportData: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Update or create note for a specific store and date
 * PUT /api/rekon-sales/note
 */
export const updateNote = async (req, res) => {
  try {
    const { cabang, kdtk, tanggal, noteText } = req.body;
    const pic = req.user?.username || "system";
    const tableName = `rekon_sales`;
    const unixKey = `${kdtk}${tanggal}`;

    if (!cabang || !kdtk || !tanggal) {
      return apiResponse.badRequest(res, "cabang, kdtk, dan tanggal wajib diisi");
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
    logger.error(`[rekon_sales.controller] Error updating note: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
