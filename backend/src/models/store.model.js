import storeService from "../modules/store/store.service.js";

const StoreWrapper = {
  async findAll(options = {}) {
    const { where = {}, limit, offset, order } = options;
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

  async findAndCountAll(options = {}) {
    const { where = {}, limit, offset, order } = options;
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

  async findByPk(id) {
    return storeService.getStoreById(id);
  },

  async findOne(options = {}) {
    const { where = {} } = options;
    if (where.storeCode) {
      return storeService.getStoreByCode(where.storeCode);
    }
    const stores = await storeService.getAllStores({ limit: 1 });
    return stores.stores[0] || null;
  },

  async create(data, options) {
    return storeService.createStore(data);
  },

  async update(data, options) {
    const id = options?.where?.id || data?.id;
    if (id) {
      const store = await storeService.updateStore(id, data);
      return store ? [1] : [0];
    }
    return [0];
  },

  async destroy(options) {
    const id = options?.where?.id;
    if (id) {
      const result = await storeService.deleteStore(id);
      return result ? 1 : 0;
    }
    return 0;
  },

  async count(options = {}) {
    const result = await storeService.getAllStores({ limit: 1 });
    return result.totalItems || 0;
  },

  async bulkCreate(dataArray, options) {
    const results = [];
    for (const data of dataArray) {
      const store = await storeService.createStore(data);
      results.push(store);
    }
    return results;
  },

  async upsert(data, options) {
    const existingStore = await storeService.getStoreByCode(data.storeCode);
    if (existingStore) {
      const updated = await storeService.updateStore(existingStore.id, data);
      return updated || existingStore;
    }
    return storeService.createStore(data);
  },

  async findOrCreate(options) {
    const { where, defaults } = options;
    const existingStore = await storeService.getStoreByCode(where.storeCode);
    if (existingStore) {
      return [existingStore, false];
    }
    const newStore = await storeService.createStore({ ...where, ...defaults });
    return [newStore, true];
  },

  getModel() {
    return {
      sync: async () => {
        await storeService.init();
        return true;
      },
    };
  },
};

export default StoreWrapper;
