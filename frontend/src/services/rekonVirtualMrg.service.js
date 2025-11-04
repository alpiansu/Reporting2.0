import api from "./api";

// fixed pattern endpoint module rekon virtual mrg
const fixedPattern = "rekon-virtual-mrg";

/**
 * Service for Rekon Virtual Margin Based operations
 */
const rekonVirtualMrgService = {
  getData: async (cabang, periode) => {
    const params = {
      cabang: cabang || "All",
      periode,
    };

    const response = await api.get(`/${fixedPattern}/getData`, { params });
    return response.data.data;
  },
  /**
   * Get daily shop summary with pagination
   * @param {string} cabang - Branch code (can be empty for all branches)
   * @param {string} periode - Period in YYMM format
   * @param {object} options - Additional options (page, limit, sortColumn, sortOrder)
   * @returns {Promise} - Response with shop summary data
   */
  getDailyShopSummary: async (cabang, periode, options = {}) => {
    const params = {
      cabang: cabang || "All",
      periode,
      page: options.page || 1,
      limit: options.limit || 10,
    };

    if (options.sortColumn) {
      params.sortColumn = options.sortColumn;
      params.sortOrder = options.sortOrder || "asc";
    }

    if (options.searchQuery) {
      params.searchQuery = options.searchQuery;
    }

    const response = await api.get(`/${fixedPattern}`, { params });
    return response.data;
  },

  /**
   * Get summary statistics
   * @param {string} cabang - Branch code (can be empty for all branches)
   * @param {string} periode - Period in YYMM format
   * @returns {Promise} - Response with summary data
   */
  getSummary: async (cabang, periode) => {
    const response = await api.get(`/${fixedPattern}/summary`, {
      params: {
        cabang: cabang || "All",
        periode,
      },
    });
    return response.data;
  },

  /**
   * Start screening/reconciliation process
   * @param {object} data - Reconciliation parameters (cab, periode)
   * @returns {Promise} - Response with reconciliation result
   */
  startReconciliation: async data => {
    const response = await api.get(`/${fixedPattern}/screening`, {
      params: {
        cabang: data.cab || "All",
        periode: data.periode,
      },
    });
    return response.data;
  },

  /**
   * Get single record detail
   * @param {string} cabang - Branch code
   * @param {string} shop - Shop code
   * @param {string} tanggal - Date
   * @param {string} prdcd - Product code
   * @returns {Promise} - Response with record detail
   */
  getRecord: async (cabang, shop, tanggal, prdcd) => {
    const response = await api.get(`/${fixedPattern}/${cabang}/${shop}/${tanggal}/${prdcd}`);
    return response.data;
  },

  /**
   * Update record
   * @param {string} cabang - Branch code
   * @param {string} shop - Shop code
   * @param {string} tanggal - Date
   * @param {string} prdcd - Product code
   * @param {object} data - Updated data
   * @returns {Promise} - Response with update result
   */
  updateRecord: async (cabang, shop, tanggal, prdcd, data) => {
    const response = await api.put(`/${fixedPattern}/${cabang}/${shop}/${tanggal}/${prdcd}`, data);
    return response.data;
  },

  /**
   * Update RECID field specifically
   * @param {string} cabang - Branch code
   * @param {string} shop - Shop code
   * @param {string} tanggal - Date
   * @param {string} prdcd - Product code
   * @param {string} recid - RECID value ('1' for adjusted, '*' for not adjusted)
   * @returns {Promise} - Response with update result
   */
  updateRecid: async (cabang, shop, tanggal, prdcd, recid) => {
    const response = await api.put(`/${fixedPattern}/recid`, { recid, cabang, shop, tanggal, prdcd });
    return response.data;
  },

  /**
   * Delete record
   * @param {string} cabang - Branch code
   * @param {string} shop - Shop code
   * @param {string} tanggal - Date
   * @param {string} prdcd - Product code
   * @returns {Promise} - Response with delete result
   */
  deleteRecord: async (cabang, shop, tanggal, prdcd) => {
    const response = await api.delete(`/${fixedPattern}/${cabang}/${shop}/${tanggal}/${prdcd}`);
    return response.data;
  },

  /**
   * Insert records from store
   * @param {object} data - Insert parameters (shop, year, month)
   * @returns {Promise} - Response with insert result
   */
  insertFromStore: async data => {
    const response = await api.post(`/${fixedPattern}/insert-from-store`, data);
    return response.data;
  },

  /**
   * Update or create note for a specific record
   * @param {string} cabang - Branch code
   * @param {string} shop - Shop code
   * @param {string} tanggal - Date
   * @param {string} prdcd - Product code
   * @param {object} data - Note data (noteText, categoryId)
   * @returns {Promise} - Response with note update result
   */
  updateNote: async (cabang, shop, tanggal, prdcd, data) => {
    const response = await api.put(`/${fixedPattern}/note/${cabang}/${shop}/${tanggal}/${prdcd}`, data);
    return response.data;
  },

  autoUpdateNote: async (cabang, shop, tanggal, prdcd) => {
    //biar kebaca di controller req.body shop, tanggal, prdcd
    const kdtk = shop;
    const parameters = { cabang, kdtk, tanggal, prdcd };
    const response = await api.post(`/notes/autonoteVirtual`, parameters);
    return response.data;
  },
};

export default rekonVirtualMrgService;
