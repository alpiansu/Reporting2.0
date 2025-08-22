<template>
  <div class="store-list">
    <div class="page-header">
      <h1 class="page-title">Stores</h1>
      <button class="add-button" @click="openAddStoreDialog">
        <i class="pi pi-plus"></i>
        Add Store
      </button>
    </div>
    
    <div class="search-filter-container">
      <div class="search-box">
        <i class="pi pi-search"></i>
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search stores..."
          @input="handleSearch"
        />
        <button v-if="searchQuery" class="clear-search" @click="clearSearch">
          <i class="pi pi-times"></i>
        </button>
      </div>
      
      <div class="filter-box">
        <button class="filter-button" @click="toggleFilterMenu">
          <i class="pi pi-filter"></i>
          Filter
          <i class="pi pi-chevron-down"></i>
        </button>
        
        <!-- Filter dropdown menu -->
        <div v-if="showFilterMenu" class="filter-menu">
          <div class="filter-group">
            <h3 class="filter-title">Region</h3>
            <div class="filter-options">
              <label v-for="region in regions" :key="region.id" class="filter-option">
                <input 
                  type="checkbox" 
                  :value="region.id" 
                  v-model="selectedRegions"
                  @change="applyFilters"
                />
                <span>{{ region.name }}</span>
              </label>
            </div>
          </div>
          
          <div class="filter-group">
            <h3 class="filter-title">City</h3>
            <div class="filter-options">
              <label v-for="city in cities" :key="city.id" class="filter-option">
                <input 
                  type="checkbox" 
                  :value="city.id" 
                  v-model="selectedCities"
                  @change="applyFilters"
                />
                <span>{{ city.name }}</span>
              </label>
            </div>
          </div>
          
          <div class="filter-group">
            <h3 class="filter-title">Status</h3>
            <div class="filter-options">
              <label v-for="status in statuses" :key="status.id" class="filter-option">
                <input 
                  type="checkbox" 
                  :value="status.id" 
                  v-model="selectedStatuses"
                  @change="applyFilters"
                />
                <span>{{ status.name }}</span>
              </label>
            </div>
          </div>
          
          <div class="filter-actions">
            <button class="clear-filters" @click="clearFilters">Clear All</button>
            <button class="apply-filters" @click="applyFilters">Apply</button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="store-grid" v-if="!loading && filteredStores.length > 0">
      <div 
        v-for="store in filteredStores" 
        :key="store.id" 
        class="store-card"
        @click="navigateToStoreDetails(store.id)"
      >
        <div class="store-header">
          <h2 class="store-name">{{ store.storeName }}</h2>
          <span class="store-status" :class="getStatusClass(store.isActive ? 'Active' : 'Inactive')">{{ store.isActive ? 'Active' : 'Inactive' }}</span>
        </div>
        <div class="store-info">
          <div class="info-item">
            <i class="pi pi-tag"></i>
            <span>{{ store.storeCode }}</span>
          </div>
          <div class="info-item" v-if="store.address">
            <i class="pi pi-map-marker"></i>
            <span>{{ store.address }}</span>
          </div>
          <div class="info-item" v-if="store.region">
            <i class="pi pi-globe"></i>
            <span>{{ store.region }}</span>
          </div>
          <div class="info-item" v-if="store.phone">
            <i class="pi pi-phone"></i>
            <span>{{ store.phone }}</span>
          </div>
        </div>
        <div class="store-footer">
          <div class="screening-info">
            <span class="screening-label">Last Updated:</span>
            <span class="screening-value">{{ formatDate(store.updatedAt) }}</span>
          </div>
          <button class="view-button">
            <i class="pi pi-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
    
    <div v-else-if="loading" class="loading-container">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Loading stores...</p>
    </div>
    
    <div v-else class="empty-container">
      <i class="pi pi-shopping-bag"></i>
      <h2>No stores found</h2>
      <p>{{ searchQuery ? 'Try a different search term or clear filters' : 'Add a store to get started' }}</p>
      <button class="add-button" @click="openAddStoreDialog">
        <i class="pi pi-plus"></i>
        Add Store
      </button>
    </div>
    
    <!-- Pagination controls -->
    <div v-if="stores.length > 0 && pagination" class="pagination-container">
      <div class="pagination-info">
        Showing {{ (pagination.currentPage - 1) * pagination.pageSize + 1 }} to 
        {{ Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems) }} 
        of {{ pagination.totalItems }} stores
      </div>
      <div class="pagination-controls">
        <button 
          class="pagination-button" 
          :disabled="pagination.currentPage === 1" 
          @click="handlePageChange(pagination.currentPage - 1)"
        >
          <i class="pi pi-chevron-left"></i>
        </button>
        
        <span class="pagination-pages">
          Page {{ pagination.currentPage }} of {{ pagination.totalPages }}
        </span>
        
        <button 
          class="pagination-button" 
          :disabled="pagination.currentPage === pagination.totalPages" 
          @click="handlePageChange(pagination.currentPage + 1)"
        >
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>
    </div>
    
    <!-- Add Store Dialog (would use a modal component in a real app) -->
    <div v-if="showAddStoreDialog" class="dialog-overlay" @click="closeAddStoreDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>Add New Store</h2>
          <button class="close-button" @click="closeAddStoreDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="handleAddStore" class="store-form">
            <div class="form-group">
              <label for="storeName">Store Name</label>
              <input id="storeName" v-model="newStore.storeName" type="text" placeholder="Enter store name" required />
            </div>
            
            <div class="form-group">
              <label for="storeAddress">Address</label>
              <input id="storeAddress" v-model="newStore.address" type="text" placeholder="Enter store address" required />
            </div>
            
            <div class="form-group">
              <label for="storeRegion">Region</label>
              <select id="storeRegion" v-model="newStore.region" required>
                <option value="" disabled>Select a region</option>
                <option v-for="region in regions" :key="region.id" :value="region.id">{{ region.name }}</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="storePhone">Phone Number</label>
              <input id="storePhone" v-model="newStore.phone" type="tel" placeholder="Enter phone number" required />
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" @click="closeAddStoreDialog">Cancel</button>
              <button type="submit" class="submit-button" :disabled="addStoreLoading">
                <span v-if="!addStoreLoading">Add Store</span>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStoreStore } from '../../stores';
