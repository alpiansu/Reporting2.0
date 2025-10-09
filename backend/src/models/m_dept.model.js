/**
 * MDept model - JSON file based implementation
 *
 * This model provides an interface similar to Sequelize models
 * but uses a JSON file as the data source instead of a database.
 *
 * The actual data operations are handled by the MDeptService.
 */
import MDeptService from "../modules/m_dept/m_dept.service.js";

// Create a singleton instance of the service
const mDeptService = new MDeptService();

// Define the MDept model schema for documentation and validation
const MDeptSchema = {
  dep_kd: { type: "string", primaryKey: true },
  dep_nm: { type: "string", required: true },
  div_kd: { type: "string", required: true },
  dep_mgr: { type: "string", required: false },
};

/**
 * MDept model with methods similar to Sequelize models
 * but using the MDeptService for actual data operations
 */
const MDept = {
  // Schema definition for documentation
  schema: MDeptSchema,

  /**
   * Find all departments with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of department objects
   */
  findAll: async (options = {}) => {
    // Get all departments from service
    return mDeptService.getAllDepartments();
  },

  /**
   * Count all departments
   * @returns {Promise<number>} Count of departments
   */
  count: async () => {
    const deptList = await mDeptService.getAllDepartments();
    return deptList.length;
  },

  /**
   * Find a department by primary key
   * @param {string} dep_kd - Department code
   * @returns {Promise<Object|null>} Department object or null if not found
   */
  findByPk: async dep_kd => {
    await mDeptService.init();
    return mDeptService.getDepartmentByCode(dep_kd);
  },

  /**
   * Create a new department
   * @param {Object} deptData - Department data
   * @returns {Promise<Object>} Created department
   */
  create: async deptData => {
    return mDeptService.createDepartment(deptData);
  },

  /**
   * Find or create a department
   * @param {Object} options - Options containing where clause and defaults
   * @returns {Promise<Array>} Array with department object and boolean indicating if created
   */
  findOrCreate: async ({ where, defaults }) => {
    const existingDept = await mDeptService.getDepartmentByCode(where.dep_kd);

    if (existingDept) {
      return [existingDept, false];
    }

    const newDept = await mDeptService.createDepartment({
      ...where,
      ...defaults,
    });

    return [newDept, true];
  },

  /**
   * Update departments matching the where clause
   * @param {Object} values - Values to update
   * @param {Object} options - Options containing where clause
   * @returns {Promise<Array>} Array with count of updated records
   */
  update: async (values, { where }) => {
    if (where.dep_kd) {
      const dept = await mDeptService.updateDepartment(where.dep_kd, values);
      return dept ? [1] : [0];
    }

    // For compatibility with Sequelize, return count of updated records
    return [0];
  },

  /**
   * Get model method for registry compatibility
   * Note: MDept is JSON-based, but this maintains interface consistency
   */
  getModel: async () => {
    // Return a mock Sequelize-like object for JSON-based model
    return {
      sync: async () => {
        await mDeptService.init();
        return true;
      },
      // Add other mock methods as needed
    };
  },
};

export default MDept;
