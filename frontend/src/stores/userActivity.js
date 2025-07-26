import { defineStore } from 'pinia';
import userActivityService from '../services/userActivity.service';

/**
 * Store for managing user activity data
 */
export const useUserActivityStore = defineStore('userActivity', {
  state: () => ({
    activities: [],
    totalActivities: 0,
    loading: false,
    error: null,
    filters: {
      type: null,
      startDate: null,
      endDate: null,
    },
    pagination: {
      limit: 10,
      offset: 0,
    },
  }),

  getters: {
    /**
     * Check if there are any activities
     * @returns {boolean}
     */
    hasActivities: (state) => state.activities.length > 0,
    
    /**
     * Get the current page number
     * @returns {number}
     */
    currentPage: (state) => Math.floor(state.pagination.offset / state.pagination.limit) + 1,
    
    /**
     * Get the total number of pages
     * @returns {number}
     */
    totalPages: (state) => Math.ceil(state.totalActivities / state.pagination.limit),
  },

  actions: {
    /**
     * Fetch user activities with current pagination and filters
     */
    async fetchActivities() {
      this.loading = true;
      this.error = null;
      
      try {
        const options = {
          ...this.pagination,
          ...this.filters,
        };
        
        // Remove null or undefined values
        Object.keys(options).forEach(key => {
          if (options[key] === null || options[key] === undefined) {
            delete options[key];
          }
        });
        
        const result = await userActivityService.getUserActivities(options);
        
        this.activities = result.activities;
        this.totalActivities = result.total;
      } catch (error) {
        this.error = error.message || 'Failed to fetch user activities';
        console.error('Error fetching user activities:', error);
      } finally {
        this.loading = false;
      }
    },
    
    /**
     * Set filters and reset pagination
     * @param {Object} filters - Filter options
     */
    setFilters(filters) {
      this.filters = { ...this.filters, ...filters };
      this.pagination.offset = 0; // Reset to first page
      this.fetchActivities();
    },
    
    /**
     * Clear all filters
     */
    clearFilters() {
      this.filters = {
        type: null,
        startDate: null,
        endDate: null,
      };
      this.pagination.offset = 0; // Reset to first page
      this.fetchActivities();
    },
    
    /**
     * Go to a specific page
     * @param {number} page - Page number (1-based)
     */
    goToPage(page) {
      const offset = (page - 1) * this.pagination.limit;
      this.pagination.offset = offset;
      this.fetchActivities();
    },
    
    /**
     * Change the number of items per page
     * @param {number} limit - Number of items per page
     */
    setItemsPerPage(limit) {
      this.pagination.limit = limit;
      this.pagination.offset = 0; // Reset to first page
      this.fetchActivities();
    },
  },
});