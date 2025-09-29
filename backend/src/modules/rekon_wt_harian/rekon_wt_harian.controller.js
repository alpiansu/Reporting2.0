/**
 * Controller for WT reconciliation
 */
import rekonWtHarianService from "./rekon_wt_harian.service.js";
import { ProgressHelper } from "../../services/progress/index.js";
import logger from "../../config/logger.js";
import config from "../../config/rekon_wt_harian.config.js";
import storeService from "../../modules/store/storeService.js";

/**
 * Cleanup temporary files used in reconciliation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const cleanupTempFiles = async (req, res, next) => {
  try {
    await rekonWtHarianService.cleanupTempFiles();
    res.status(200).json({
      success: true,
      message: "Temporary files cleaned up successfully",
    });
  } catch (error) {
    logger.error(`Error in cleanupTempFiles: ${error.message}`);
    next(error);
  }
};

/**
 * Start reconciliation process
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const startReconciliation = async (req, res, next) => {
  try {
    const { cab, periode } = req.body;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    // Validate periode format (YYMM)
    if (!/^\d{4}$/.test(periode)) {
      return res.status(400).json({
        success: false,
        message: "Format periode tidak valid. Gunakan format YYMM (contoh: 2507 untuk Juli 2025)",
      });
    }

    //cleanup old temp files
    await rekonWtHarianService.cleanupTempFiles();

    // Check if there's already an active process in the entire system
    const cabParam = cab === "SEMUA" || !cab ? "All" : cab;
    const activeProcess = ProgressHelper.hasAnyActiveProcess();

    if (activeProcess) {
      // Extract cab and period from metadata
      const activeCab = activeProcess.metadata?.cab || "Unknown";
      const activePeriod = activeProcess.metadata?.period || "Unknown";

      return res.status(409).json({
        success: false,
        message: `Proses rekonsiliasi untuk ${
          activeCab === "All" ? "semua cabang" : `cabang ${activeCab}`
        } periode ${activePeriod} sedang berjalan. Silakan tunggu hingga proses selesai.`,
        activeProcess: {
          id: activeProcess.id,
          cab: activeCab,
          periode: activePeriod,
          status: activeProcess.status,
          percentage: activeProcess.percentage,
          startTime: activeProcess.startTime,
          totalItems: activeProcess.totalItems || 0,
          processedItems: activeProcess.processedItems || 0,
        },
      });
    }

    // Handle 'SEMUA CABANG' option
    if (cabParam === "All") {
      // Initialize progress tracking
      await storeService.ensureInitialized();
      const allStores = storeService.stores;
      const branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];

      // Count total stores across all branches instead of just branch count
      const totalStores = allStores.filter(s => s.notes === "INDUK").length;
      const progressId = ProgressHelper.start({
        cab: "All",
        period: periode,
        message: `Memulai rekonsiliasi untuk semua cabang periode ${periode}`,
        details: {
          totalStores: totalStores,
          branches: branches.length,
          operation: "reconcile_all_branches",
        },
      });

      // Start reconciliation process for all branches (non-blocking)
      // Data lama akan dihapus setelah proses rekon selesai, bukan di awal
      rekonWtHarianService.reconcileAllBranchesWithProgress(periode, progressId);

      return res.status(200).json({
        success: true,
        message: "Proses rekonsiliasi dimulai",
        progressId,
        totalBranches: branches.length,
        totalStores: totalStores,
      });
    }

    // Initialize progress tracking
    await storeService.ensureInitialized();
    const branchStores = await storeService.getStoresByBranch(cab, true);
    const progressId = ProgressHelper.start({
      cab: cab,
      period: periode,
      message: `Memulai rekonsiliasi cabang ${cab} periode ${periode}`,
      details: {
        totalStores: branchStores.length,
        operation: "reconcile_branch",
      },
    });

    // Start reconciliation process (non-blocking)
    // Data lama akan dihapus setelah proses rekon selesai, bukan di awal
    rekonWtHarianService.reconcileDataWithProgress(cab, periode, progressId);

    res.status(200).json({
      success: true,
      message: "Proses rekonsiliasi dimulai",
      progressId,
      totalStores: branchStores.length,
    });
  } catch (error) {
    logger.error(`Error in startReconciliation: ${error.message}`);
    next(error);
  }
};

/**
 * Get reconciliation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getResults = async (req, res) => {
  try {
    const { cab, periode, toko } = req.params;
    const { page, limit, tipe, tgl1, searchQuery, sortColumn, sortOrder, toleranceAmount } = req.query;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    const results = await rekonWtHarianService.getResults(cab, periode, toko, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || config.pagination.defaultLimit,
      tipe,
      tgl1,
      searchQuery,
      sortColumn,
      sortOrder,
      toleranceAmount: toleranceAmount ? parseInt(toleranceAmount) : undefined,
    });

    res.status(200).json(results);
  } catch (error) {
    logger.error(`Error in getResults: ${error.message}`);
    next(error);
  }
};

/**
 * Get summary of reconciliation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getSummary = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    // Handle 'SEMUA CABANG' option
    let summary;
    if (cab === "SEMUA" || cab === "All" || !cab) {
      summary = await rekonWtHarianService.getAllCabangSummary(periode);
    } else {
      summary = await rekonWtHarianService.getSummary(cab, periode);
    }

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error(`Error in getSummary: ${error.message}`);
    next(error);
  }
};

/**
 * Delete reconciliation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteResults = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    // Handle 'SEMUA CABANG' option
    if (cab === "SEMUA") {
      const count = await rekonWtHarianService.deleteAllCabangResults(periode);

      return res.status(200).json({
        success: true,
        message: `${count} data rekonsiliasi untuk semua cabang berhasil dihapus`,
        deletedCount: count,
      });
    }

    const count = await rekonWtHarianService.deleteResults(cab, periode);

    res.status(200).json({
      success: true,
      message: `${count} data berhasil dihapus`,
      deletedCount: count,
    });
  } catch (error) {
    logger.error(`Error in deleteResults: ${error.message}`);
    next(error);
  }
};

/**
 * Get reconciliation progress
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getProgress = async (req, res, next) => {
  try {
    const { progressId } = req.params;

    if (!progressId) {
      return res.status(400).json({
        success: false,
        message: "Progress ID harus diisi",
      });
    }

    const progress = ProgressHelper.getProgress(progressId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getProgress: ${error.message}`);
    next(error);
  }
};

/**
 * Get latest reconciliation progress for a branch and period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getLatestProgress = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    const cabParam = cab === "SEMUA" ? "All" : cab;
    const progress = ProgressHelper.getLatestProgress(cabParam, periode);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error(`Error in getLatestProgress: ${error.message}`);
    next(error);
  }
};

/**
 * Get daily shop summary - rekap data per toko per tanggal
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getDailyShopSummary = async (req, res, next) => {
  try {
    const { cab, periode } = req.params;
    const { page = 1, limit = 50, toko, tgl1, searchQuery, sortColumn = "tanggal", sortOrder = "asc" } = req.query;

    if (!periode) {
      return res.status(400).json({
        success: false,
        message: "Periode harus diisi",
      });
    }

    // Handle 'SEMUA CABANG' option
    const cabFilter = cab === "SEMUA CABANG" ? "All" : cab;

    logger.info(`getDailyShopSummary request: cab=${cabFilter}, periode=${periode}, page=${page}, limit=${limit}`);

    const results = await rekonWtHarianService.getDailyShopSummary(cabFilter, periode, {
      page: parseInt(page),
      limit: parseInt(limit),
      toko,
      tgl1,
      searchQuery,
      sortColumn,
      sortOrder,
    });

    res.status(200).json(results);
  } catch (error) {
    logger.error(`Error in getDailyShopSummary: ${error.message}`);
    next(error);
  }
};

/**
 * Start reconciliation process for specific shop
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const refreshShopReconciliation = async (req, res, next) => {
  try {
    const { periode, cab, toko } = req.params;

    if (!periode || !cab || !toko) {
      return res.status(400).json({
        success: false,
        message: "Periode, cabang, dan toko harus diisi",
      });
    }

    // Validate periode format (YYMM)
    if (!/^\d{4}$/.test(periode)) {
      return res.status(400).json({
        success: false,
        message: "Format periode tidak valid. Gunakan format YYMM (contoh: 2507 untuk Juli 2025)",
      });
    }

    // Start reconciliation process for specific shop in background
    rekonWtHarianService
      .reconcileSpecificShop(cab, periode, toko)
      .then((result) => {
        logger.info(`Rekonsiliasi toko ${toko} cabang ${cab} periode ${periode} selesai`);
      })
      .catch((error) => {
        logger.error(`Error in shop reconciliation: ${error.message}`);
      });

    res.status(202).json({
      success: true,
      message: `Proses rekonsiliasi untuk toko ${toko} cabang ${cab} periode ${periode} telah dimulai`,
      data: {
        cab: cab,
        periode: periode,
        toko: toko,
      },
    });
  } catch (error) {
    logger.error(`Error in refreshShopReconciliation: ${error.message}`);
    next(error);
  }
};

/**
 * Invalidate cache manually
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const invalidateCache = async (req, res, next) => {
  try {
    rekonWtHarianService.invalidateCache();

    res.status(200).json({
      success: true,
      message: "Cache invalidated successfully. Data will be reloaded on next request.",
    });
  } catch (error) {
    logger.error(`Error in invalidateCache: ${error.message}`);
    next(error);
  }
};

// Removed default export - using named exports only
