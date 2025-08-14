<template>
  <div class="data-table-container">
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p>{{ loadingMessage }}</p>
      <p class="help-text">{{ loadingHelpText }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #e74c3c;"></i>
      <p>{{ error }}</p>
      <button @click="$emit('refresh')" class="btn btn-secondary">
        <i class="pi pi-refresh"></i> Coba Lagi
      </button>
    </div>

    <div v-else-if="!data.length && !loading" class="empty-state">
      <i class="pi pi-info-circle" style="font-size: 2rem; color: #3498db;"></i>
      <p>{{ emptyMessage }}</p>
      <p class="help-text">{{ emptyHelpText }}</p>
    </div>

    <div v-else class="table-content">
      <!-- Filters -->
      <div v-if="showFilters" class="filters-container">
        <div class="filters-header">
          <h3 class="filters-title">
            <i class="pi pi-filter"></i> Filter Data
          </h3>
          <button @click="$emit('reset-filters')" class="btn btn-secondary btn-sm">
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

      <!-- Table -->
      <div class="table-container">
        <div class="table-header">
          <h3 class="table-title">{{ tableTitle }}</h3>
          <div class="table-actions">
            <slot name="table-actions">
              <button v-if="showExportButton" class="btn btn-secondary btn-sm" @click="$emit('export')" title="Ekspor ke Excel">
                <i class="pi pi-file-excel"></i> Ekspor Data
              </button>
              <button v-if="showPrintButton" class="btn btn-secondary btn-sm" @click="$emit('print')" title="Cetak hasil">
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
                <slot name="table-header"></slot>
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
          <span class="records-info">Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ filteredItems }}
            data</span>
        </div>

        <div class="pagination-controls">
          <button @click="goToFirstPage" :disabled="currentPage === 1" class="btn btn-icon"
            title="Halaman pertama">
            <i class="pi pi-angle-double-left"></i>
          </button>

          <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-icon" title="Halaman sebelumnya">
            <i class="pi pi-angle-left"></i>
          </button>

          <div class="page-numbers">
            <template v-for="pageNum in displayedPageNumbers" :key="pageNum">
              <button v-if="pageNum !== '...'" @click="goToPage(pageNum)"
                :class="['btn', 'btn-page', currentPage === pageNum ? 'btn-active' : '']">
                {{ pageNum }}
              </button>
              <span v-else class="ellipsis">...</span>
            </template>
          </div>

          <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-icon"
            title="Halaman selanjutnya">
            <i class="pi pi-angle-right"></i>
          </button>

          <button @click="goToLastPage" :disabled="currentPage === totalPages" class="btn btn-icon"
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

      <!-- Actions -->
      <div v-if="showRefreshButton" class="actions-section">
        <button @click="$emit('refresh')" class="btn btn-secondary">
          <i class="pi pi-refresh"></i> Refresh Data
        </button>
      </div>
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
  showRefreshButton: {
    type: Boolean,
    default: true
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [10, 25, 50, 100]
  },
  defaultItemsPerPage: {
    type: Number,
    default: 10
  },
  rowClass: {
    type: Function,
    default: () => ''
  }
});

const emit = defineEmits([
  'refresh', 
  'reset-filters', 
  'export', 
  'print', 
  'page-change', 
  'items-per-page-change'
]);

// State
const currentPage = ref(1);
const itemsPerPage = ref(props.defaultItemsPerPage);

// Computed properties
const totalItems = computed(() => {
  // Check if data has pagination info from backend
  if (props.data && props.data.total !== undefined) {
    return props.data.total;
  }
  return props.data.length;
});

const filteredItems = computed(() => {
  if (props.filteredData && props.filteredData.length) {
    return props.filteredData.length;
  }
  // Check if data has pagination info from backend
  if (props.data && props.data.total !== undefined) {
    return props.data.total;
  }
  return props.data.length;
});

const totalPages = computed(() => {
  // Check if data has pagination info from backend
  if (props.data && props.data.totalPages !== undefined) {
    return props.data.totalPages;
  }
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
  
  // Otherwise, paginate on the client side
  const dataToUse = props.filteredData.length ? props.filteredData : props.data;
  return dataToUse.slice(startIndex.value, endIndex.value);
});

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

const prevPage = () => {
  if (currentPage.value > 1) {
    goToPage(currentPage.value - 1);
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    goToPage(currentPage.value + 1);
  }
};

const goToPage = (page) => {
  currentPage.value = page;
  emit('page-change', { page: page, itemsPerPage: itemsPerPage.value });
};

const goToFirstPage = () => {
  goToPage(1);
};

const goToLastPage = () => {
  goToPage(totalPages.value);
};

const handleItemsPerPageChange = () => {
  currentPage.value = 1; // Reset to first page
  emit('items-per-page-change', { page: 1, itemsPerPage: itemsPerPage.value });
};

// Watch for data changes to reset pagination if needed
watch(() => props.data, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = totalPages.value;
  }
}, { deep: true });

watch(() => props.filteredData, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = totalPages.value;
  }
}, { deep: true });

// Tidak diperlukan lagi karena menggunakan tabel tunggal
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
  margin-bottom: 1rem;
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
  gap: 1rem;
}

.filter-stats {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
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
}

.pagination-info {
  color: #666;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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

.items-select:hover {
  border-color: #bbb;
  background-color: #fff;
}

.items-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
  background-color: #fff;
}

/* Actions */
.actions-section {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0 1rem 1rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  border: none;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.btn:active {
  transform: translateY(1px);
}

.btn-icon {
  padding: 0.25rem 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-color-darken);
}

.btn-secondary {
  background-color: #eceff1;
  color: #455a64;
}

.btn-secondary:hover {
  background-color: #cfd8dc;
}

.btn:disabled {
  background-color: #b0bec5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .filters-body {
    flex-direction: column;
  }
  
  .pagination-container {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .items-per-page {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>