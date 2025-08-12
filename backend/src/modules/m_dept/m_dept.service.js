/**
 * Service for m_dept data
 */
const MDept = require("../../models/m_dept.model");
const SalesPerDept = require("../../models/sales_per_dept.model");
const logger = require("../../config/logger");
const { Op } = require("sequelize");
const fs = require("fs");
const csv = require("csv-parser");
const { sequelize } = require("../../config/database");

class MDeptService {
  /**
   * Get all departments
   * @returns {Promise<Array>} List of departments
   */
  async getAllDepartments() {
    try {
      return await MDept.findAll({
        order: [["dep_kd", "ASC"]],
      });
    } catch (error) {
      logger.error(`Error in getAllDepartments: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new department
   * @param {Object} departmentData - Department data
   * @returns {Promise<Object>} Created department
   */
  async createDepartment(departmentData) {
    try {
      const department = await MDept.create(departmentData);
      
      // Update dep_name in sales_per_dept table
      await this.updateSalesPerDeptDepartmentNames(departmentData.dep_kd, departmentData.dep_nm);
      
      return department;
    } catch (error) {
      logger.error(`Error in createDepartment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing department
   * @param {string} dep_kd - Department code
   * @param {Object} departmentData - Department data
   * @returns {Promise<Object>} Updated department
   */
  async updateDepartment(dep_kd, departmentData) {
    try {
      const department = await MDept.findByPk(dep_kd);

      if (!department) {
        return null;
      }

      await department.update(departmentData);
      
      // Update dep_name in sales_per_dept table if dep_nm was updated
      if (departmentData.dep_nm) {
        await this.updateSalesPerDeptDepartmentNames(dep_kd, departmentData.dep_nm);
      }
      
      return department;
    } catch (error) {
      logger.error(`Error in updateDepartment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process departments from uploaded file
   * @param {Object} file - Uploaded file
   * @returns {Promise<Object>} Processing results
   */
  async processDepartmentsFile(file) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let processed = 0;
      let created = 0;
      let updated = 0;

      fs.createReadStream(file.path)
        .pipe(csv())
        .on("data", async (data) => {
          try {
            // Validate required fields
            if (!data.dep_kd || !data.dep_nm || !data.div_kd) {
              errors.push({
                row: processed + 1,
                error: "Missing required fields (dep_kd, dep_nm, or div_kd)",
                data,
              });
              processed++;
              return;
            }

            // Check if department exists
            const [department, isCreated] = await MDept.findOrCreate({
              where: { dep_kd: data.dep_kd },
              defaults: {
                dep_nm: data.dep_nm,
                div_kd: data.div_kd,
                dep_mgr: data.dep_mgr || "",
              },
            });

            if (!isCreated) {
              // Update existing department
              await department.update({
                dep_nm: data.dep_nm,
                div_kd: data.div_kd,
                dep_mgr: data.dep_mgr || department.dep_mgr,
              });
              updated++;
            } else {
              created++;
            }

            // Update dep_name in sales_per_dept table
            await this.updateSalesPerDeptDepartmentNames(data.dep_kd, data.dep_nm);

            results.push(department);
            processed++;
          } catch (error) {
            errors.push({
              row: processed + 1,
              error: error.message,
              data,
            });
            processed++;
          }
        })
        .on("end", () => {
          // Delete temporary file
          fs.unlinkSync(file.path);

          resolve({
            processed,
            created,
            updated,
            errors,
          });
        })
        .on("error", (error) => {
          // Delete temporary file
          fs.unlinkSync(file.path);
          reject(error);
        });
    });
  }

  /**
   * Update department names in sales_per_dept table
   * @param {string} dep_kd - Department code
   * @param {string} dep_nm - Department name
   * @returns {Promise<void>}
   */
  async updateSalesPerDeptDepartmentNames(dep_kd, dep_nm) {
    try {
      await SalesPerDept.update(
        { dep_name: dep_nm },
        { where: { dep_kd } }
      );
    } catch (error) {
      logger.error(`Error updating sales_per_dept department names: ${error.message}`);
      // Don't throw the error to prevent disrupting the main flow
    }
  }
}

module.exports = MDeptService;