import api from "./api";

class PenyesuaianService {
  fixedPattern = "penyesuaian";

  /**
   * Get all data without pagination
   * @param {string} cabang - Branch code (can be empty for all branches)
   * @param {string} periode - Period in YYMM format
   */
  async getData(cabang, periode) {
    const params = { cabang: cabang || "All", periode };
    const response = await api.get(`/${this.fixedPattern}/getData`, { params });
    return response.data.data;
  }

  /**
   * Get records with pagination
   */
  async getRecords(cabang, periode, options = {}) {
    const params = {
      cabang: cabang || "All",
      periode,
      page: options.page || 1,
      limit: options.limit || 10,
      ...(options.kdtk && { kdtk: options.kdtk }),
      ...(options.sortColumn && {
        sortColumn: options.sortColumn,
        sortOrder: options.sortOrder || "DESC",
      }),
      ...(options.searchQuery && { searchQuery: options.searchQuery }),
    };
    const response = await api.get(`/${this.fixedPattern}`, { params });
    return response.data;
  }

  /**
   * Get resume nilai per KDTK (shop) dengan pagination
   * @param {string} cabang - Branch code (optional, default = "All")
   * @param {string} periode - Period in YYMM format (required)
   * @param {object} options - Additional options (page, limit, sortColumn, sortOrder, searchQuery)
   * @returns {Promise<Object>} - Paginated resume data
   */
  async resumePerShop(cabang, periode, options = {}) {
    const params = {
      cabang: cabang || "All",
      periode,
      page: options.page || 1,
      limit: options.limit || 10,
    };

    if (options.sortColumn) {
      params.sortColumn = options.sortColumn;
      params.sortOrder = options.sortOrder || "ASC";
    }

    if (options.searchQuery) {
      params.searchQuery = options.searchQuery;
    }

    const response = await api.get(`/${this.fixedPattern}/resumePerShop`, { params });
    return response.data;
  }

  /**
   * Get summary statistics
   */
  async getSummary(cabang, periode) {
    const response = await api.get(`/${this.fixedPattern}/summary`, {
      params: { cabang: cabang || "All", periode },
    });
    return response.data;
  }

  /**
   * Start screening/reconciliation process
   */
  async startScreening(data) {
    const params = { cabang: data.cab || "All", periode: data.periode };
    if (data.kdtk) {
      params.kdtk = data.kdtk;
      delete params.cabang;
    }
    const response = await api.get(`/${this.fixedPattern}/screening`, { params });
    return response.data;
  }

  /**
   * Refresh single store
   */
  async refreshStore(kdtk, periode) {
    const response = await api.get(`/${this.fixedPattern}/screening`, {
      params: { kdtk, periode },
    });
    return response.data;
  }

  /**
   * Get single record detail
   */
  async getRecord(cabang, kdtk, periode, prdcd) {
    const response = await api.get(`/${this.fixedPattern}/${cabang}/${kdtk}/${periode}/${prdcd}`);
    return response.data;
  }

  /**
   * Get records for a specific store
   */
  async getStoreRecords(kdtk, periode, options = {}) {
    const params = {
      kdtk,
      periode,
      page: options.page || 1,
      limit: options.limit || 100,
      ...(options.sortColumn && {
        sortColumn: options.sortColumn,
        sortOrder: options.sortOrder || "DESC",
      }),
      ...(options.searchQuery && { searchQuery: options.searchQuery }),
    };
    const response = await api.get(`/${this.fixedPattern}`, { params });
    return response.data;
  }

  /**
   * Get top discrepancies
   */
  async getTopDiscrepancies(cabang, periode, limit = 20, order = "DESC") {
    const params = {
      cabang: cabang || "All",
      periode,
      sortColumn: "SESUAI",
      sortOrder: order,
      limit,
      page: 1,
    };
    const response = await api.get(`/${this.fixedPattern}`, { params });
    return response.data;
  }

  /**
   * Search records by query
   */
  async searchRecords(cabang, periode, searchQuery, options = {}) {
    const params = {
      cabang: cabang || "All",
      periode,
      searchQuery,
      page: options.page || 1,
      limit: options.limit || 10,
    };
    const response = await api.get(`/${this.fixedPattern}`, { params });
    return response.data;
  }

  /**
   * Update or create note for a specific record
   */
  async updateNote(data) {
    const response = await api.put(`/${this.fixedPattern}/note/`, data);
    return response.data;
  }

  /**
   * after update notes, get single row to update direct to variabel
   */
  async getSingleResumeKdtk(periode, kdtk) {
    const response = await api.get(`${this.fixedPattern}/singleResumeShop`, {
      params: { periode, kdtk },
    });
    return response;
  }
}

export default new PenyesuaianService();
