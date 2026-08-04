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
 * Supports 4 levels: All cabang, 1 cabang, 1 specific store, or custom shops list
 * GET /api/rekon-sales/screening
 */
export const screeningByCabang = async (req, res) => {
  try {
    const { cabang, periode, kdtk, shops, force } = req.query;

    const username = req.user?.username || "system";
    const fullName = req.user?.fullName || username;
    const isForce = force === "true";

    let shopList = [];
    if (shops) {
      if (Array.isArray(shops)) {
        shopList = shops;
      } else if (typeof shops === "string") {
        shopList = shops
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
      }
    }

    // LEVEL 3: Single store screening (no guard)
    if (kdtk) {
      logger.info(`[rekon_sales.controller] Starting screening for store: ${kdtk}, periode: ${periode}`);

      const result = await rekonSalesService.screening({
        kdtk,
        periode,
        username,
        fullName,
      });

      return apiResponse.success(res, result);
    }

    // LEVEL 1 & 2 + Custom Shops: Multi-store screening (with daily guard)
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    logger.info(
      `[rekon_sales.controller] Starting screening for cabang: ${cabParam}, periode: ${periode}${shopList.length > 0 ? `, shops: ${shopList.join(",")}` : ""}${isForce ? " [FORCE]" : ""}`,
    );

    const { default: config } = await import("./rekon_sales.config.js");
    const taskId = `${config.taskProgressName}_${username}`;

    const result = await rekonSalesService.screening({
      cabang: cabParam,
      periode,
      username,
      fullName,
      force: isForce,
      shops: shopList,
    });

    return apiResponse.success(res, { ...result, taskId });
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
      shopIssueOnly,
    } = req.query;

    if (!month || !year) {
      return apiResponse.badRequest(res, "Month and year are required");
    }

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(
      `[rekon_sales.controller] Get resume by KDTK: cabang=${cabParam}, month=${month}, year=${year}, page=${page}, limit=${limit}`,
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
      shopIssueOnly,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getting resume by KDTK: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get SHOP check detail for a specific store (with optional live item drill-down)
 * GET /api/rekon-sales/shop-check?kdtk=xxx&month=07&year=2026&detail=1
 */
export const getShopCheck = async (req, res) => {
  try {
    const { kdtk, month, year, detail } = req.query;

    if (!kdtk || !month || !year) {
      return apiResponse.badRequest(res, "kdtk, month, dan year wajib diisi");
    }

    logger.info(`[rekon_sales.controller] Get shop check: kdtk=${kdtk}, month=${month}, year=${year}, detail=${detail}`);

    const result = await rekonSalesService.getShopCheckDetail({ kdtk, month, year, detail });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getShopCheck: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get detailed data for a specific store and date
 * GET /api/rekon-sales/details
 */
export const getStoreDetails = async (req, res) => {
  try {
    const { kdtk, month, year } = req.query;

    if (!kdtk || !month || !year) {
      return apiResponse.badRequest(res, "kdtk, month, dan year wajib diisi");
    }

    logger.info(`[rekon_sales.controller] Get store details (monthly): kdtk=${kdtk}, month=${month}, year=${year}`);

    const result = await rekonSalesService.getStoreDetailsByMonth({ kdtk, month, year });

    return apiResponse.success(res, result || { summary: null, daily: [], notes: [] });
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
    const { kdtk, month, year } = req.query;

    if (!kdtk || !month || !year) {
      return apiResponse.badRequest(res, "kdtk, month, dan year wajib diisi");
    }

    logger.info(`[rekon_sales.controller] Get differences (monthly): kdtk=${kdtk}, month=${month}, year=${year}`);

    const result = await rekonSalesService.getDifferencesByMonth({ kdtk, month, year });

    return apiResponse.success(res, result || { data: [] });
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
    const { kdtk, month, year } = req.query;

    if (!kdtk || !month || !year) {
      return apiResponse.badRequest(res, "kdtk, month, dan year wajib diisi");
    }

    logger.info(
      `[rekon_sales.controller] Get kode pesanan issues (monthly): kdtk=${kdtk}, month=${month}, year=${year}`,
    );

    const result = await rekonSalesService.getKodePesananIssuesByMonth({ kdtk, month, year });

    return apiResponse.success(res, result || { daily: [] });
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
 * Get comprehensive rekon sales data for display (with notes, tolerance filter, sel_ppn_cd2)
 * GET /api/rekon-sales/data/:cab/:month/:year
 * GET /api/rekon-sales/data?cab=xxx&month=xx&year=xxxx
 */
export const getRekonSalesData = async (req, res) => {
  try {
    const cabParam = req.params.cab || req.query.cab || "All";
    const month = req.params.month || req.query.month;
    const year = req.params.year || req.query.year;

    if (!month || !year) {
      return apiResponse.badRequest(res, "Month and year are required");
    }

    const cab = !cabParam || cabParam === "All" || cabParam === "ALL" ? "All" : cabParam;

    logger.info(`[rekon_sales.controller] Getting rekon sales data: cab=${cab}, month=${month}, year=${year}`);

    const result = await rekonSalesService.getFullRekonSalesData({ cabang: cab, month, year });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getRekonSalesData: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Live check: fetch item-level mtran data from store for problematic shifts
 * GET /api/rekon-sales/live-check?kdtk=xxx&month=07&year=2026
 */
export const getLiveCheck = async (req, res) => {
  try {
    const { kdtk, month, year, tanggal, station, shift } = req.query;

    if (!kdtk || !month || !year) {
      return apiResponse.badRequest(res, "kdtk, month, and year are required");
    }

    logger.info(`[rekon_sales.controller] Live check: kdtk=${kdtk}, month=${month}, year=${year}, tanggal=${tanggal}, station=${station}, shift=${shift}`);

    const result = await rekonSalesService.getLiveCheck({ kdtk, month, year, tanggal, station, shift });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`[rekon_sales.controller] Error getLiveCheck: ${error.message}`);
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

    // Jika note kosong (hapus note)
    if (String(noteText).trim().length === 0) {
      const deleted = await notesService.removeByKey(tableName, unixKey);
      return apiResponse.success(res, { deleted, unixKey });
    }

    // Jika ada isi, lakukan upsert
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
