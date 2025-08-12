import api from "./api";

/**
 * Service for WT Harian reconciliation
 */
export default {
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
   * @param {Object} params - Query parameters (page, limit, tipe, toko, tgl1)
   * @returns {Promise}
   */
  getResults(cab, periode) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "All";
    return api.get(`/rekon-wt-harian/${periode}/${cabParam}`);
  },

  /**
   * Get summary of reconciliation results
   * @param {String} cab - Branch code (empty string for all branches)
   * @param {String} periode - Period in YYMM format
   * @returns {Promise}
   */
  getSummary(cab, periode) {
    // Jika cab kosong, gunakan 'SEMUA' sebagai nilai default
    const cabParam = cab || "SEMUA";
    return api.get(`/rekon-wt-harian/${cabParam}/${periode}/summary`);
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
};
