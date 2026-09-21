import api from './api';

class StoreService {
  /**
   * Get all stores with pagination
   * @param {Object} options - Query options (page, limit, search, region, city, status)
   * @returns {Promise} Promise with paginated stores data
   */
  getAllStores(options = {}) {
    const { page = 1, limit = 10, search = '', region = '', city = '', status = '' } = options;
    let url = `/stores?page=${page}&limit=${limit}`;
    
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (region) url += `&region=${encodeURIComponent(region)}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    
    return api.get(url);
  }

  /**
   * Get stores by branch with pagination
   * @param {string} branchCode - Branch code
   * @param {Object} options - Query options (page, limit, search, onlyInduk, status)
   * @returns {Promise} Promise with paginated stores data for the branch
   */
  getStoresByBranch(branchCode, options = {}) {
    const { page = 1, limit = 10, search = '', onlyInduk = true, status = '' } = options;
    let url = `/stores/branch/${branchCode}?page=${page}&limit=${limit}`;
    
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (onlyInduk === false) url += `&onlyInduk=false`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    
    return api.get(url);
  }

  /**
   * Get store by ID
   * @param {number} id - Store ID
   * @returns {Promise} Promise with store data
   */
  getStoreById(id) {
    return api.get(`/stores/${id}`);
  }

  /**
   * Create a new store
   * @param {Object} storeData - Store data
   * @returns {Promise} Promise with created store data
   */
  createStore(storeData) {
    return api.post('/stores', storeData);
  }

  /**
   * Update store data
   * @param {number} id - Store ID
   * @param {Object} storeData - Updated store data
   * @returns {Promise} Promise with updated store data
   */
  updateStore(id, storeData) {
    return api.put(`/stores/${id}`, storeData);
  }

  /**
   * Delete a store
   * @param {number} id - Store ID
   * @returns {Promise} Promise with success message
   */
  deleteStore(id) {
    return api.delete(`/stores/${id}`);
  }

  /**
   * Upload TOKOMAIN.ini snapshot (kode toko + IP untuk INDUK/STB)
   * @param {File} file - TOKOMAIN.ini file
   * @param {Object} meta - { deviceId, sourcePath }
   */
  async uploadTokomain(file, meta = {}) {
    const formData = new FormData();
    formData.append("file", file);
    if (meta.deviceId) formData.append("deviceId", meta.deviceId);
    if (meta.sourcePath) formData.append("sourcePath", meta.sourcePath);

    const response = await api.post("/stores/upload-tokomain", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  /**
   * Get master store sync status (TOKOMAIN snapshot + last sync info)
   */
  async getSyncStatus() {
    const response = await api.get("/stores/sync-status");
    return response.data;
  }

  /**
   * Upload master-tokomain.csv snapshot (INDUK + STB)
   * @param {File} file - master-tokomain.csv file
   */
  async uploadMasterCsv(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/stores/upload-master-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  /**
   * Execute master store sync from uploaded master-tokomain.csv
   * @param {boolean} force - Skip 24-hour confirmation guard
   */
  async syncMasterCsv(force = false) {
    const response = await api.post("/stores/sync-master-csv", { force });
    return response.data;
  }
}

export default new StoreService();