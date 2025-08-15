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
    
    // Load results
const resultsResponse = await rekonWtHarianService.getResults(
  props.cab, 
  props.periode,
  params
);

console.log('RekonWtHarianResults loadResults response:', resultsResponse.data);

// Update results and pagination info
results.value = resultsResponse.data.data || [];
pagination.value = {
  ...pagination.value,
  total: resultsResponse.data.total || 0,
  totalPages: resultsResponse.data.totalPages || 0,
  currentPage: resultsResponse.data.page || 1,
  itemsPerPage: resultsResponse.data.limit || pagination.value.itemsPerPage
};

console.log('RekonWtHarianResults updated results:', results.value);
console.log('RekonWtHarianResults updated pagination:', pagination.value);
    
    // Load summary
    const summaryResponse = await rekonWtHarianService.getSummary(
      props.cab, 
      props.periode
    );
    summary.value = summaryResponse.data.data;
  } catch (err) {
    console.error('Error loading reconciliation data:', err);
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
  console.log('RekonWtHarianResults handlePageChange:', data);
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