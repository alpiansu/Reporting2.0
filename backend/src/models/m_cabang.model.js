/**
 * MCabang model - JSON file based implementation
 *
 * This model provides an interface similar to Sequelize models
 * but uses a JSON file as the data source instead of a database.
 *
 * The actual data operations are handled by the MCabangService.
 */
const MCabangService = require("../modules/m_cabang/m_cabang.service");

// Create a singleton instance of the service
const mCabangService = new MCabangService();

// Define the MCabang model schema for documentation and validation
const MCabangSchema = {
  kdcab: { type: "string", primaryKey: true },
  namacab: { type: "string", required: true },
};

/**
 * MCabang model with methods similar to Sequelize models
 * but using the MCabangService for actual data operations
 */
const MCabang = {
  // Schema definition for documentation
  schema: MCabangSchema,

  /**
   * Find all cabang with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of cabang objects
   */
  findAll: async (options = {}) => {
    // Get all cabang from service
    return mCabangService.getAllCabang();
  },

  /**
   * Count all cabang
   * @returns {Promise<number>} Count of cabang
   */
  count: async () => {
    const cabangList = await mCabangService.getAllCabang();
    return cabangList.length;
  },

  /**
   * Find a cabang by primary key
   * @param {string} kdcab - Cabang code
   * @returns {Promise<Object>} Cabang object
   */
  findByPk: async (kdcab) => {
    return mCabangService.getCabangByCode(kdcab);
  },

  /**
   * Find one cabang with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Cabang object
   */
  findOne: async (options = {}) => {
    const { where = {} } = options;

    if (where.kdcab) {
      return mCabangService.getCabangByCode(where.kdcab);
    }

    // If no specific query, get the first cabang
    const cabangList = await mCabangService.getAllCabang();
    return cabangList[0] || null;
  },

  /**
   * Create a new cabang
   * @param {Object} data - Cabang data
   * @returns {Promise<Object>} Created cabang
   */
  create: async (data) => {
    return mCabangService.createCabang(data);
  },

  /**
   * Bulk create multiple cabang
   * @param {Array} dataArray - Array of cabang data
   * @returns {Promise<Array>} Array of created cabang
   */
  bulkCreate: async (dataArray) => {
    const results = [];
    for (const data of dataArray) {
      const cabang = await mCabangService.createCabang(data);
      results.push(cabang);
    }
    return results;
  },
};

module.exports = MCabang;