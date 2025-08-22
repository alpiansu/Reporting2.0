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
}

export default new StoreService();