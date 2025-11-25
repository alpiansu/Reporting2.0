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
  async screenCabang(periode, cabang) {
    const response = await api.get(`${BASE_URL}/screening`, {
      params: { periode, cabang },
    });
    return response.data;
  },

  /**
   * Screen all cabang (Level 1)
   */
  async screenAllCabang(periode) {
    const response = await api.get(`${BASE_URL}/screening`, {
      params: { periode, cabang: "All" },
    });
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
    return response.data;
  },

  // ==================== PROGRESS MONITORING ====================

  /**
   * Get progress status for screening task
   */
  async getProgress(username) {
    const response = await api.get(`/api/progress/prepClosingTask_${username}`);
    return response.data;
  },
};

export default prepClosingApi;