import { useToastService } from '../../utils/toast';

const router = useRouter();
const storeStore = useStoreStore();
const toast = useToastService();

// State
const searchQuery = ref('');
const showFilterMenu = ref(false);
const selectedRegions = ref([]);
const selectedCities = ref([]);
const selectedStatuses = ref([]);
const showAddStoreDialog = ref(false);
const addStoreLoading = ref(false);
const newStore = ref({
  storeName: '',
  address: '',
  region: '',
  phone: ''
});

// Get data from store
const stores = computed(() => storeStore.allStores);
const loading = computed(() => storeStore.isLoading);
const error = computed(() => storeStore.error);
const pagination = computed(() => storeStore.getPagination);

// Mock data for regions until we have a proper region service
const regions = ref([
  { id: 'North', name: 'North' },
  { id: 'South', name: 'South' },
  { id: 'East', name: 'East' },
  { id: 'West', name: 'West' },
  { id: 'Central', name: 'Central' }
]);

// Mock data for cities until we have a proper city service
const cities = ref([
  { id: 'Jakarta', name: 'Jakarta' },
  { id: 'Surabaya', name: 'Surabaya' },
  { id: 'Bandung', name: 'Bandung' },
  { id: 'Medan', name: 'Medan' },
  { id: 'Makassar', name: 'Makassar' }
]);

const statuses = ref([
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'pending', name: 'Pending' }
]);

// Fetch stores
onMounted(async () => {
  try {
    // Fetch stores from the API using the store
    await storeStore.fetchStores({
      page: 1,
      limit: 10
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    toast.showError('Error', 'Failed to load stores');
  }
});

// Watch for search and filter changes to update the store list
watch([searchQuery, selectedRegions, selectedCities, selectedStatuses], () => {
  // Debounce the search to avoid too many API calls
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    applyFilters();
  }, 300);
}, { deep: true });

// Search timeout for debouncing
let searchTimeout = null;

// Computed properties
const filteredStores = computed(() => {
  return stores.value;
});

// Methods
const handleSearch = () => {
  // Debouncing is handled by the watch
  console.log('Searching for:', searchQuery.value);
};

const clearSearch = () => {
  searchQuery.value = '';
  applyFilters();
};

const toggleFilterMenu = () => {
  showFilterMenu.value = !showFilterMenu.value;
};

const applyFilters = async () => {
  try {
    // Build filter options
    const options = {
      page: 1,
      limit: 10,
      search: searchQuery.value || ''
    };
    
    // Add region filter if selected
    if (selectedRegions.value.length > 0) {
      options.region = selectedRegions.value.join(',');
    }
    
    // Add city filter if selected
    if (selectedCities.value.length > 0) {
      options.city = selectedCities.value.join(',');
    }
    
    // Add status filter if selected
    if (selectedStatuses.value.length > 0) {
      options.status = selectedStatuses.value.join(',');
    }
    
    // Fetch filtered stores
    await storeStore.fetchStores(options);
    showFilterMenu.value = false;
  } catch (error) {
    console.error('Error applying filters:', error);
    toast.showError('Error', 'Failed to apply filters');
  }
};

const clearFilters = () => {
  selectedRegions.value = [];
  selectedCities.value = [];
  selectedStatuses.value = [];
  searchQuery.value = '';
  applyFilters();
};

