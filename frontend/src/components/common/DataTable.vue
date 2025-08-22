<template>
  <div class="data-table-container">
    <!-- Filters - Always visible regardless of data state -->
    <div v-if="showFilters" class="filters-container">
      <div class="filters-header">
        <h3 class="filters-title">
          <i class="pi pi-filter"></i> Filter Data
        </h3>
        <button @click.prevent="$emit('reset-filters')" class="btn btn-secondary btn-sm">
          <i class="pi pi-filter-slash"></i> Reset
        </button>
      </div>

      <div class="filters-body">
        <slot name="filters"></slot>

        <div class="filter-stats">
          <div class="filter-stat-item">
            <span class="filter-stat-label">Total Data:</span>
            <span class="filter-stat-value">{{ totalItems }}</span>
          </div>
          <div class="filter-stat-item" v-if="filteredItems !== totalItems">
            <span class="filter-stat-label">Terfilter:</span>
            <span class="filter-stat-value">{{ totalItems - filteredItems }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p>{{ loadingMessage }}</p>
      <p class="help-text">{{ loadingHelpText }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #e74c3c;"></i>
      <p>{{ error }}</p>
      <button @click="handleRefreshClick" class="btn btn-secondary btn-sm">
        <i class="pi pi-refresh"></i> Coba Lagi
      </button>
    </div>

    <div v-else-if="!data.length && !loading" class="empty-state">
      <i class="pi pi-info-circle" style="font-size: 2rem; color: #3498db;"></i>
      <p>{{ emptyMessage }}</p>
      <p class="help-text">{{ emptyHelpText }}</p>
    </div>

    <div v-else class="table-content">
      <!-- Table -->
      <div class="table-container">
        <div class="table-header">
          <h3 class="table-title">{{ tableTitle }}</h3>
          <div class="table-actions">
            <slot name="table-actions">
              <button v-if="showExportButton" class="btn btn-secondary btn-sm" @click.prevent="$emit('export')" title="Ekspor ke Excel">
                <i class="pi pi-file-excel"></i> Ekspor Data
              </button>
              <button v-if="showPrintButton" class="btn btn-secondary btn-sm" @click.prevent="$emit('print')" title="Cetak hasil">
                <i class="pi pi-print"></i> Cetak
              </button>
            </slot>
          </div>
        </div>

        <div class="table-responsive">
          <table class="results-table">
            <thead>
              <tr>
                <th v-if="showRowNumbers" class="text-center">No</th>
                <slot name="table-header-sortable" :sort-column="sortColumn" :sort-order="sortOrder" :handle-sort="handleSort"></slot>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in paginatedData" :key="index" :class="getRowClass(item, index)">
                <td v-if="showRowNumbers" class="text-center">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                <slot name="table-row" :item="item" :index="index"></slot>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination-container" v-if="totalPages > 0 && showPagination">
        <div class="pagination-info">
          <span class="records-info">Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ filteredItems }} data <strong>(Halaman {{ currentPage }} dari {{ totalPages }})</strong></span>
        </div>

        <div class="pagination-controls">
          <button @click.prevent="goToFirstPage" :disabled="currentPage === 1" class="btn btn-icon"
            title="Halaman pertama">
            <i class="pi pi-angle-double-left"></i>
          </button>

          <button @click.prevent="prevPage" :disabled="currentPage === 1" class="btn btn-icon" title="Halaman sebelumnya">
            <i class="pi pi-angle-left"></i>
          </button>

          <div class="page-numbers">
            <template v-for="pageNum in displayedPageNumbers" :key="pageNum">
              <button v-if="pageNum !== '...'" @click.prevent="goToPage(pageNum)"
                :class="['btn', 'btn-page', currentPage === pageNum ? 'btn-active' : '']">
                {{ pageNum }}
              </button>
              <span v-else class="ellipsis">...</span>
            </template>
          </div>

          <button @click.prevent="nextPage" :disabled="currentPage === totalPages" class="btn btn-icon"
            title="Halaman selanjutnya">
            <i class="pi pi-angle-right"></i>
          </button>

          <button @click.prevent="goToLastPage" :disabled="currentPage === totalPages" class="btn btn-icon"
            title="Halaman terakhir">
            <i class="pi pi-angle-double-right"></i>
          </button>
        </div>

        <div class="items-per-page">
          <label for="items-per-page-select">Per halaman:</label>
          <select id="items-per-page-select" v-model="itemsPerPage" @change="handleItemsPerPageChange" class="items-select">
            <option v-for="option in itemsPerPageOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Actions - Always visible -->
    <div v-if="showRefreshButton" class="actions-section">
      <button @click="handleRefreshClick" class="btn btn-secondary">
        <i class="pi pi-refresh"></i> Refresh Data
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  filteredData: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  loadingMessage: {
    type: String,
    default: 'Memuat data...'
  },
  loadingHelpText: {
    type: String,
    default: 'Mohon tunggu sebentar...'
  },
  emptyMessage: {
    type: String,
    default: 'Tidak ada data untuk ditampilkan.'
  },
  emptyHelpText: {
    type: String,
    default: 'Tidak ditemukan data untuk kriteria yang dipilih.'
  },
  tableTitle: {
    type: String,
    default: 'Data'
  },
  showFilters: {
    type: Boolean,
    default: true
  },
  showRowNumbers: {
    type: Boolean,
    default: true
  },
  showPagination: {
    type: Boolean,
    default: true
  },
  showExportButton: {
    type: Boolean,
    default: true
  },
  showPrintButton: {
    type: Boolean,
    default: true
  },
  showSorting: {
    type: Boolean,
    default: true
  },
  showRefreshButton: {
    type: Boolean,
    default: true
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [5, 10, 25, 50, 100]
  },
  defaultItemsPerPage: {
    type: Number,
    default: 10
  },
  rowClass: {
    type: Function,
    default: () => ''
  },
  pagination: {
    type: Object,
    default: () => ({
      currentPage: 1,
      itemsPerPage: 10,
      total: 0,
      totalPages: 0
    })
  }
});

