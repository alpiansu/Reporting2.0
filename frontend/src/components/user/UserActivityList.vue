<template>
  <div class="user-activity-list">
    <div class="activity-filters">
      <div class="filter-group">
        <label for="activity-type">Activity Type</label>
        <select id="activity-type" v-model="selectedType" @change="applyFilters">
          <option value="">All Types</option>
          <option value="login">Login</option>
          <option value="register">Register</option>
          <option value="password">Password Change</option>
          <option value="logout">Logout</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label for="start-date">Start Date</label>
        <input 
          type="date" 
          id="start-date" 
          v-model="startDate" 
          @change="applyFilters"
        >
      </div>
      
      <div class="filter-group">
        <label for="end-date">End Date</label>
        <input 
          type="date" 
          id="end-date" 
          v-model="endDate" 
          @change="applyFilters"
        >
      </div>
      
      <button class="clear-filters-btn" @click="clearFilters">
        Clear Filters
      </button>
    </div>
    
    <div v-if="loading" class="loading-indicator">
      <div class="spinner"></div>
      <p>Loading activities...</p>
    </div>
    
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="retryFetch">Retry</button>
    </div>
    
    <div v-else-if="!hasActivities" class="empty-state">
      <p>No activities found.</p>
    </div>
    
    <div v-else class="activity-list">
      <div 
        v-for="activity in activities" 
        :key="activity.id" 
        class="activity-item"
        :class="`activity-type-${activity.type}`"
      >
        <div class="activity-icon">
          <i :class="getActivityIcon(activity.type)"></i>
        </div>
        
        <div class="activity-content">
          <div class="activity-header">
            <span class="activity-type">{{ formatActivityType(activity.type) }}</span>
            <span class="activity-time">{{ formatDate(activity.createdAt) }}</span>
          </div>
          
          <div class="activity-description">
            {{ activity.description }}
          </div>
          
          <div v-if="activity.location" class="activity-location">
            <i class="fas fa-map-marker-alt"></i>
            {{ activity.location }}
          </div>
          
          <div class="activity-details">
            <span v-if="activity.ipAddress" class="activity-ip">
              <i class="fas fa-network-wired"></i>
              {{ activity.ipAddress }}
            </span>
            
            <span v-if="activity.userAgent" class="activity-device">
              <i class="fas fa-laptop"></i>
              {{ formatUserAgent(activity.userAgent) }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="hasActivities" class="pagination">
      <button 
        class="pagination-btn" 
        :disabled="currentPage === 1" 
        @click="goToPage(currentPage - 1)"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      
      <span class="pagination-info">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      
      <button 
        class="pagination-btn" 
        :disabled="currentPage === totalPages" 
        @click="goToPage(currentPage + 1)"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
      
      <div class="items-per-page">
        <label for="items-per-page">Items per page:</label>
        <select id="items-per-page" v-model="itemsPerPage" @change="changeItemsPerPage">
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useUserActivityStore } from '../../stores/userActivity';

export default {
  name: 'UserActivityList',
  
  setup() {
    const userActivityStore = useUserActivityStore();
    
    // Local state for filters
    const selectedType = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const itemsPerPage = ref(10);
    
    // Computed properties from store
    const activities = computed(() => userActivityStore.activities);
    const loading = computed(() => userActivityStore.loading);
    const error = computed(() => userActivityStore.error);
    const hasActivities = computed(() => userActivityStore.hasActivities);
    const currentPage = computed(() => userActivityStore.currentPage);
    const totalPages = computed(() => userActivityStore.totalPages);
    
    // Fetch activities on component mount
    onMounted(() => {
      userActivityStore.fetchActivities();
    });
    
    // Methods
    const applyFilters = () => {
      const filters = {
        type: selectedType.value || null,
        startDate: startDate.value || null,
        endDate: endDate.value || null,
      };
      
      userActivityStore.setFilters(filters);
    };
    
    const clearFilters = () => {
      selectedType.value = '';
      startDate.value = '';
      endDate.value = '';
      userActivityStore.clearFilters();
    };
    
    const retryFetch = () => {
      userActivityStore.fetchActivities();
    };
    
    const goToPage = (page) => {
      userActivityStore.goToPage(page);
    };
    
    const changeItemsPerPage = () => {
      userActivityStore.setItemsPerPage(parseInt(itemsPerPage.value));
    };
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    };
    
    const formatActivityType = (type) => {
      const types = {
        login: 'Login',
        register: 'Registration',
        password: 'Password Change',
        logout: 'Logout',
      };
      
      return types[type] || type;
    };
    
    const getActivityIcon = (type) => {
      const icons = {
        login: 'fas fa-sign-in-alt',
        register: 'fas fa-user-plus',
        password: 'fas fa-key',
        logout: 'fas fa-sign-out-alt',
      };
      
      return icons[type] || 'fas fa-history';
    };
    
    const formatUserAgent = (userAgent) => {
      // Simple user agent formatting - in a real app, you might use a library
      if (!userAgent) return 'Unknown';
      
      if (userAgent.includes('Windows')) return 'Windows';
      if (userAgent.includes('Mac')) return 'Mac';
      if (userAgent.includes('iPhone')) return 'iPhone';
      if (userAgent.includes('Android')) return 'Android';
      
      return 'Other';
    };
    
    return {
      // State
      selectedType,
      startDate,
      endDate,
      itemsPerPage,
      
      // Computed
      activities,
      loading,
      error,
      hasActivities,
      currentPage,
      totalPages,
      
      // Methods
      applyFilters,
      clearFilters,
      retryFetch,
      goToPage,
      changeItemsPerPage,
      formatDate,
      formatActivityType,
      getActivityIcon,
      formatUserAgent,
    };
  },
};
</script>

<style src="./UserActivityList.style.css"></style>