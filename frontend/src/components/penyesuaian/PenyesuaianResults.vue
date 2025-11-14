<template>
  <div class="results-container">
    <!-- Summary Card - Commented out until backend implements summary endpoint -->
    <!-- <RekonVirtualSummaryCard v-if="summary && !loading && !error" :summary="summary" :periode="periode" :cab="cab" /> -->

    <!-- Table Component -->
  <PenyesuaianTable :data="results" :loading="loading" :error="error" :cab="cab" :periode="periode"
      :pagination="pagination" @refresh="handleRefresh" @page-change="handlePageChange"
      @items-per-page-change="handleItemsPerPageChange" @sort-change="handleSortChange"
      @shop-updated="handleShopUpdated" @shop-removed="handleShopRemoved" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { penyesuaianService } from '../../services';
import PenyesuaianTable from './PenyesuaianTable.vue';

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

    // Add sorting parameters if available
    if (sortColumn.value) {
      params.sortColumn = sortColumn.value;
      params.sortOrder = sortOrder.value;
    }
    
    // Load results
    try {
      const resultsResponse = await penyesuaianService.resumePerShop(
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
    } catch (error) {
      console.log(`Error during API call:`, error);
    }
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
  pagination.value.currentPage = data.page;
  loadResults();
};

// Handle sort change
const handleSortChange = (data) => {
  sortColumn.value = data.sortColumn;
  sortOrder.value = data.sortOrder;
  pagination.value.currentPage = 1;
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

.pagination-info {
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-top: 1rem;
}
</style>
const handleShopUpdated = ({ cab, shop, updatedData }) => {
  const index = results.value.findIndex(r => (r.CABANG === cab || r.cab === cab) && (r.KDTK === shop || r.shop === shop))
  if (index !== -1) {
    results.value[index] = { ...results.value[index], ...updatedData }
  }
}

const handleShopRemoved = ({ cab, shop }) => {
  const index = results.value.findIndex(r => (r.CABANG === cab || r.cab === cab) && (r.KDTK === shop || r.shop === shop))
  if (index !== -1) {
    results.value.splice(index, 1)
    pagination.value.total = Math.max(0, (pagination.value.total || 0) - 1)
  }
}