const emit = defineEmits([
  'refresh', 
  'reset-filters', 
  'export', 
  'print', 
  'page-change', 
  'items-per-page-change',
  'sort-change'
]);

// State
const currentPage = ref(props.pagination?.currentPage || 1);
const sortColumn = ref(null);
const sortOrder = ref('asc'); // 'asc' or 'desc'
const itemsPerPage = ref(props.pagination?.itemsPerPage || props.defaultItemsPerPage);

// Computed properties
const totalItems = computed(() => {
  // Prioritaskan menggunakan props.pagination jika tersedia
  if (props.pagination && props.pagination.total !== undefined) {
    return props.pagination.total;
  }
  // Fallback ke props.data jika memiliki info pagination dari backend
  if (props.data && props.data.total !== undefined) {
    return props.data.total;
  }
  return props.data.length;
});

const filteredItems = computed(() => {
  // Prioritaskan menggunakan props.pagination jika tersedia
  if (props.pagination && props.pagination.total !== undefined) {
    return props.pagination.total;
  }
  if (props.filteredData && props.filteredData.length) {
    return props.filteredData.length;
  }
  // Fallback ke props.data jika memiliki info pagination dari backend
  if (props.data && props.data.total !== undefined) {
    return props.data.total;
  }
  return props.data.length;
});

const totalPages = computed(() => {
  // Prioritaskan menggunakan props.pagination jika tersedia
  if (props.pagination && props.pagination.totalPages !== undefined) {
    return props.pagination.totalPages;
  }
  // Fallback ke props.data jika memiliki info pagination dari backend
  if (props.data && props.data.totalPages !== undefined) {
    return props.data.totalPages;
  }
  // Hanya hitung manual jika tidak ada data totalPages dari backend
  return Math.ceil(filteredItems.value / itemsPerPage.value);
});

const startIndex = computed(() => {
  return (currentPage.value - 1) * itemsPerPage.value;
});

const endIndex = computed(() => {
  return Math.min(startIndex.value + itemsPerPage.value, filteredItems.value);
});

const paginatedData = computed(() => {
  // If data is already paginated from backend, use it directly
  if (props.data && Array.isArray(props.data.data)) {
    return props.data.data;
  }
  
  // If filteredData is provided, use it directly as it's already processed
  if (props.filteredData && Array.isArray(props.filteredData)) {
    return props.filteredData;
  }
  
  // Otherwise, paginate on the client side
  return props.data.slice(startIndex.value, endIndex.value);
});

