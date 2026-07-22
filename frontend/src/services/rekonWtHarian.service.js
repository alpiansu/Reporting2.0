import api from "./api";

/**
 * Service for WT Harian reconciliation
 */
export default {
  /**
   * Get latest reconciliation progress
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  getLatestProgress(cab, periode) {
    const cabParam = cab || "All";
    return api.get(`/rekon-wt-harian/latest-progress/${cabParam}/${periode}`);
  },

  /**
   * Start reconciliation process
   * @param {Object} data - Contains cab and periode
   * @returns {Promise}
   */
  startReconciliation(data) {
    return api.post("/rekon-wt-harian", data);
  },

  /**
   * Get reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @param {Object} params - Query parameters (page, limit, tipe, toko, tgl1, sortColumn, sortOrder)
   * @returns {Promise}
   */
  getResults(cab, periode, params = {}) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "All";
    return api.get(`/rekon-wt-harian/${periode}/${cabParam}`, { params });
  },

  /**
   * Get summary of reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @param {Object} [options] - Additional options
   * @param {Number} [options.toleranceAmount] - Tolerance in IDR
   * @returns {Promise}
   */
  getSummary(cab, periode, options = {}) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "SEMUA";
    const params = {};
    if (options.toleranceAmount) {
      params.toleranceAmount = options.toleranceAmount;
    }
    return api.get(`/rekon-wt-harian/summary/${cabParam}/${periode}`, { params });
  },

  /**
   * Get daily shop summary - rekap data per toko per cabang
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @param {Object} params - Query parameters (page, limit, toko, tgl1, searchQuery, sortColumn, sortOrder)
   * @returns {Promise}
   */
  getDailyShopSummary(cab, periode, params = {}) {
    // Jika cab kosong, gunakan 'All' sebagai nilai default
    const cabParam = cab || "All";
    return api.get(`/rekon-wt-harian/daily-summary/${periode}/${cabParam}`, { params });
  },



  /**
   * Get detailed reconciliation results for specific shop
   * @param {String} periode - Period in YYMM format
   * @param {String} cab - Branch code
   * @param {String} toko - Shop code
   * @param {Object} params - Query parameters (page, limit, sortColumn, sortOrder)
   * @returns {Promise}
   */
  getResultDetail(periode, cab, toko, params = {}) {
    return api.get(`/rekon-wt-harian/get-result-detail/${periode}/${cab}/${toko}`, { params });
  },

  /**
   * Delete reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  deleteResults(cab, periode) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "SEMUA";
    return api.delete(`/rekon-wt-harian/${cabParam}/${periode}`);
  },

  /**
   * Refresh reconciliation data for specific shop
   * @param {String} periode - Period in YYMM format
   * @param {String} cab - Branch code
   * @param {String} toko - Shop code
   * @returns {Promise}
   */
  refreshShopReconciliation(periode, cab, toko) {
    return api.post(`/rekon-wt-harian/refresh-shop/${periode}/${cab}/${toko}`);
  },

  /**
   * Update or create note for a specific store
   * @param {Object} data - Contains cabang, toko, periode, noteText
   * @returns {Promise}
   */
  updateNote(data) {
    return api.put("/rekon-wt-harian/note", data);
  },
};
