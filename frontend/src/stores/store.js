import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storeService } from '../services';

export const useStoreStore = defineStore('store', () => {
  // State
  const stores = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const pagination = ref({
    currentPage: 1,
    totalItems: 0,
    totalPages: 1,
    itemsPerPage: 10
  });
  const initialized = ref(false);

  // Getters
  const allStores = computed(() => stores.value);
  const isInitialized = computed(() => initialized.value);
  const isLoading = computed(() => loading.value);
  const hasError = computed(() => !!error.value);
  const getPagination = computed(() => pagination.value);

  // Actions
  /**
   * Fetch stores with pagination and filters
   * @param {Object} options - Query options (page, limit, search, region, status)
   */
  const fetchStores = async (options = {}) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await storeService.getAllStores(options);
      stores.value = response.data.stores;
      pagination.value = {
        currentPage: response.data.currentPage,
        totalItems: response.data.totalItems,
        totalPages: response.data.totalPages,
        itemsPerPage: options.limit || 10
      };
      initialized.value = true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch stores';
      console.error('Error fetching stores:', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch stores by branch with pagination and filters
   * @param {string} branchCode - Branch code
   * @param {Object} options - Query options (page, limit, search, onlyInduk, status)
   */
  const fetchStoresByBranch = async (branchCode, options = {}) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await storeService.getStoresByBranch(branchCode, options);
      stores.value = response.data.stores;
      pagination.value = {
        currentPage: response.data.currentPage,
        totalItems: response.data.totalItems,
        totalPages: response.data.totalPages,
        itemsPerPage: options.limit || 10
      };
      initialized.value = true;
    } catch (err) {
      error.value = err.response?.data?.message || `Failed to fetch stores for branch ${branchCode}`;
      console.error(`Error fetching stores for branch ${branchCode}:`, err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get store by ID
   * @param {number} id - Store ID
   * @returns {Promise<Object>} Store data
   */
  const getStoreById = async (id) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await storeService.getStoreById(id);
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || `Failed to fetch store with ID ${id}`;
      console.error(`Error fetching store with ID ${id}:`, err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Create a new store
   * @param {Object} storeData - Store data
   * @returns {Promise<Object>} Created store data
   */
  const createStore = async (storeData) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await storeService.createStore(storeData);
      // Refresh the store list after creating a new store
      await fetchStores({ page: 1 });
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to create store';
      console.error('Error creating store:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Update store data
   * @param {number} id - Store ID
   * @param {Object} storeData - Updated store data
   * @returns {Promise<Object>} Updated store data
   */
  const updateStore = async (id, storeData) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await storeService.updateStore(id, storeData);
      // Refresh the store list after updating a store
      await fetchStores({ page: pagination.value.currentPage });
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || `Failed to update store with ID ${id}`;
      console.error(`Error updating store with ID ${id}:`, err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Delete a store
   * @param {number} id - Store ID
   * @returns {Promise<boolean>} Success status
   */
  const deleteStore = async (id) => {
    loading.value = true;
    error.value = null;
    
    try {
      await storeService.deleteStore(id);
      // Refresh the store list after deleting a store
      await fetchStores({ page: pagination.value.currentPage });
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || `Failed to delete store with ID ${id}`;
      console.error(`Error deleting store with ID ${id}:`, err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    // State
    stores,
    loading,
    error,
    pagination,
    initialized,
    
    // Getters
    allStores,
    isInitialized,
    isLoading,
    hasError,
    getPagination,
    
    // Actions
    fetchStores,
    fetchStoresByBranch,
    getStoreById,
    createStore,
    updateStore,
    deleteStore
  };
});