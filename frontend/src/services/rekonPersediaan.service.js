import api from "./api";

/**
 * Service for Rekon Persediaan (HPP Reconciliation)
 */
const rekonPersediaanService = {
  /**
   * Start reconciliation process
   * @param {Object} params { cabang, periode }
   */
  async startScreening(params) {
    const response = await api.get("/rekon-persediaan/screening", { params });
    return response.data;
  },

  /**
   * Get reconciliation summary stats
   * @param {Object} params { cabang, periode }
   */
  async getSummary(params) {
    const response = await api.get("/rekon-persediaan/summary", { params });
    return response.data;
  },

  /**
   * Get paginated reconciliation records
   * @param {Object} params { page, limit, cabang, periode, searchQuery, sortColumn, sortOrder }
   */
  async getAllRecords(params) {
    const response = await api.get("/rekon-persediaan/records", { params });
    return response.data;
  },
};

export default rekonPersediaanService;
