import api from "./api";
// src/pages/PrepClosing/services/prepClosingApi.js

const BASE_URL = "/prep-closing";

export const prepClosingApi = {
  // ==================== SCREENING ENDPOINTS ====================

  /**
   * Screen a single store (Level 3)
   */
  async screenStore(periode, kdtk) {
    const response = await api.get(`${BASE_URL}/screening`, {
      params: { periode, kdtk },
    });
    return response.data;
  },

  /**
   * Screen a single cabang (Level 2)
   */
  async screenCabang(periode, cabang, force = false) {
    const params = { periode, cabang };
    if (force) params.force = "true";
    const response = await api.get(`${BASE_URL}/screening`, { params });
    return response.data;
  },

  /**
   * Screen all cabang (Level 1)
   */
  async screenAllCabang(periode, force = false) {
    const params = { periode, cabang: "All" };
    if (force) params.force = "true";
    const response = await api.get(`${BASE_URL}/screening`, { params });
    return response.data;
  },

  // ==================== SUMMARY & STATISTICS ENDPOINTS ====================

  /**
   * Get summary statistics
   */
  async getSummary(periode, cabang) {
    const response = await api.get(`${BASE_URL}/summary`, {
      params: { periode, cabang: cabang || "All" },
    });
    return response.data;
  },

  /**
   * Get rules summary (21 rules)
   */
  async getRulesSummary(periode, cabang) {
    const response = await api.get(`${BASE_URL}/rules-summary`, {
      params: { periode, cabang: cabang || "All" },
    });
    return response.data;
  },

  /**
   * Get resume per shop with pagination
   */
  async getResumePerShop(params) {
    const response = await api.get(`${BASE_URL}/resumePerShop`, {
      params: {
        periode: params.periode,
        cabang: params.cabang || "All",
        page: params.page || 1,
        limit: params.limit || 10,
        sortColumn: params.sortColumn || "KDTK",
        sortOrder: params.sortOrder || "ASC",
        searchQuery: params.searchQuery || "",
        ruleKeys: Array.isArray(params.ruleKeys) ? params.ruleKeys.join(",") : params.ruleKeys || undefined,
      },
    });
    return response.data;
  },

  // ==================== DETAILS & ISSUES ENDPOINTS ====================

  /**
   * Get store details with issues
   */
  async getStoreDetails(kdtk, periode) {
    const response = await api.get(`${BASE_URL}/details`, {
      params: { kdtk, periode },
    });
    return response.data;
  },

  /**
   * Get issues grouped by category
   */
  async getIssuesByCategory(periode, cabang) {
    const response = await api.get(`${BASE_URL}/issuesByCategory`, {
      params: { periode, cabang: cabang || "All" },
    });
    return response.data;
  },

  // ==================== NOTES MANAGEMENT ENDPOINTS ====================

  /**
   * Update or create note for a store
   */
  async updateNote(data) {
    const response = await api.put(`${BASE_URL}/note`, data);
    return response.data.data;
  },

  // ==================== RULES CONFIG ENDPOINTS ====================

  /**
   * Get full rules configuration data
   */
  async getRulesConfig() {
    const response = await api.get(`${BASE_URL}/rules`);
    return response.data;
  },

  /**
   * Update full rules configuration data
   */
  async updateRulesConfig(rulesData) {
    const response = await api.put(`${BASE_URL}/rules`, rulesData);
    return response.data;
  },

  // ==================== EXPORT ENDPOINT ====================
  async getExportData(params) {
    const response = await api.get(`${BASE_URL}/export-data`, {
      params: {
        periode: params.periode,
        cabang: params.cabang || "All",
        searchQuery: params.searchQuery || "",
        ruleKeys: Array.isArray(params.ruleKeys) ? params.ruleKeys.join(",") : params.ruleKeys || undefined,
      },
    });
    return response.data;
  },

  // ==================== WRC EXTRACTOR ENDPOINTS ====================
  async getWrcSyncStatus(periode) {
    const response = await api.get(`${BASE_URL}/wrc-sync-status`, {
      params: { periode },
    });
    // response.data = { success: true, data: [...] }
    const payload = response.data;
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    return list;
  },

  async getWrcExtractRules() {
    const response = await api.get(`${BASE_URL}/wrc-extract-rules`);
    return response.data;
  },

  async updateWrcExtractRules(rulesData) {
    const response = await api.put(`${BASE_URL}/wrc-extract-rules`, rulesData);
    return response.data;
  },

  async triggerWrcExtraction(periode, cabang = "All", shops = null) {
    const response = await api.post(`${BASE_URL}/wrc-extract-trigger`, {
      periode,
      cabang,
      shops,
    });
    return response.data;
  },
};

export default prepClosingApi;
