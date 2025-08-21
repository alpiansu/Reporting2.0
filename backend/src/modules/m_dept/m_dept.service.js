/**
 * Service for m_dept data using JSON file storage
 */
const fs = require("fs").promises;
const path = require("path");
const logger = require("../../config/logger");
const csv = require("csv-parser");
const { createReadStream } = require("fs");

class MDeptService {
  constructor() {
    // Get the absolute path to the JSON file
    this.filePath = path.join(process.cwd(), "data/m_dept.json");
    this.deptList = [];
    this.initialized = false;
  }

  /**
   * Initialize the service
   * Alias for initialize() for compatibility with server.js
   */
  async init() {
    return this.initialize();
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(this.filePath, "utf8");
        this.deptList = JSON.parse(data);
        logger.info(`Loaded ${this.deptList.length} departments from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          this.deptList = [];
          await this.saveToFile();
          logger.info("Created new m_dept.json file");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize m_dept service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save department data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.deptList, null, 2));
      // logger.info(`Saved ${this.deptList.length} departments to JSON file`);
    } catch (error) {
      logger.error(`Failed to save departments to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized before performing operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get all departments
   * @returns {Promise<Array>} List of departments
   */
  async getAllDepartments() {
    try {
      await this.ensureInitialized();
      return [...this.deptList].sort((a, b) => a.dep_kd.localeCompare(b.dep_kd));
    } catch (error) {
      logger.error(`Error in getAllDepartments: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get department by code
   * @param {string} dep_kd - Department code
   * @returns {Promise<Object>} Department data
   */
  async getDepartmentByCode(dep_kd) {
    try {
      await this.ensureInitialized();
      return this.deptList.find(dept => dept.dep_kd === dep_kd) || null;
    } catch (error) {
      logger.error(`Error in getDepartmentByCode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new department
   * @param {Object} deptData - Department data
   * @returns {Promise<Object>} Created department
   */
  async createDepartment(deptData) {
    try {
      await this.ensureInitialized();

      // Check if department already exists
      const existingDept = await this.getDepartmentByCode(deptData.dep_kd);
      if (existingDept) {
        throw new Error(`Department with code ${deptData.dep_kd} already exists`);
      }

      // Create new department
      const newDept = {
        dep_kd: deptData.dep_kd,
        dep_nm: deptData.dep_nm,
        div_kd: deptData.div_kd,
        dep_mgr: deptData.dep_mgr || "",
      };

      // Add to department list
      this.deptList.push(newDept);

      // Save to file
      await this.saveToFile();

      return newDept;
    } catch (error) {
      logger.error(`Error in createDepartment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing department
   * @param {string} dep_kd - Department code
   * @param {Object} deptData - Department data
   * @returns {Promise<Object>} Updated department
   */
  async updateDepartment(dep_kd, deptData) {
    try {
      await this.ensureInitialized();

      // Find department index
      const index = this.deptList.findIndex(dept => dept.dep_kd === dep_kd);
      if (index === -1) {
        return null;
      }

      // Update department
      const updatedDept = {
        ...this.deptList[index],
        dep_nm: deptData.dep_nm || this.deptList[index].dep_nm,
        div_kd: deptData.div_kd || this.deptList[index].div_kd,
        dep_mgr: deptData.dep_mgr || this.deptList[index].dep_mgr,
      };

      // Replace in list
      this.deptList[index] = updatedDept;

      // Save to file
      await this.saveToFile();

      // Update department names in sales_per_dept table
      if (deptData.dep_nm) {
        await this.updateSalesPerDeptDepartmentNames(dep_kd, deptData.dep_nm);
      }

      return updatedDept;
    } catch (error) {
      logger.error(`Error in updateDepartment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process departments from uploaded CSV file
   * @param {Object} file - Uploaded file object
   * @returns {Promise<Object>} Processing results
   */
  async processDepartmentsFile(file) {
    try {
      await this.ensureInitialized();

      return new Promise((resolve, reject) => {
        const results = [];
        const errors = [];
        let processed = 0;
        let created = 0;
        let updated = 0;

        createReadStream(file.path)
          .pipe(csv())
          .on("data", async data => {
            try {
              // Validate required fields
              if (!data.dep_kd || !data.dep_nm || !data.div_kd) {
                throw new Error("Missing required fields: dep_kd, dep_nm, or div_kd");
              }

              // Check if department exists
              const existingDept = await this.getDepartmentByCode(data.dep_kd);
              let department;

              if (existingDept) {
                // Update existing department
                department = await this.updateDepartment(data.dep_kd, data);
                updated++;
              } else {
                // Create new department
                department = await this.createDepartment(data);
                created++;
              }

              // Update department names in sales_per_dept table
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
            fs.unlink(file.path).catch(err => {
              logger.error(`Error deleting temporary file: ${err.message}`);
            });

            resolve({
              processed,
              created,
              updated,
              errors,
            });
          })
          .on("error", error => {
            // Delete temporary file
            fs.unlink(file.path).catch(err => {
              logger.error(`Error deleting temporary file: ${err.message}`);
            });
            reject(error);
          });
      });
    } catch (error) {
      logger.error(`Error processing departments file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update department names in sales_per_dept table
   * @param {string} dep_kd - Department code
   * @param {string} dep_nm - Department name
   * @returns {Promise<void>}
   */
  async updateSalesPerDeptDepartmentNames(dep_kd, dep_nm) {
    try {
      // In the JSON-based implementation, we'll just log this operation
      // since we're not using MySQL anymore
      logger.info(`Would update department name for dep_kd: ${dep_kd} to ${dep_nm} in sales_per_dept`);

      // Note: In a real implementation, you might want to update a sales_per_dept.json file
      // if that module is also converted to use JSON files
    } catch (error) {
      logger.error(`Error updating sales_per_dept department names: ${error.message}`);
      // Don't throw the error to prevent disrupting the main flow
    }
  }
}

module.exports = MDeptService;