// Sync currentPage and itemsPerPage with backend pagination if available
watch(() => props.data, (newData) => {
  console.log('DataTable watch props.data:', newData);
  if (newData && newData.page !== undefined) {
    currentPage.value = newData.page;
  }
  if (newData && newData.limit !== undefined) {
    itemsPerPage.value = newData.limit;
  }
}, { immediate: true, deep: true });

// Sync with props.pagination when it changes
watch(() => props.pagination, (newPagination) => {
  console.log('DataTable watch props.pagination:', newPagination);
  if (newPagination) {
    if (newPagination.currentPage !== undefined) {
      currentPage.value = newPagination.currentPage;
    }
    if (newPagination.itemsPerPage !== undefined) {
      itemsPerPage.value = newPagination.itemsPerPage;
    }
  }
}, { immediate: true, deep: true });

const displayedPageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const delta = 2; // Number of pages to show before and after current page
  
  if (total <= 7) {
    // If we have 7 or fewer pages, show all
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  
  // Always include first and last page
  let pages = [1];
  
  // Calculate start and end of the displayed range
  const rangeStart = Math.max(2, current - delta);
  const rangeEnd = Math.min(total - 1, current + delta);
  
  // Add ellipsis if needed before the range
  if (rangeStart > 2) {
    pages.push('...');
  }
  
  // Add all pages in the range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }
  
  // Add ellipsis if needed after the range
  if (rangeEnd < total - 1) {
    pages.push('...');
  }
  
  // Add the last page
  if (total > 1) {
    pages.push(total);
  }
  
  return pages;
});

// Methods
const getRowClass = (item, index) => {
  return props.rowClass(item, index);
};

const prevPage = (event) => {
  if (event) event.preventDefault();
  if (currentPage.value > 1) {
    goToPage(currentPage.value - 1);
  }
};

const nextPage = (event) => {
  if (event) event.preventDefault();
  if (currentPage.value < totalPages.value) {
    goToPage(currentPage.value + 1);
  }
};

const goToPage = (page, event) => {
  if (event) event.preventDefault();
  currentPage.value = page;
  emit('page-change', { page: page, itemsPerPage: itemsPerPage.value });
};

const goToFirstPage = (event) => {
  if (event) event.preventDefault();
  goToPage(1);
};

const goToLastPage = (event) => {
  if (event) event.preventDefault();
  goToPage(totalPages.value);
};

const handleItemsPerPageChange = () => {
  currentPage.value = 1; // Reset to first page
  emit('items-per-page-change', { page: 1, itemsPerPage: itemsPerPage.value });
};

// Handle refresh button click without causing full page refresh
const handleRefreshClick = (event) => {
  // Prevent default browser behavior to avoid page refresh
  if (event) event.preventDefault();
  
  // Emit refresh event with current pagination state
  emit('refresh', { 
    page: currentPage.value, 
    itemsPerPage: itemsPerPage.value,
    sortColumn: sortColumn.value,
    sortOrder: sortOrder.value
  });
};

// Handle sorting when a column header is clicked
const handleSort = (column) => {
  // If clicking the same column, toggle sort order
  if (sortColumn.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    // If clicking a new column, set it as sort column and default to ascending
    sortColumn.value = column;
    sortOrder.value = 'asc';
  }
  
  // Emit sort-change event with sort parameters
  emit('sort-change', { 
    sortColumn: sortColumn.value, 
    sortOrder: sortOrder.value,
    page: currentPage.value,
    itemsPerPage: itemsPerPage.value
  });
};

// Watch for data changes to reset pagination if needed
watch(() => props.data, (newData) => {
  // If we have backend pagination data, use it
  if (newData && newData.totalPages !== undefined) {
    // Sync pagination with backend data
    if (newData.page !== undefined) {
      currentPage.value = newData.page;
    }
    if (newData.limit !== undefined) {
      itemsPerPage.value = newData.limit;
    }
    
    // Check if current page exceeds total pages
    if (currentPage.value > newData.totalPages && newData.totalPages > 0) {
      currentPage.value = newData.totalPages;
      emit('page-change', { page: currentPage.value, itemsPerPage: itemsPerPage.value });
    }
  } else {
    // Client-side pagination
    if (currentPage.value > totalPages.value && totalPages.value > 0) {
      currentPage.value = totalPages.value;
      emit('page-change', { page: currentPage.value, itemsPerPage: itemsPerPage.value });
    }
  }
}, { deep: true });

