<template>
  <div class="results-container">
    <!-- Summary Card -->
    <RekonSummaryCard v-if="summary && !loading && !error" :summary="summary" :periode="periode" :cab="cab" />
    
    <!-- Search Component -->
    <div class="search-container">
      <div class="search-box">
        <i class="pi pi-search search-icon"></i>
        <input 
          type="text" 
          v-model="searchQuery" 
          @input="handleSearch"
          placeholder="Cari berdasarkan toko, tipe, atau tanggal..."
          class="search-input"
        />
        <button v-if="searchQuery" @click="clearSearch" class="clear-button">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>
    
    <!-- Table Component -->
    <RekonWtHarianTable 
      :data="results" 
      :loading="loading" 
      :error="error"
      :cab="cab"
      :periode="periode"
      @refresh="loadResults"
      @page-change="handlePageChange"
      @items-per-page-change="handleItemsPerPageChange"
    />
    
    <!-- Pagination Info -->
    <div v-if="!loading && !error && pagination.totalPages > 0" class="pagination-info">
      <span>Halaman {{ pagination.currentPage }} dari {{ pagination.totalPages }} (Total: {{ pagination.total }} data)</span>
    </div>
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
const searchQuery = ref('');
const pagination = ref({
  currentPage: 1,
  itemsPerPage: 10,
  total: 0,
  totalPages: 0
});

// Debounce function for search
const searchTimeout = ref(null);

// Methods
const loadResults = async () => {
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
    
    // Add search params if there's a query
    if (searchQuery.value) {
      params.toko = searchQuery.value;
    }
    
    // Load results
    const resultsResponse = await rekonWtHarianService.getResults(
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
      currentPage: resultsResponse.data.page || 1
    };
    
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

// Handle search with debounce
const handleSearch = () => {
  // Clear any existing timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  // Set a new timeout to debounce the search
  searchTimeout.value = setTimeout(() => {
    // Reset to first page when searching
    pagination.value.currentPage = 1;
    loadResults();
  }, 500); // 500ms debounce
};

// Clear search
const clearSearch = () => {
  searchQuery.value = '';
  pagination.value.currentPage = 1;
  loadResults();
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
  loadResults();
};

// Auto-load data when component is mounted
watch(() => props.periode, (newPeriode) => {
  if (newPeriode && props.autoLoad) {
    loadResults();
  }
}, { immediate: true });
</script>

<style scoped>
.results-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.search-container {
  margin-bottom: 1rem;
}

.search-box {
  position: relative;
  max-width: 500px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 35px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.search-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
  outline: none;
}

.clear-button {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-button:hover {
  color: #333;
}

.pagination-info {
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-top: 1rem;
}
</style>