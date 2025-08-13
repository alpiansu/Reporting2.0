/**
 * Controller for WT reconciliation
 */
const rekonWtHarianService = require("./rekon_wt_harian.service");
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

      // Handle 'SEMUA CABANG' option
      if (cab === "All" || !cab) {
        // Delete existing results for all branches in this period
        await rekonWtHarianService.deleteAllCabangResults(periode);

        // Start reconciliation process for all branches
        const result = await rekonWtHarianService.reconcileAllBranches(periode);

        return res.status(200).json(result);
      }

      // Delete existing results for this cab and period
      await rekonWtHarianService.deleteResults(cab, periode);

      // Start reconciliation process
      const result = await rekonWtHarianService.reconcileData(cab, periode);

      res.status(200).json(result);
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
  async getResults(req, res, next) {
    try {
      const { periode, cab } = req.params;
      const { page, limit, tipe, toko, tgl1 } = req.query;

      if (!periode) {
        return res.status(400).json({
          success: false,
          message: "Periode harus diisi",
        });
      }

      // Handle 'SEMUA CABANG' option
      if (cab === "All") {
        const results = await rekonWtHarianService.getAllCabangResults(periode, {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || config.pagination.defaultLimit,
          tipe,
          toko,
          tgl1,
        });
        return res.status(200).json(results);
      }

      const results = await rekonWtHarianService.getResults(cab, periode, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || config.pagination.defaultLimit,
        tipe,
        toko,
        tgl1,
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
}

module.exports = new RekonWtHarianController();