watch(() => props.filteredData, (newData) => {
  // Periksa jika props.pagination tersedia dan memiliki totalPages
  if (props.pagination && props.pagination.totalPages !== undefined) {
    if (currentPage.value > props.pagination.totalPages && props.pagination.totalPages > 0) {
      currentPage.value = props.pagination.totalPages;
      emit('page-change', { page: currentPage.value, itemsPerPage: itemsPerPage.value });
    }
  } else if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = totalPages.value;
    emit('page-change', { page: currentPage.value, itemsPerPage: itemsPerPage.value });
  }
}, { deep: true });
</script>

<style scoped>
.data-table-container {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

/* Loading State */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.loading-state i,
.error-state i,
.empty-state i {
  margin-bottom: 1rem;
}

.help-text {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Filters */
.filters-container {
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 1rem;
}

/* Sorting */
.sortable {
  cursor: pointer;
  position: relative;
  user-select: none;
}

.sortable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.sort-icon {
  margin-left: 5px;
  transition: transform 0.2s ease;
}

.sort-asc .sort-icon {
  transform: rotate(0deg);
}

.sort-desc .sort-icon {
  transform: rotate(180deg);
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.filters-title {
  font-size: 1rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-body {
  display: flex;
  flex-wrap: wrap;
}

.filter-stats {
  display: flex;
  width: 100%;
  font-size: 0.875rem;
}

.filter-stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-stat-value {
  font-weight: 600;
  color: var(--primary-color);
}

/* Table */
.table-container {
  padding: 0 1rem;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.table-title {
  font-size: 1rem;
  margin: 0;
}

.table-actions {
  display: flex;
  gap: 0.5rem;
}

.table-responsive {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 70vh;
  width: 100%;
  position: relative;
  margin-bottom: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
}

/* Definisi sudah ada di atas */

.results-table thead {
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: #fff;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 0.875rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  margin-bottom: 0;
  table-layout: fixed;
}

.header-table, .body-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-spacing: 0;
}

.header-table th, .body-table td {
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.75rem 1rem;
}

.body-table {
  margin-top: 0;
  border-top: none;
}

.results-table th,
.results-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  vertical-align: middle;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
}

.results-table th {
  background: linear-gradient(to bottom, #f8f9fa, #f1f3f5);
  color: #37474f;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid #cfd8dc;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
}

.results-table tr {
  transition: all 0.2s ease;
}

.results-table tr:hover {
  background-color: #f5f7fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.results-table tr:last-child td {
  border-bottom: none;
}

.results-table tr:nth-child(even) {
  background-color: #fafbfc;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid #e9ecef;
  font-size: 0.875rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.pagination-info {
  color: #666;
  flex: 1 1 100%;
  order: 1;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 2 1 auto;
  order: 2;
  justify-content: center;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-page {
  min-width: 2rem;
  height: 2rem;
  padding: 0;
}

.btn-active {
  background-color: var(--primary-color);
  color: white;
}

.ellipsis {
  padding: 0 0.5rem;
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 auto;
  order: 3;
  justify-content: flex-end;
}

.items-select {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: #f5f5f5;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 2rem;
}

.items-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.25);
}

/* Actions section */
.actions-section {
  display: flex;
  justify-content: center;
  padding: 1rem;
  border-top: 1px solid #e9ecef;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .pagination-container {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .pagination-info,
  .pagination-controls,
  .items-per-page {
    flex: 1 1 100%;
    width: 100%;
    justify-content: center;
    text-align: center;
  }
  
  .pagination-info {
    order: 1;
  }
  
  .pagination-controls {
    order: 2;
  }
  
  .items-per-page {
    order: 3;
  }
  
  .btn-page {
    min-width: 1.75rem;
    height: 1.75rem;
    font-size: 0.75rem;
  }
}

@media (max-width: 576px) {
  .page-numbers {
    gap: 0.15rem;
  }
  
  .btn-page {
    min-width: 1.5rem;
    height: 1.5rem;
    font-size: 0.7rem;
  }
  
  .btn-icon {
    padding: 0.15rem 0.35rem;
  }
  
  .ellipsis {
    padding: 0 0.25rem;
  }
  
  .results-table th,
  .results-table td {
    padding: 0.6rem 0.5rem;
    font-size: 0.8rem;
  }
  
  .results-table th {
    font-size: 0.7rem;
  }
}
</style>