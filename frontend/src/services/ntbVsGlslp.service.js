import api from "./api";

const fixedPattern = "ntb-vs-glslp";

const service = {
  getRecords: async (cabang, periode, options = {}) => {
    const params = {
      cabang: cabang || "All",
      periode,
      page: options.page || 1,
      limit: options.limit || 10,
      recidFilter: options.recidFilter !== undefined ? options.recidFilter : "1",
      ...(options.searchQuery && { searchQuery: options.searchQuery }),
      ...(options.sortColumn && { sortColumn: options.sortColumn }),
      ...(options.sortOrder && { sortOrder: options.sortOrder }),
    };
    const response = await api.get(`/${fixedPattern}`, { params });
    return response.data;
  },

  getAllRecords: async (cabang, periode, recidFilter = "1") => {
    const params = { cabang: cabang || "All", periode, recidFilter };
    const response = await api.get(`/${fixedPattern}/all`, { params });
    return response.data;
  },

  getSummary: async (cabang, periode, recidFilter = "1") => {
    const params = { cabang: cabang || "All", periode, recidFilter };
    const response = await api.get(`/${fixedPattern}/summary`, { params });
    return response.data;
  },

  getBranches: async (periode) => {
    const params = { periode };
    const response = await api.get(`/${fixedPattern}/branches`, { params });
    return response.data;
  },

  updateRecord: async ({ kodePromo, kodeToko, kodeGudang, tglTransaksi, hasilCek, periode }) => {
    const response = await api.patch(`/${fixedPattern}/record`, {
      kodePromo, kodeToko, kodeGudang, tglTransaksi, hasilCek, periode,
    });
    return response.data;
  },
};

export default service;
