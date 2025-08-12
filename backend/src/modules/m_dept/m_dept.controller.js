/**
 * Controller for m_dept data
 */
const MDeptService = require("./m_dept.service");
const logger = require("../../config/logger");
const { apiResponse } = require("../../utils");

// Create a singleton instance of the service
const mDeptServiceInstance = new MDeptService();

class MDeptController {
  constructor(mDeptService) {
    this.mDeptService = mDeptService || mDeptServiceInstance;
  }

  /**
   * Get all departments
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllDepartments(req, res, next) {
    try {
      const departments = await this.mDeptService.getAllDepartments();

      return apiResponse.success(res, {
        message: "Departments retrieved successfully",
        data: departments,
      });
    } catch (error) {
      logger.error(`Error in getAllDepartments: ${error.message}`);
      next(error);
    }
  }

  /**
   * Create a new department
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createDepartment(req, res, next) {
    try {
      const departmentData = req.body;

      if (!departmentData.dep_kd || !departmentData.dep_nm || !departmentData.div_kd) {
        return apiResponse.badRequest(res, "Department code (dep_kd), name (dep_nm), and division code (div_kd) are required");
      }

      const department = await this.mDeptService.createDepartment(departmentData);

      return apiResponse.created(res, {
        message: "Department created successfully",
        data: department,
      });
    } catch (error) {
      logger.error(`Error in createDepartment: ${error.message}`);
      next(error);
    }
  }

  /**
   * Update an existing department
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateDepartment(req, res, next) {
    try {
      const { dep_kd } = req.params;
      const departmentData = req.body;

      if (!dep_kd) {
        return apiResponse.badRequest(res, "Department code (dep_kd) is required");
      }

      const department = await this.mDeptService.updateDepartment(dep_kd, departmentData);

      if (!department) {
        return apiResponse.notFound(res, `Department with code ${dep_kd} not found`);
      }

      return apiResponse.success(res, {
        message: "Department updated successfully",
        data: department,
      });
    } catch (error) {
      logger.error(`Error in updateDepartment: ${error.message}`);
      next(error);
    }
  }

  /**
   * Upload departments from file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async uploadDepartments(req, res, next) {
    try {
      if (!req.file) {
        return apiResponse.badRequest(res, "No file uploaded");
      }

      const result = await this.mDeptService.processDepartmentsFile(req.file);

      return apiResponse.success(res, {
        message: "Departments uploaded successfully",
        data: result,
      });
    } catch (error) {
      logger.error(`Error in uploadDepartments: ${error.message}`);
      next(error);
    }
  }
}

module.exports = MDeptController;