const getStatusClass = (status) => {
  if (!status) return '';
  
  switch (status.toLowerCase()) {
    case 'active':
      return 'status-active';
    case 'inactive':
      return 'status-inactive';
    case 'pending':
      return 'status-pending';
    default:
      return '';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const navigateToStoreDetails = (storeId) => {
  router.push(`/stores/${storeId}`);
};

const openAddStoreDialog = () => {
  showAddStoreDialog.value = true;
};

const closeAddStoreDialog = () => {
  showAddStoreDialog.value = false;
  // Reset form
  newStore.value = {
    storeName: '',
    address: '',
    region: '',
    phone: ''
  };
};

const handleAddStore = async () => {
  addStoreLoading.value = true;
  
  try {
    // Create store data object
    const storeData = {
      storeCode: `ST${Date.now().toString().slice(-6)}`, // Generate a unique store code
      storeName: newStore.value.storeName,
      address: newStore.value.address,
      region: newStore.value.region,
      phone: newStore.value.phone,
      isActive: true,
      notes: 'INDUK' // Set as main store
    };
    
    // Call the store service to create the store
    await storeStore.createStore(storeData);
    
    // Show success message using toast service
    toast.showSuccess('Success', 'Store created successfully');
    
    // Close the dialog
    closeAddStoreDialog();
  } catch (error) {
    console.error('Error adding store:', error);
    toast.showError('Error', 'Failed to create store');
  } finally {
    addStoreLoading.value = false;
  }
};

// Handle pagination page change
const handlePageChange = async (page) => {
  try {
    // Build filter options with current search and filters
    const options = {
      page,
      limit: 10,
      search: searchQuery.value || ''
    };
    
    // Add region filter if selected
    if (selectedRegions.value.length > 0) {
      options.region = selectedRegions.value.join(',');
    }
    
    // Add status filter if selected
    if (selectedStatuses.value.length > 0) {
      options.status = selectedStatuses.value.join(',');
    }
    
    // Fetch stores for the selected page
    await storeStore.fetchStores(options);
  } catch (error) {
    console.error('Error changing page:', error);
    toast.showError('Error', 'Failed to load page');
  }
};
</script>

<style scoped>
.store-list {
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
}

.add-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-button:hover {
  background-color: var(--primary-color-darken);
}

.search-filter-container {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-box i {
  position: absolute;
  left: 12px;
  color: var(--text-color-secondary);
}

.search-box input {
  width: 100%;
  padding: 10px 40px 10px 36px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.search-box input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.clear-search {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
}

.filter-box {
  position: relative;
}

.filter-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
}

.filter-button:hover {
  border-color: var(--primary-color);
}

.filter-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 240px;
  z-index: 10;
}

.filter-group {
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.filter-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-color);
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  padding: 16px;
}

.clear-filters {
  background: none;
  border: none;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}

.apply-filters {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.store-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.store-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.store-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.store-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.store-status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-active {
  background-color: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.status-inactive {
  background-color: rgba(108, 117, 125, 0.1);
  color: #6c757d;
}

.status-pending {
  background-color: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.store-info {
  padding: 16px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item i {
  color: var(--text-color-secondary);
  margin-top: 3px;
}

.store-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.screening-info {
  display: flex;
  flex-direction: column;
}

.screening-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.screening-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.view-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(var(--primary-color-rgb), 0.1);
  color: var(--primary-color);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.view-button:hover {
  background-color: rgba(var(--primary-color-rgb), 0.2);
}

.loading-container, .empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  text-align: center;
}

.loading-container i, .empty-container i {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-container h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.empty-container p {
  color: var(--text-color-secondary);
  margin-bottom: 24px;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background-color: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dialog-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dialog-body {
  padding: 16px;
}

.store-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Pagination styles */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding: 16px;
  background-color: var(--surface-card, #ffffff);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--text-color-secondary, #6c757d);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--surface-border, #dee2e6);
  border-radius: 4px;
  background-color: var(--surface-card, #ffffff);
  color: var(--text-color, #495057);
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-button:hover:not(:disabled) {
  background-color: var(--surface-hover, #f8f9fa);
  border-color: var(--primary-color-lighter, #a7d8ff);
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-pages {
  font-size: 0.875rem;
  color: var(--text-color, #495057);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.form-group input, .form-group select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-group input:focus, .form-group select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.cancel-button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cancel-button:hover {
  border-color: var(--text-color);
}

.submit-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

.submit-button:hover {
  background-color: var(--primary-color-darken);
}

.submit-button:disabled {
  background-color: var(--primary-color-lighten);
  cursor: not-allowed;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .search-filter-container {
    flex-direction: column;
  }
  
  .filter-menu {
    width: 100%;
    right: 0;
  }
}

@media (max-width: 480px) {
  .store-grid {
    grid-template-columns: 1fr;
  }
  
  .dialog-content {
    width: 90%;
  }
}
</style>