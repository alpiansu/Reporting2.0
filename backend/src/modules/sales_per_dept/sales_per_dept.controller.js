/**
 * Controller for sales per department data
 */
const SalesPerDeptService = require("./sales_per_dept.service");
const logger = require("../../config/logger");
const { apiResponse } = require("../../utils");

// Create a singleton instance of the service
const salesPerDeptServiceInstance = new SalesPerDeptService();

class SalesPerDeptController {
  constructor(salesPerDeptService) {
    this.salesPerDeptService = salesPerDeptService || salesPerDeptServiceInstance;
  }

  /**
   * Trigger data synchronization for sales per department
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async syncSalesPerDept(req, res, next) {
    try {
      const { cab, periode } = req.body;

      if (!cab || !periode) {
        return apiResponse.badRequest(res, "Cabang (cab) and periode are required");
      }

      logger.info(`Triggering sales per department synchronization for cab: ${cab}, periode: ${periode}`);

      const result = await this.salesPerDeptService.extractSalesPerDept(cab, periode);

      if (result.success) {
        return apiResponse.success(res, {
          message: "Sales per department data synchronization completed successfully",
          data: result.data,
        });
      } else {
        return apiResponse.error(res, result.message, 500);
      }
    } catch (error) {
      logger.error(`Error in syncSalesPerDept: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get sales per department data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getSalesPerDept(req, res, next) {
    try {
      const { cab, periode, tipestore } = req.query;

      if (!cab || !periode || !tipestore) {
        return apiResponse.badRequest(res, "Cabang (cab), tipestore and periode are required");
      }

      const filters = {
        cab,
        periode,
        tipestore: tipestore,
      };

      const data = await this.salesPerDeptService.getSalesPerDept(filters);

      return apiResponse.success(res, {
        message: "Sales per department data retrieved successfully",
        data,
      });
    } catch (error) {
      logger.error(`Error in getSalesPerDept: ${error.message}`);
      next(error);
    }
  }

  /**
   * Compare sales per department data between two periods
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async compareSalesPerDept(req, res, next) {
    try {
      const { cab, periode1, periode2, tipestore } = req.query;

      if (!cab || !periode1 || !periode2) {
        return apiResponse.badRequest(res, "Cabang (cab), periode1, and periode2 are required");
      }

      const filters = {
        cab,
        periode1,
        periode2,
        tipestore: tipestore || "ALL",
      };

      const data = await this.salesPerDeptService.compareSalesPerDept(filters);

      return apiResponse.success(res, {
        message: "Sales per department comparison data retrieved successfully",
        data,
      });
    } catch (error) {
      logger.error(`Error in compareSalesPerDept: ${error.message}`);
      next(error);
    }
  }
}

module.exports = SalesPerDeptController;
