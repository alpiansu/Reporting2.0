/**
 * Service for interacting with rekap_remote API
 */
import api from "./api";

class RekapRemoteService {
  /**
   * Get all rekap data with filters
   * @param {Object} params - Query parameters for filtering
   * @param {string} params.cab - Branch code filter
   * @param {string} params.kdtk - Store code filter
   * @param {string} params.module_name - Module name filter
   * @param {number} params.limit - Limit number of records
   * @param {number} params.offset - Offset for pagination
   * @returns {Promise<Object>} Promise object with rekap data
   */
  async getAll(params = {}) {
    const response = await api.get("/rekap-remote", { params });
    return response.data;
  }

  /**
   * Get summary statistics
   * @param {string} moduleName - Module name filter (optional)
   * @returns {Promise<Object>} Promise object with summary statistics
   */
  async getSummary(moduleName = null) {
    const params = moduleName ? { module_name: moduleName } : {};
    const response = await api.get("/rekap-remote/summary", { params });
    return response.data;
  }

  /**
   * Get last mass scan information per module and cabang
   * @returns {Promise<Object>} Promise object with last mass scan data
   */
  async getLastMassScan() {
    const response = await api.get("/rekap-remote/last-mass-scan");
    return response.data;
  }

  /**
   * Get last mass scan for specific module
   * @param {string} moduleName - Module name to filter
   * @returns {Promise<Object|null>} Promise object with module scan data or null if not found
   */
  async getLastMassScanByModule(moduleName) {
    const response = await api.get("/rekap-remote/last-mass-scan");

    if (response.data.success && response.data.data) {
      const moduleData = response.data.data.find(item => item.module_name === moduleName);
      return moduleData || null;
    }

    return null;
  }

  /**
   * Manually save logs to database (for testing)
   * @param {string} moduleName - Module name (optional)
   * @returns {Promise<Object>} Promise object with save result
   */
  async saveLogsManually(moduleName = null) {
    const data = moduleName ? { module_name: moduleName } : {};
    const response = await api.post("/rekap-remote/save-logs", data);
    return response.data;
  }

  /**
   * Clear logs from memory (for testing)
   * @returns {Promise<Object>} Promise object with clear result
   */
  async clearLogs() {
    const response = await api.delete("/rekap-remote/clear-logs");
    return response.data;
  }

  /**
   * Get rekap data for specific branch
   * @param {string} cab - Branch code
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Promise object with rekap data
   */
  async getByBranch(cab, options = {}) {
    const params = {
      cab,
      ...options,
    };
    const response = await api.get("/rekap-remote", { params });
    return response.data;
  }

  /**
   * Get rekap data for specific store
   * @param {string} kdtk - Store code
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Promise object with rekap data
   */
  async getByStore(kdtk, options = {}) {
    const params = {
      kdtk,
      ...options,
    };
    const response = await api.get("/rekap-remote", { params });
    return response.data;
  }

  /**
   * Get rekap data for specific module
   * @param {string} moduleName - Module name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Promise object with rekap data
   */
  async getByModule(moduleName, options = {}) {
    const params = {
      module_name: moduleName,
      ...options,
    };
    const response = await api.get("/rekap-remote", { params });
    return response.data;
  }

  /**
   * Get rekap data for specific branch and module
   * @param {string} cab - Branch code
   * @param {string} moduleName - Module name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Promise object with rekap data
   */
  async getByBranchAndModule(cab, moduleName, options = {}) {
    const params = {
      cab,
      module_name: moduleName,
      ...options,
    };
    const response = await api.get("/rekap-remote", { params });
    return response.data;
  }
}

export default new RekapRemoteService();
