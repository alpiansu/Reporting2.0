import MCabangService from "../modules/m_cabang/m_cabang.service.js";

const mCabangService = new MCabangService();

const MCabangWrapper = {
  async findAll(options = {}) {
    return mCabangService.getAllCabang();
  },

  async findOne(options = {}) {
    const { where = {} } = options;
    if (where.kdcab) {
      return mCabangService.getCabangByCode(where.kdcab);
    }
    const cabangList = await mCabangService.getAllCabang();
    return cabangList[0] || null;
  },

  async findByPk(kdcab) {
    return mCabangService.getCabangByCode(kdcab);
  },

  async create(data, options) {
    return mCabangService.createCabang(data);
  },

  async update(data, options) {
    const kdcab = options?.where?.kdcab || data?.kdcab;
    if (kdcab) {
      const cabang = await mCabangService.updateCabang(kdcab, data);
      return cabang ? [1] : [0];
    }
    return [0];
  },

  async destroy(options) {
    const kdcab = options?.where?.kdcab;
    if (kdcab) {
      const result = await mCabangService.deleteCabang(kdcab);
      return result ? 1 : 0;
    }
    return 0;
  },

  async count(options = {}) {
    const cabangList = await mCabangService.getAllCabang();
    return cabangList.length;
  },

  async bulkCreate(dataArray, options) {
    const results = [];
    for (const data of dataArray) {
      const cabang = await mCabangService.createCabang(data);
      results.push(cabang);
    }
    return results;
  },

  async upsert(data, options) {
    const existingCabang = await mCabangService.getCabangByCode(data.kdcab);
    if (existingCabang) {
      const updated = await mCabangService.updateCabang(data.kdcab, data);
      return updated || existingCabang;
    }
    return mCabangService.createCabang(data);
  },

  async findOrCreate(options) {
    const { where, defaults } = options;
    const existingCabang = await mCabangService.getCabangByCode(where.kdcab);
    if (existingCabang) {
      return [existingCabang, false];
    }
    const newCabang = await mCabangService.createCabang({ ...where, ...defaults });
    return [newCabang, true];
  },

  async findAndCountAll(options = {}) {
    const cabangList = await mCabangService.getAllCabang();
    return { count: cabangList.length, rows: cabangList };
  },

  getModel() {
    return {
      sync: async () => {
        await mCabangService.init();
        return true;
      },
    };
  },
};

export default MCabangWrapper;
