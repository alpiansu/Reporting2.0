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
          <h2 class="store-name">{{ store.name }}</h2>
          <span class="store-status" :class="getStatusClass(store.status)">{{ store.status }}</span>
        </div>
        <div class="store-info">
          <div class="info-item">
            <i class="pi pi-map-marker"></i>
            <span>{{ store.address }}</span>
          </div>
          <div class="info-item">
            <i class="pi pi-globe"></i>
            <span>{{ store.region }}</span>
          </div>
          <div class="info-item">
            <i class="pi pi-phone"></i>
            <span>{{ store.phone }}</span>
          </div>
        </div>
        <div class="store-footer">
          <div class="screening-info">
            <span class="screening-label">Last Screening:</span>
            <span class="screening-value">{{ store.lastScreening ? formatDate(store.lastScreening) : 'Never' }}</span>
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
              <input id="storeName" v-model="newStore.name" type="text" placeholder="Enter store name" required />
            </div>
            
            <div class="form-group">
              <label for="storeAddress">Address</label>
              <input id="storeAddress" v-model="newStore.address" type="text" placeholder="Enter store address" required />
            </div>
            
            <div class="form-group">
              <label for="storeRegion">Region</label>
              <select id="storeRegion" v-model="newStore.regionId" required>
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// State
const stores = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const showFilterMenu = ref(false);
const selectedRegions = ref([]);
const selectedStatuses = ref([]);
const showAddStoreDialog = ref(false);
const addStoreLoading = ref(false);
const newStore = ref({
  name: '',
  address: '',
  regionId: '',
  phone: ''
});

// Mock data
const regions = ref([
  { id: 1, name: 'North' },
  { id: 2, name: 'South' },
  { id: 3, name: 'East' },
  { id: 4, name: 'West' },
  { id: 5, name: 'Central' }
]);

const statuses = ref([
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'pending', name: 'Pending' }
]);

// Fetch stores
onMounted(async () => {
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    stores.value = [
      {
        id: 1,
        name: 'Store Alpha',
        address: '123 Main St, City A',
        region: 'North',
        regionId: 1,
        phone: '(123) 456-7890',
        status: 'Active',
        lastScreening: '2023-11-28'
      },
      {
        id: 2,
        name: 'Store Beta',
        address: '456 Oak Ave, City B',
        region: 'South',
        regionId: 2,
        phone: '(234) 567-8901',
        status: 'Active',
        lastScreening: '2023-11-25'
      },
      {
        id: 3,
        name: 'Store Gamma',
        address: '789 Pine Rd, City C',
        region: 'East',
        regionId: 3,
        phone: '(345) 678-9012',
        status: 'Inactive',
        lastScreening: '2023-11-22'
      },
      {
        id: 4,
        name: 'Store Delta',
        address: '101 Elm Blvd, City D',
        region: 'West',
        regionId: 4,
        phone: '(456) 789-0123',
        status: 'Active',
        lastScreening: '2023-11-20'
      },
      {
        id: 5,
        name: 'Store Epsilon',
        address: '202 Cedar Ln, City E',
        region: 'Central',
        regionId: 5,
        phone: '(567) 890-1234',
        status: 'Pending',
        lastScreening: null
      }
    ];
  } catch (error) {
    console.error('Error fetching stores:', error);
  } finally {
    loading.value = false;
  }
});

// Computed properties
const filteredStores = computed(() => {
  let result = [...stores.value];
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(store => 
      store.name.toLowerCase().includes(query) ||
      store.address.toLowerCase().includes(query) ||
      store.region.toLowerCase().includes(query)
    );
  }
  
  // Apply region filter
  if (selectedRegions.value.length > 0) {
    result = result.filter(store => selectedRegions.value.includes(store.regionId));
  }
  
  // Apply status filter
  if (selectedStatuses.value.length > 0) {
    result = result.filter(store => 
      selectedStatuses.value.includes(store.status.toLowerCase())
    );
  }
  
  return result;
});

// Methods
const handleSearch = () => {
  // In a real app, you might want to debounce this
  console.log('Searching for:', searchQuery.value);
};

const clearSearch = () => {
  searchQuery.value = '';
};

const toggleFilterMenu = () => {
  showFilterMenu.value = !showFilterMenu.value;
};

const applyFilters = () => {
  console.log('Applied filters:', { regions: selectedRegions.value, statuses: selectedStatuses.value });
  showFilterMenu.value = false;
};

const clearFilters = () => {
  selectedRegions.value = [];
  selectedStatuses.value = [];
  applyFilters();
};

const getStatusClass = (status) => {
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
    name: '',
    address: '',
    regionId: '',
    phone: ''
  };
};

const handleAddStore = async () => {
  addStoreLoading.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const regionObj = regions.value.find(r => r.id === newStore.value.regionId);
    
    const newStoreObj = {
      id: stores.value.length + 1,
      name: newStore.value.name,
      address: newStore.value.address,
      region: regionObj.name,
      regionId: newStore.value.regionId,
      phone: newStore.value.phone,
      status: 'Active',
      lastScreening: null
    };
    
    stores.value.unshift(newStoreObj);
    closeAddStoreDialog();
  } catch (error) {
    console.error('Error adding store:', error);
  } finally {
    addStoreLoading.value = false;
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
  padding: 20px;
}

.store-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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