/**
 * PrepClosing Model
 * Resilient backend pattern with JSON fallback
 */
import BaseService from "../services/base.service.js";
import PrepClosingService from "../modules/prep-closing/prep_closing.service.js";
import PrepClosingStagingService from "../modules/prep-closing/prep_closing_staging.service.js";

class PrepClosingWrapper extends BaseService {
  constructor() {
    super();
    this.prepClosingService = new PrepClosingService();
    this.prepClosingStagingService = new PrepClosingStagingService();
  }

  /**
   * Find all prep closing records
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of prep closing records
   */
  async findAll(options = {}) {
    return this.executeWithFallback(
      async () => {
        const { where = {}, limit, offset = 0, order } = options;
        const result = await this.prepClosingStagingService.getPrepClosingData(where, limit, offset);
        return result.data;
      },
      async () => {
        const { where = {}, limit, offset = 0 } = options;
        return this.prepClosingService.getAllPrepClosing(where, limit, offset);
      },
      "findAll prep_closing"
    );
  }

  /**
   * Find one prep closing record
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Prep closing record or null
   */
  async findOne(options = {}) {
    return this.executeWithFallback(
      async () => {
        const result = await this.prepClosingStagingService.getPrepClosingData(options.where || {}, 1, 0);
        return result.data.length > 0 ? result.data[0] : null;
      },
      async () => {
        const allData = this.prepClosingService.getAllPrepClosing(options.where || {});
        return allData.length > 0 ? allData[0] : null;
      },
      "findOne prep_closing"
    );
  }

  /**
   * Find prep closing record by primary key
   * @param {Object} pk - Primary key object {cab, kdtk, key}
   * @returns {Promise<Object|null>} Prep closing record or null
   */
  async findByPk(pk) {
    const { cab, kdtk, key } = pk;
    return this.findOne({
      where: { cab, kdtk, key },
    });
  }

  /**
   * Create prep closing record
   * @param {Object} data - Prep closing data
   * @returns {Promise<Object>} Created record
   */
  async create(data) {
    const result = await this.executeWriteOperation(async () => {
      return await this.prepClosingStagingService.createPrepClosing(data);
    }, "create prep_closing");

    // Sync to JSON file after successful database operation
    try {
      await this.prepClosingStagingService.syncToJsonFile();
    } catch (error) {
      console.warn("Failed to sync prep_closing to JSON after create:", error.message);
    }

    return result;
  }

  /**
   * Update prep closing records
   * @param {Object} data - Update data
   * @param {Object} options - Update options with where clause
   * @returns {Promise<Array>} Update result
   */
  async update(data, options) {
    const result = await this.executeWriteOperation(async () => {
      return await this.prepClosingStagingService.updatePrepClosing(data, options.where);
    }, "update prep_closing");

    // Sync to JSON file after successful database operation
    try {
      await this.prepClosingStagingService.syncToJsonFile();
    } catch (error) {
      console.warn("Failed to sync prep_closing to JSON after update:", error.message);
    }

    return result;
  }

  /**
   * Delete prep closing records
   * @param {Object} options - Delete options with where clause
   * @returns {Promise<number>} Number of deleted records
   */
  async destroy(options) {
    const result = await this.executeWriteOperation(async () => {
      return await this.prepClosingStagingService.deletePrepClosing(options.where);
    }, "destroy prep_closing");

    // Sync to JSON file after successful database operation
    try {
      await this.prepClosingStagingService.syncToJsonFile();
    } catch (error) {
      console.warn("Failed to sync prep_closing to JSON after destroy:", error.message);
    }

    return result;
  }

  /**
   * Count prep closing records
   * @param {Object} options - Count options
   * @returns {Promise<number>} Count of records
   */
  async count(options = {}) {
    return this.executeWithFallback(
      async () => {
        return await this.prepClosingStagingService.getCount(options.where || {});
      },
      async () => {
        const allData = this.prepClosingService.getAllPrepClosing(options.where || {});
        return allData.length;
      },
      "count prep_closing"
    );
  }

  /**
   * Bulk create prep closing records
   * @param {Array} dataArray - Array of prep closing data
   * @param {Object} options - Bulk create options
   * @returns {Promise<Array>} Created records
   */
  async bulkCreate(dataArray, options = {}) {
    const result = await this.executeWriteOperation(async () => {
      return await this.prepClosingStagingService.bulkCreatePrepClosing(dataArray);
    }, "bulkCreate prep_closing");

    // Sync to JSON file after successful database operation
    try {
      await this.prepClosingStagingService.syncToJsonFile();
    } catch (error) {
      console.warn("Failed to sync prep_closing to JSON after bulkCreate:", error.message);
    }

    return result;
  }

  /**
   * Upsert prep closing record
   * @param {Object} data - Prep closing data
   * @returns {Promise<Object>} Upsert result
   */
  async upsert(data) {
    const result = await this.executeWriteOperation(async () => {
      return await this.prepClosingStagingService.upsertPrepClosing(data);
    }, "upsert prep_closing");

    // Sync to JSON file after successful database operation
    try {
      await this.prepClosingStagingService.syncToJsonFile();
    } catch (error) {
      console.warn("Failed to sync prep_closing to JSON after upsert:", error.message);
    }

    return result;
  }

  /**
   * Find or create prep closing record
   * @param {Object} options - Options with where and defaults
   * @returns {Promise<Object>} Find or create result
   */
  async findOrCreate(options) {
    const result = await this.executeWriteOperation(async () => {
      return await this.prepClosingStagingService.findOrCreatePrepClosing(options.where, options.defaults);
    }, "findOrCreate prep_closing");

    // Sync to JSON file after successful database operation if record was created
    if (result.created) {
      try {
        await this.prepClosingStagingService.syncToJsonFile();
      } catch (error) {
        console.warn("Failed to sync prep_closing to JSON after findOrCreate:", error.message);
      }
    }

    return result;
  }

  /**
   * Extract filters from query parameters
   * @param {Object} query - Query parameters
   * @returns {Object} Extracted filters
   */
  extractFilters(query) {
    const filters = {};

    if (query.cab) filters.cab = query.cab;
    if (query.kdtk) filters.kdtk = query.kdtk;
    if (query.key) filters.key = query.key;
    if (query.nilai) filters.nilai = query.nilai;
    if (query.valid !== undefined) {
      filters.valid = query.valid === "true" || query.valid === true;
    }

    return filters;
  }

  /**
   * Get prep closing data with pagination and filters
   * @param {Object} filters - Filter criteria
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Records per page
   * @returns {Promise<Object>} Paginated result
   */
  async getPaginatedData(filters = {}, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    return this.executeWithFallback(
      async () => {
        const result = await this.prepClosingStagingService.getPrepClosingData(filters, limit, offset);
        return {
          data: result.data,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        };
      },
      async () => {
        const allData = this.prepClosingService.getAllPrepClosing(filters);
        const total = allData.length;
        const data = allData.slice(offset, offset + limit);

        return {
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      "getPaginatedData prep_closing"
    );
  }
}

// Create and export singleton instance
const prepClosingModel = new PrepClosingWrapper();
export default prepClosingModel;

// Also export the class for testing purposes
export { PrepClosingWrapper };
