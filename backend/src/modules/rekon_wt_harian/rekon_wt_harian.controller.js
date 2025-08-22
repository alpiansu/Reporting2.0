/**
 * Controller for WT reconciliation
 */
const rekonWtHarianService = require("./rekon_wt_harian.service");
const rekonProgressService = require("./rekon_progress.service");
const logger = require("../../config/logger");
const config = require("../../config/rekon_wt_harian.config");

class RekonWtHarianController {
  /**
   * Start reconciliation process
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async startReconciliation(req, res, next) {
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

      // Check if there is already an active reconciliation process
      const cabParam = cab === "SEMUA" || !cab ? "All" : cab;
      const activeProcess = rekonProgressService.getActiveProcess(cabParam, periode);

      if (activeProcess) {
        return res.status(409).json({
          success: false,
          message: `Proses rekonsiliasi untuk ${
            activeProcess.cab === "All" ? "semua cabang" : `cabang ${activeProcess.cab}`
          } periode ${periode} sedang berjalan. Silakan tunggu hingga proses selesai.`,
          activeProcess: {
            id: activeProcess.id,
            cab: activeProcess.cab,
            periode: activeProcess.periode,
            status: activeProcess.status,
            percentage: activeProcess.percentage,
            startTime: activeProcess.startTime,
          },
        });
      }

      // Handle 'SEMUA CABANG' option
      if (cabParam === "All") {
        // Initialize progress tracking
        const storeService = require("../../modules/store/storeService");
        await storeService.ensureInitialized();
        const allStores = storeService.stores;
        const branches = [...new Set(allStores.filter(s => s.notes === "INDUK").map(s => s.branch || s.cab))];

        // Count total stores across all branches instead of just branch count
        const totalStores = allStores.filter(s => s.notes === "INDUK").length;
        const progressId = rekonProgressService.initProgress("All", periode, totalStores);

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
      const storeService = require("../../modules/store/storeService");
      await storeService.ensureInitialized();
      const branchStores = await storeService.getStoresByBranch(cab, true);
      const progressId = rekonProgressService.initProgress(cab, periode, branchStores.length);

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
  }

  /**
   * Get reconciliation results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getResults(req, res) {
    try {
      const { cab, periode } = req.params;
      const { page, limit, tipe, toko, tgl1, searchQuery, sortColumn, sortOrder } = req.query;

      if (!periode) {
        return res.status(400).json({
          success: false,
          message: "Periode harus diisi",
        });
      }

      // Handle 'SEMUA CABANG' option
      if (cab === "All") {
        const results = await rekonWtHarianService.getResults(cab, periode, {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || config.pagination.defaultLimit,
          tipe,
          toko,
          tgl1,
          searchQuery,
          sortColumn,
          sortOrder,
        });
        return res.status(200).json(results);
      }

      const results = await rekonWtHarianService.getResults(cab, periode, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || config.pagination.defaultLimit,
        tipe,
        toko,
        tgl1,
        searchQuery,
        sortColumn,
        sortOrder,
      });

      res.status(200).json(results);
    } catch (error) {
      logger.error(`Error in getResults: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get summary of reconciliation results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getSummary(req, res, next) {
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
  }

  /**
   * Delete reconciliation results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteResults(req, res, next) {
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
  }

  /**
   * Get reconciliation progress
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getProgress(req, res, next) {
    try {
      const { progressId } = req.params;

      if (!progressId) {
        return res.status(400).json({
          success: false,
          message: "Progress ID harus diisi",
        });
      }

      const progress = rekonProgressService.getProgress(progressId);

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
  }

  /**
   * Get latest reconciliation progress for a branch and period
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getLatestProgress(req, res, next) {
    try {
      const { cab, periode } = req.params;

      if (!periode) {
        return res.status(400).json({
          success: false,
          message: "Periode harus diisi",
        });
      }

      const cabParam = cab === "SEMUA" ? "All" : cab;
      const progress = rekonProgressService.getLatestProgress(cabParam, periode);

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
  }
}

module.exports = new RekonWtHarianController();
