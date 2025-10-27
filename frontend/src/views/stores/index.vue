<template>
  <div class="store-list-modern">
    <!-- Page Header -->
    <div class="page-header-modern">
      <div class="header-content-modern">
        <div class="header-title-section">
          <i class="pi pi-building header-icon-modern"></i>
          <div class="header-title-content">
            <h1 class="page-title-modern">Store Management</h1>
            <p class="page-description-modern">Manage store data and branch information</p>
          </div>
        </div>
        <div class="header-actions-modern">
          <button class="action-button-primary" @click="openAddStoreDialog">
            <i class="pi pi-plus"></i>
            <span>Add Store</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Search and Filter Section -->
    <div class="controls-section">
      <div class="search-controls">
        <div class="search-box-modern">
          <i class="pi pi-search search-icon"></i>
          <input type="text" v-model="searchQuery" placeholder="Search stores, codes, regions..." @input="handleSearch"
            class="search-input" />
          <button v-if="searchQuery" class="clear-search-btn" @click="clearSearch">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="filter-section">
          <button class="filter-button-modern" @click="toggleFilterMenu">
            <i class="pi pi-filter"></i>
            <span>Filters</span>
            <i class="pi pi-chevron-down" :class="{ 'rotated': showFilterMenu }"></i>
          </button>

          <!-- Modern Filter Panel -->
          <div v-if="showFilterMenu" class="filter-panel-modern">
            <div class="filter-content">
              <div class="filter-group-modern">
                <h4 class="filter-title-modern">Region</h4>
                <div class="filter-options-modern">
                  <label v-for="region in regions" :key="region.id" class="filter-option-modern">
                    <input type="checkbox" :value="region.id" v-model="selectedRegions" @change="applyFilters" />
                    <span class="checkmark"></span>
                    <span>{{ region.name }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-group-modern">
                <h4 class="filter-title-modern">City</h4>
                <div class="filter-options-modern">
                  <label v-for="city in cities" :key="city.id" class="filter-option-modern">
                    <input type="checkbox" :value="city.id" v-model="selectedCities" @change="applyFilters" />
                    <span class="checkmark"></span>
                    <span>{{ city.name }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-group-modern">
                <h4 class="filter-title-modern">Status</h4>
                <div class="filter-options-modern">
                  <label v-for="status in statuses" :key="status.id" class="filter-option-modern">
                    <input type="checkbox" :value="status.id" v-model="selectedStatuses" @change="applyFilters" />
                    <span class="checkmark"></span>
                    <span>{{ status.name }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-actions-modern">
                <button class="filter-clear-btn" @click="clearFilters">Clear All</button>
                <button class="filter-apply-btn" @click="applyFilters">Apply Filters</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Store Content -->
    <div class="store-content-modern">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state-modern">
        <div class="loading-content">
          <i class="pi pi-spin pi-spinner loading-icon"></i>
          <h3 class="loading-title">Loading Stores</h3>
          <p class="loading-text">Please wait while we fetch your store data...</p>
        </div>
      </div>

      <!-- Store Grid -->
      <div v-else-if="!loading && filteredStores.length > 0" class="store-grid-modern">
        <div v-for="store in filteredStores" :key="store.id" class="store-card-modern"
          @click="navigateToStoreDetails(store.id)">
          <div class="store-card-header">
            <div class="store-identity">
              <h3 class="store-name">{{ store.storeName }}</h3>
              <span class="store-code">{{ store.storeCode }}</span>
            </div>
            <div class="store-status">
              <span class="status-badge" :class="getStatusClass('Active')">
                {{ store.dbHost }}
              </span>
            </div>
          </div>

          <div class="store-details">
            <div class="detail-item" v-if="store.address">
              <i class="pi pi-map-marker detail-icon"></i>
              <span class="detail-text">{{ store.address }}</span>
            </div>
            <div class="detail-item" v-if="store.region">
              <i class="pi pi-globe detail-icon"></i>
              <span class="detail-text">{{ store.region }}</span>
            </div>
            <div class="detail-item" v-if="store.phone">
              <i class="pi pi-phone detail-icon"></i>
              <span class="detail-text">{{ store.phone }}</span>
            </div>
          </div>

          <div class="store-footer">
            <div class="update-info">
              <i class="pi pi-clock update-icon"></i>
              <span class="update-text">Updated {{ formatDate(store.updatedAt) }}</span>
            </div>
            <div class="store-actions">
              <button class="action-btn view-btn">
                <i class="pi pi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state-modern">
        <div class="empty-content">
          <i class="pi pi-inbox empty-icon"></i>
          <h3 class="empty-title">{{ searchQuery ? 'No Stores Found' : 'No Stores Available' }}</h3>
          <p class="empty-text">
            {{ searchQuery ? 'Try adjusting your search terms or filters' : 'Get started by adding your first store' }}
          </p>
          <button class="action-button-primary" @click="openAddStoreDialog">
            <i class="pi pi-plus"></i>
            <span>Add Store</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modern Pagination -->
    <div v-if="stores.length > 0 && pagination" class="pagination-modern">
      <div class="pagination-info-modern">
        <span>Showing {{ startItem }} to {{ endItem }}
          of {{ pagination.totalItems }} stores</span>
      </div>
      <div class="pagination-controls-modern">
        <button class="pagination-btn pagination-btn-prev" :disabled="pagination.currentPage === 1"
          @click="handlePageChange(pagination.currentPage - 1)">
          <i class="pi pi-chevron-left"></i>
          <span>Previous</span>
        </button>

        <div class="pagination-numbers">
          <span class="page-info">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
        </div>

        <button class="pagination-btn pagination-btn-next" :disabled="pagination.currentPage === pagination.totalPages"
          @click="handlePageChange(pagination.currentPage + 1)">
          <span>Next</span>
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- Modern Add Store Dialog -->
    <div v-if="showAddStoreDialog" class="dialog-overlay-modern" @click="closeAddStoreDialog">
      <div class="dialog-content-modern" @click.stop>
        <div class="dialog-header-modern">
          <div class="dialog-title-section">
            <i class="pi pi-plus dialog-icon"></i>
            <h2 class="dialog-title">Add New Store</h2>
          </div>
          <button class="dialog-close-btn" @click="closeAddStoreDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="dialog-body-modern">
          <form @submit.prevent="handleAddStore" class="store-form-modern">
            <div class="form-grid">
              <div class="form-group-modern">
                <label for="storeName" class="form-label">Store Name</label>
                <input id="storeName" v-model="newStore.storeName" type="text" placeholder="Enter store name" required
                  class="form-input" />
              </div>

              <div class="form-group-modern">
                <label for="storeRegion" class="form-label">Region</label>
                <select id="storeRegion" v-model="newStore.region" required class="form-select">
                  <option value="" disabled>Select a region</option>
                  <option v-for="region in regions" :key="region.id" :value="region.id">{{ region.name }}</option>
                </select>
              </div>

              <div class="form-group-modern full-width">
                <label for="storeAddress" class="form-label">Address</label>
                <input id="storeAddress" v-model="newStore.address" type="text" placeholder="Enter store address"
                  required class="form-input" />
              </div>

              <div class="form-group-modern">
                <label for="storePhone" class="form-label">Phone Number</label>
                <input id="storePhone" v-model="newStore.phone" type="tel" placeholder="Enter phone number" required
                  class="form-input" />
              </div>
            </div>

            <div class="form-actions-modern">
              <button type="button" class="btn-secondary" @click="closeAddStoreDialog">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="addStoreLoading">
                <span v-if="!addStoreLoading">Add Store</span>
                <div v-else class="loading-spinner">
                  <i class="pi pi-spin pi-spinner"></i>
                  <span>Adding...</span>
                </div>
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
const pagination = computed(() => storeStore.getPagination);
const startItem = computed(() => storeStore.getPagination.startItem);
const endItem = computed(() => storeStore.getPagination.endItem);


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
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  return new Date(dateString).toLocaleString(undefined, options);
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
/* Modern Store List Styles */
.store-list-modern {
  padding: 2rem;
  background: #f8fafc;
  min-height: calc(100vh - 60px);
}

/* Page Header */
.page-header-modern {
  margin-bottom: 2rem;
}

.header-content-modern {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.header-title-section {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-icon-modern {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #38bdf8);
  color: white;
  border-radius: 16px;
  font-size: 2rem;
  box-shadow: 0 8px 16px rgba(14, 165, 233, 0.3);
}

.header-title-content h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  line-height: 1.1;
}

.header-title-content p {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.header-actions-modern {
  display: flex;
  gap: 1rem;
}

.action-button-primary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #0284c7);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.action-button-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.4);
}

/* Controls Section */
.controls-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-box-modern {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 1.125rem;
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 3rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 1rem;
  background: white;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color, #0ea5e9);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.clear-search-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: #f1f5f9;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: #e2e8f0;
  color: #374151;
}

.filter-section {
  position: relative;
}

.filter-button-modern {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #d1d5db;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-button-modern:hover {
  border-color: var(--primary-color, #0ea5e9);
  background: #f8fafc;
}

.filter-button-modern .pi-chevron-down {
  transition: transform 0.2s ease;
}

.filter-button-modern .pi-chevron-down.rotated {
  transform: rotate(180deg);
}

/* Filter Panel */
.filter-panel-modern {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 320px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.filter-content {
  padding: 1.5rem;
}

.filter-group-modern {
  margin-bottom: 1.5rem;
}

.filter-group-modern:last-of-type {
  margin-bottom: 0;
}

.filter-title-modern {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.filter-options-modern {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-option-modern {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background 0.2s ease;
  position: relative;
}

.filter-option-modern:hover {
  background: #f8fafc;
}

.filter-option-modern input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  position: relative;
  transition: all 0.2s ease;
}

.filter-option-modern input[type="checkbox"]:checked + .checkmark {
  background: var(--primary-color, #0ea5e9);
  border-color: var(--primary-color, #0ea5e9);
}

.filter-option-modern input[type="checkbox"]:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.filter-actions-modern {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #f1f5f9;
}

.filter-clear-btn, .filter-apply-btn {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-clear-btn {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.filter-clear-btn:hover {
  background: #f9fafb;
}

.filter-apply-btn {
  background: var(--primary-color, #0ea5e9);
  border: 1px solid var(--primary-color, #0ea5e9);
  color: white;
}

.filter-apply-btn:hover {
  background: #0284c7;
}

/* Store Content */
.store-content-modern {
  margin-bottom: 2rem;
}

/* Loading State */
.loading-state-modern {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.loading-content {
  text-align: center;
  max-width: 400px;
}

.loading-icon {
  font-size: 3rem;
  color: var(--primary-color, #0ea5e9);
  margin-bottom: 1rem;
}

.loading-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.loading-text {
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

/* Store Grid */
.store-grid-modern {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.store-card-modern {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.store-card-modern:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color, #0ea5e9);
}

.store-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid #f1f5f9;
}

.store-identity h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  line-height: 1.2;
}

.store-code {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.store-status {
  display: flex;
  align-items: center;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.status-badge.status-active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-badge.status-inactive {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.store-details {
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail-icon {
  width: 16px;
  color: #64748b;
  flex-shrink: 0;
}

.detail-text {
  color: #374151;
  font-size: 0.875rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem 1.5rem;
  background: #fafbfc;
}

.update-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.update-icon {
  color: #64748b;
  font-size: 0.875rem;
}

.update-text {
  color: #64748b;
  font-size: 0.8rem;
}

.store-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  border-color: var(--primary-color, #0ea5e9);
  background: #f0f9ff;
  color: var(--primary-color, #0ea5e9);
}

/* Empty State */
.empty-state-modern {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-icon {
  font-size: 4rem;
  color: #cbd5e0;
  margin-bottom: 1.5rem;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.empty-text {
  color: #64748b;
  margin: 0 0 2rem 0;
  line-height: 1.5;
}

/* Pagination */
.pagination-modern {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 2rem;
}

.pagination-info-modern {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

.pagination-controls-modern {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pagination-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: var(--primary-color, #0ea5e9);
  color: var(--primary-color, #0ea5e9);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f3f4f6;
}

.page-info {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

/* Dialog Styles */
.dialog-overlay-modern {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.dialog-content-modern {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}

.dialog-header-modern {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
}

.dialog-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dialog-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #38bdf8);
  color: white;
  border-radius: 10px;
  font-size: 1.25rem;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.dialog-close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-close-btn:hover {
  background: #e2e8f0;
  color: #374151;
}

.dialog-body-modern {
  padding: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
}

/* Form Styles */
.store-form-modern {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group-modern {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group-modern.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.form-input, .form-select {
  padding: 0.875rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  transition: all 0.2s ease;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--primary-color, #0ea5e9);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.form-actions-modern {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-secondary, .btn-primary {
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-primary {
  background: var(--primary-color, #0ea5e9);
  border: 1px solid var(--primary-color, #0ea5e9);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0284c7;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-spinner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .store-list-modern {
    padding: 1rem;
  }
  
  .header-content-modern {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5rem;
  }
  
  .header-title-section {
    justify-content: center;
    text-align: center;
  }
  
  .search-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .search-box-modern {
    max-width: none;
  }
  
  .store-grid-modern {
    grid-template-columns: 1fr;
  }
  
  .pagination-modern {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .pagination-controls-modern {
    justify-content: center;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-actions-modern {
    flex-direction: column;
  }
}

@media (max-width: 576px) {
  .header-title-content h1 {
    font-size: 1.75rem;
  }
  
  .controls-section {
    padding: 1rem;
  }
  
  .filter-panel-modern {
    width: calc(100vw - 2rem);
    right: auto;
    left: 0;
  }
  
  .dialog-content-modern {
    margin: 0;
    border-radius: 12px;
  }
}
</style>

<style scoped>
.store-list {
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  border-radius: 16px;
  color: var(--text-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-bottom: 2rem;
  border: 1px solid rgba(79, 70, 229, 0.1);
}

.header-content h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: var(--primary-color);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.header-content p {
  font-size: 1rem;
  color: var(--text-color-secondary);
  margin: 0;
  opacity: 0.9;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--primary-color);
}

.add-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--primary-color);
  border: 2px solid rgba(79, 70, 229, 0.2);
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.1);
}

.add-button:hover {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.2);
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
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.1);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.store-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  border-color: rgba(79, 70, 229, 0.2);
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(79, 70, 229, 0.1);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: rgba(79, 70, 229, 0.05);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(79, 70, 229, 0.1);
}

.dialog-header h2 {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 0;
  color: var(--primary-color);
}

.close-button {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(79, 70, 229, 0.2);
  cursor: pointer;
  color: var(--primary-color);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.close-button:hover {
  background: var(--primary-color);
  color: white;
  transform: scale(1.1);
}

.dialog-body {
  padding: 2rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
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
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.form-group input, .form-group select {
  padding: 0.875rem 1rem;
  border: 2px solid rgba(79, 70, 229, 0.1);
  border-radius: 12px;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-group input:focus, .form-group select:focus {
  outline: none;
  border-color: var(--primary-color);
  background: white;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.15);
  transform: translateY(-1px);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.cancel-button {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(108, 117, 125, 0.2);
  border-radius: 12px;
  padding: 0.875rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.cancel-button:hover {
  border-color: #6c757d;
  background: #6c757d;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(108, 117, 125, 0.2);
}

.submit-button {
  background: var(--primary-color);
  color: white;
  border: 2px solid var(--primary-color);
  border-radius: 12px;
  padding: 0.875rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.2);
}

.submit-button:hover {
  background: var(--primary-color-darken);
  border-color: var(--primary-color-darken);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
}

.submit-button:disabled {
  background: rgba(79, 70, 229, 0.5);
  border-color: rgba(79, 70, 229, 0.5);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
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