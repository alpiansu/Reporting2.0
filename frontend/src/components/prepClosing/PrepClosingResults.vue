<template>
  <div class="results-container">
    <!-- Summary Card -->
    <PrepClosingSummaryCard 
      v-if="summary && !loading && !error" 
      :summary="summary" 
      :periode="periode" 
      :cab="cab" 
    />

    <!-- Table Component -->
    <PrepClosingTable 
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
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { prepClosingService } from '../../services';
import PrepClosingSummaryCard from './PrepClosingSummaryCard.vue';
import PrepClosingTable from './PrepClosingTable.vue';

const props = defineProps({
  cab: {
    type: String,
    default: ''
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
const loadResults = async (options = {}) => {
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

    // Add status filter if provided
    if (options.status) {
      params.status = options.status;
    }

    // Add sorting parameters if available
    if (sortColumn.value) {
      params.sortColumn = sortColumn.value;
      params.sortOrder = sortOrder.value;
    }
    
    // Load screening results
    const resultsResponse = await prepClosingService.getScreeningResults(
      props.cab, 
      props.periode,
      params
    );

    console.log('PrepClosingResults loadResults response:', resultsResponse.data);

    // Update results and pagination info
    results.value = resultsResponse.data.data || [];
    pagination.value = {
      ...pagination.value,
      total: resultsResponse.data.total || 0,
      totalPages: resultsResponse.data.totalPages || 0,
      currentPage: resultsResponse.data.page || 1,
      itemsPerPage: resultsResponse.data.limit || pagination.value.itemsPerPage
    };

    console.log('PrepClosingResults updated results:', results.value);
    console.log('PrepClosingResults updated pagination:', pagination.value);
    
    // Load summary
    const summaryResponse = await prepClosingService.getScreeningSummary(
      props.cab, 
      props.periode
    );
    summary.value = summaryResponse.data.data;
  } catch (err) {
    console.error('Error loading screening data:', err);
    error.value = 'Terjadi kesalahan saat memuat data screening';
    
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
  console.log('PrepClosingResults handlePageChange:', data);
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
  console.log('PrepClosingResults handleSortChange:', data);
  sortColumn.value = data.sortColumn;
  sortOrder.value = data.sortOrder;
  // Reset to first page when sorting changes
  pagination.value.currentPage = 1;
  // Load results with new sorting parameters
  loadResults();
};

// Auto-load data when component is mounted
watch(() => props.periode, (newPeriode) => {
  if (newPeriode && props.autoLoad) {
    loadResults();
  }
}, { immediate: true });

// Expose loadResults function to parent component
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
</style>