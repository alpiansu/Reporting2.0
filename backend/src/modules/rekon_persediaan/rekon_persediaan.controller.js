import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";
import rekonPersediaanService from "./rekon_persediaan.service.js";

/**
 * Controller for Rekon Persediaan (HPP Reconciliation)
 */

/**
 * Start screening/reconciliation process
 * Supports 3 levels: All cabang, 1 cabang, specific shops
 * GET /api/rekon-persediaan/screening
 */
export const startScreening = async (req, res) => {
  try {
    const { cabang, periode, shops } = req.query;

    if (!periode) {
      return apiResponse.badRequest(res, "Periode (YYMM) is required");
    }

    if (!/^\d{4}$/.test(periode)) {
      return apiResponse.badRequest(res, "Format periode tidak valid. Gunakan format YYMM (contoh: 2501)");
    }

    // Sanitize shops parameter (string 'S1,S2' or array)
    let shopList = [];
    if (shops) {
      if (Array.isArray(shops)) {
        shopList = shops;
      } else if (typeof shops === 'string') {
        shopList = shops.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const username = req.user?.username || "system";
    const cabParam = !cabang || cabang === "All" ? "All" : cabang;

    logger.info(`[rekon_persediaan_controller] Starting Rekon Persediaan screening: cabang=${cabParam}, periode=${periode}${shopList.length > 0 ? `, shops=${shopList.join(',')}` : ''}`);

    // Screening process (returns only when complete)
    const result = await rekonPersediaanService.screening({ 
        cabang: cabParam, 
        periode, 
        username,
        shops: shopList
    });

    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in startScreening: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get summary statistics
 * GET /api/rekon-persediaan/summary
 */
export const getSummary = async (req, res) => {
  try {
    const { cabang, periode } = req.query;
    if (!periode) return apiResponse.badRequest(res, "Periode is required");

    const cabParam = !cabang || cabang === "All" ? "All" : cabang;
    const result = await rekonPersediaanService.getSummary({ cabang: cabParam, periode });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in getSummary: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};

/**
 * Get records with pagination
 * GET /api/rekon-persediaan/records
 */
export const getAllRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, cabang, periode, searchQuery, sortColumn, sortOrder } = req.query;
    const result = await rekonPersediaanService.getAllRecords({
      page: parseInt(page),
      limit: parseInt(limit),
      cabang: !cabang || cabang === "All" ? "All" : cabang,
      periode,
      searchQuery,
      sortColumn,
      sortOrder
    });
    return apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Error in getAllRecords: ${error.message}`);
    return apiResponse.error(res, error.message);
  }
};
