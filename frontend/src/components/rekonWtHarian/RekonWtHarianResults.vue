<template>
  <div class="results-container">
    <!-- Summary Card -->
    <RekonSummaryCard v-if="summary && !loading && !error" :summary="summary" :periode="periode" :cab="cab" />

    <!-- Table Component -->
    <RekonWtHarianTable 
      :data="results" 
      :loading="loading" 
      :error="error"
      :cab="cab"
      :periode="periode"
      :pagination="pagination"
      @refresh="handleRefresh"
      @page-change="handlePageChange"
      @items-per-page-change="handleItemsPerPageChange"
      @sort-change="handleSortChange"
      @shop-updated="handleShopUpdated"
      @shop-removed="handleShopRemoved"
    />
    
    <!-- Pagination Info sudah ditampilkan di dalam DataTable -->
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { rekonWtHarianService } from '../../services';
import RekonSummaryCard from './RekonSummaryCard.vue';
import RekonWtHarianTable from './RekonWtHarianTable.vue';

const props = defineProps({
  cab: {
    type: String,
    required: true
  },
  periode: {
    type: String,
    required: true
  },
  autoLoad: {
    type: Boolean,
    default: true
  }
});

// State
const loading = ref(false);
const error = ref(null);
const results = ref([]);
const summary = ref(null);
const pagination = ref({
  currentPage: 1,
  itemsPerPage: 10,
  total: 0,
  totalPages: 0
});
const sortColumn = ref(null);
const sortOrder = ref('asc');

// Methods
// Ekspos fungsi loadResults ke komponen induk
const loadResults = async (options = {}) => {
  // Hanya memeriksa periode, karena cabang bisa kosong (untuk semua cabang)
  if (!props.periode) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    // Prepare params for API call
    const params = {
      page: pagination.value.currentPage,
      limit: pagination.value.itemsPerPage
    };
    
    // Add search params if provided from table component
    if (options.searchQuery) {
      params.searchQuery = options.searchQuery;
    }



    // Add sorting parameters if available
    if (sortColumn.value) {
      params.sortColumn = sortColumn.value;
      params.sortOrder = sortOrder.value;
    }
    
    // Load results using getDailyShopSummary
const resultsResponse = await rekonWtHarianService.getDailyShopSummary(
  props.cab, 
  props.periode,
  params
);

// Update results and pagination info
results.value = resultsResponse.data.data || [];
pagination.value = {
  ...pagination.value,
  total: resultsResponse.data.total || 0,
  totalPages: resultsResponse.data.totalPages || 0,
  currentPage: resultsResponse.data.page || 1,
  itemsPerPage: resultsResponse.data.limit || pagination.value.itemsPerPage
};
    
    // Load summary
    const summaryResponse = await rekonWtHarianService.getSummary(
      props.cab, 
      props.periode
    );
    summary.value = summaryResponse.data.data;
  } catch (err) {
    error.value = 'Terjadi kesalahan saat memuat data rekonsiliasi';
    
    if (err.response?.data?.message) {
      error.value = err.response.data.message;
    }
  } finally {
    loading.value = false;
  }
};



// Handle refresh event from table component
const handleRefresh = (data = {}, event) => {
  // Prevent default browser behavior to avoid page refresh
  if (event) event.preventDefault();
  
  // Update pagination settings if provided
  if (data.page) {
    pagination.value.currentPage = data.page;
  }
  if (data.itemsPerPage) {
    pagination.value.itemsPerPage = data.itemsPerPage;
  }
  // Pass all parameters to loadResults
  loadResults(data);
};

// Handle page change
const handlePageChange = (data) => {
  pagination.value.currentPage = data.page;
  pagination.value.itemsPerPage = data.itemsPerPage;
  loadResults();
};

// Handle items per page change
const handleItemsPerPageChange = (data) => {
  pagination.value.itemsPerPage = data.itemsPerPage;
  pagination.value.currentPage = data.page; // Reset to first page
  // Explicitly load results with new pagination settings
  loadResults();
};

// Handle sort change
const handleSortChange = (data) => {
  sortColumn.value = data.sortColumn;
  sortOrder.value = data.sortOrder;
  // Reset to first page when sorting changes
  pagination.value.currentPage = 1;
  // Load results with new sorting parameters
  loadResults();
};

// Handle shop updated event - update specific shop data reactively
const handleShopUpdated = async (data) => {
  const { cab, shop, updatedData } = data;
  
  // Find the shop in current results and update it
  const shopIndex = results.value.findIndex(
    item => item.cab === cab && item.shop === shop
  );
  
  if (shopIndex !== -1) {
    // Update the specific shop data reactively
    results.value[shopIndex] = {
      ...results.value[shopIndex],
      ...updatedData,
      updtime: new Date().toISOString() // Ensure fresh timestamp
    };
    
    // Shop data updated in results
  } else {
    // Shop not found in current results, may need to refresh
  }
  
  // Refresh summary after shop update to reflect changes in totals
  try {
    const summaryResponse = await rekonWtHarianService.getSummary(
      props.cab, 
      props.periode
    );
    summary.value = summaryResponse.data.data;
  } catch (error) {
    console.error('Error refreshing summary after shop update:', error);
  }
};

// Handle shop removed event - remove shop data when refresh results are clean
const handleShopRemoved = async (data) => {
  const { cab, shop } = data;
  
  // Find the shop in current results and remove it
  const shopIndex = results.value.findIndex(
    item => item.cab === cab && item.shop === shop
  );
  
  if (shopIndex !== -1) {
    // Remove the shop from results array
    results.value.splice(shopIndex, 1);
    
    // Update pagination total count
    pagination.value.total = Math.max(0, pagination.value.total - 1);
    pagination.value.totalPages = Math.ceil(pagination.value.total / pagination.value.itemsPerPage);
    
    // Shop removed from results - data is now clean
  } else {
    // Shop not found in current results for removal
  }
  
  // Refresh summary after shop removal to reflect changes in totals
  try {
    const summaryResponse = await rekonWtHarianService.getSummary(
      props.cab, 
      props.periode
    );
    summary.value = summaryResponse.data.data;
  } catch (error) {
    console.error('Error refreshing summary after shop removal:', error);
  }
};

// Auto-load data when component is mounted
watch(() => props.periode, (newPeriode) => {
  if (newPeriode && props.autoLoad) {
    loadResults();
  }
}, { immediate: true });

// Ekspos fungsi loadResults ke komponen induk
defineExpose({
  loadResults
});
</script>

<style scoped>
.results-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}



.pagination-info {
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-top: 1rem;
}
</style>