/**
 * Store model - JSON file based implementation
 *
 * This model provides an interface similar to Sequelize models
 * but uses a JSON file as the data source instead of a database.
 *
 * The actual data operations are handled by the storeService.
 */
const storeService = require("../modules/store/store.service");

// Define the Store model schema for documentation and validation
const StoreSchema = {
  id: { type: "number", primaryKey: true },
  storeCode: { type: "string", required: true },
  station: { type: "string", required: true },
  dbHost: { type: "string", required: true },
  notes: { type: "string" },
  storeName: { type: "string", required: true },
  branch: { type: "string", required: true, comment: "Kode cabang dari field 'Cab'" },
  updtime: { type: "date" },
  createdAt: { type: "date" },
  updatedAt: { type: "date" },
};

/**
 * Store model with methods similar to Sequelize models
 * but using the storeService for actual data operations
 */
const Store = {
  // Schema definition for documentation
  schema: StoreSchema,

  /**
   * Find all stores with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of store objects
   */
  findAll: async (options = {}) => {
    const { where = {}, limit, offset, order } = options;

    // Get all stores from service
    const result = await storeService.getAllStores({
      page: offset ? Math.floor(offset / (limit || 10)) + 1 : 1,
      limit: limit || 10,
      search: where.search,
      region: where.region,
      city: where.city,
      status: where.isActive === true ? "active" : where.isActive === false ? "inactive" : undefined,
    });

    return result.stores;
  },

  /**
   * Find and count all stores with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Object with count and rows properties
   */
  findAndCountAll: async (options = {}) => {
    const { where = {}, limit, offset, order } = options;

    // Get all stores from service
    const result = await storeService.getAllStores({
      page: offset ? Math.floor(offset / (limit || 10)) + 1 : 1,
      limit: limit || 10,
      search: where.search,
      region: where.region,
      city: where.city,
      status: where.isActive === true ? "active" : where.isActive === false ? "inactive" : undefined,
    });

    return {
      count: result.totalItems,
      rows: result.stores,
    };
  },

  /**
   * Find a store by primary key
   * @param {number} id - Store ID
   * @returns {Promise<Object>} Store object
   */
  findByPk: async id => {
    return storeService.getStoreById(id);
  },

  /**
   * Find one store with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Store object
   */
  findOne: async (options = {}) => {
    const { where = {} } = options;

    if (where.storeCode) {
      return storeService.getStoreByCode(where.storeCode);
    }

    // If no specific query, get the first store
    const stores = await storeService.getAllStores({ limit: 1 });
    return stores.stores[0] || null;
  },

  /**
   * Create a new store
   * @param {Object} data - Store data
   * @returns {Promise<Object>} Created store
   */
  create: async data => {
    return storeService.createStore(data);
  },

  /**
   * Bulk create multiple stores
   * @param {Array} dataArray - Array of store data
   * @returns {Promise<Array>} Array of created stores
   */
  bulkCreate: async dataArray => {
    const results = [];
    for (const data of dataArray) {
      const store = await storeService.createStore(data);
      results.push(store);
    }
    return results;
  },
};

module.exports = Store;
