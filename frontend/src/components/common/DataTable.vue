<template>
  <div class="data-table-container">
    <!-- Filters -->
    <div v-if="showFilters" class="filters-container">
      <div class="filters-header">
        <h3 class="filters-title"><i class="pi pi-filter"></i> Filter Data</h3>
        <button @click.prevent="$emit('reset-filters')" class="btn btn-reset">
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

    <!-- Loading / Error / Empty States -->
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p>{{ loadingMessage }}</p>
      <p class="help-text">{{ loadingHelpText }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #e74c3c"></i>
      <p>{{ error }}</p>
      <button @click="handleRefreshClick" class="btn btn-refresh"><i class="pi pi-refresh"></i> Coba Lagi</button>
    </div>

    <div v-else-if="!data.length && !loading" class="empty-state">
      <i class="pi pi-info-circle" style="font-size: 2rem; color: #3498db"></i>
      <p>{{ emptyMessage }}</p>
      <p class="help-text">{{ emptyHelpText }}</p>
    </div>

    <!-- Table Section -->
    <div v-else>
      <div class="table-container">
        <div class="table-header elegant-header">
          <div class="table-title-wrap">
            <h3 class="table-title">
              <i class="pi pi-database"></i>
              <span>{{ tableTitle }}</span>
            </h3>
            <div class="table-subtitle">Data yang di tampilkan merupakan data yang perlu dicek</div>
          </div>
          <div class="table-actions">
            <slot name="table-actions">
              <button
                v-if="showExportButton"
                class="btn btn-export"
                @click.prevent="$emit('export')"
                title="Ekspor ke Excel"
              >
                <i class="pi pi-file-excel"></i> Ekspor
              </button>
            </slot>
          </div>
        </div>

        <div class="table-responsive elegant-shadow">
          <table class="results-table">
            <thead>
              <tr v-if="$slots['table-header-group']" class="group-header-row">
                <th v-if="showRowNumbers" class="group-header-cell"></th>
                <slot name="table-header-group"></slot>
              </tr>
              <tr class="sortable-header-row">
                <th v-if="showRowNumbers" class="text-center">No</th>
                <slot
                  name="table-header-sortable"
                  :sort-column="sortColumn"
                  :sort-order="sortOrder"
                  :handle-sort="handleSort"
                ></slot>
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
          <span class="records-info">
            Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ filteredItems }} data
            <strong>(Halaman {{ currentPage }} dari {{ totalPages }})</strong>
          </span>
        </div>

        <div class="pagination-controls">
          <button
            @click.prevent="goToFirstPage"
            :disabled="currentPage === 1"
            class="btn btn-nav"
            title="Halaman pertama"
          >
            <i class="pi pi-angle-double-left"></i>
          </button>
          <button @click.prevent="prevPage" :disabled="currentPage === 1" class="btn btn-nav" title="Sebelumnya">
            <i class="pi pi-angle-left"></i>
          </button>

          <div class="page-numbers">
            <template v-for="pageNum in displayedPageNumbers" :key="pageNum">
              <button
                v-if="pageNum !== '...'"
                @click.prevent="goToPage(pageNum)"
                :class="['btn', 'btn-page', currentPage === pageNum ? 'btn-page-active' : '']"
              >
                {{ pageNum }}
              </button>
              <span v-else class="ellipsis">...</span>
            </template>
          </div>

          <button
            @click.prevent="nextPage"
            :disabled="currentPage === totalPages"
            class="btn btn-nav"
            title="Berikutnya"
          >
            <i class="pi pi-angle-right"></i>
          </button>
          <button
            @click.prevent="goToLastPage"
            :disabled="currentPage === totalPages"
            class="btn btn-nav"
            title="Terakhir"
          >
            <i class="pi pi-angle-double-right"></i>
          </button>
        </div>

        <div class="items-per-page">
          <label for="items-per-page-select">Per halaman:</label>
          <select
            id="items-per-page-select"
            v-model="itemsPerPage"
            @change="handleItemsPerPageChange"
            class="items-select"
          >
            <option v-for="option in itemsPerPageOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <div v-if="showRefreshButton" class="actions-section">
      <button @click="handleRefreshClick" class="btn btn-refresh"><i class="pi pi-refresh"></i> Refresh Data</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  filteredData: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
  loadingMessage: {
    type: String,
    default: "Memuat data...",
  },
  loadingHelpText: {
    type: String,
    default: "Mohon tunggu sebentar...",
  },
  emptyMessage: {
    type: String,
    default: "Tidak ada data untuk ditampilkan.",
  },
  emptyHelpText: {
    type: String,
    default: "Tidak ditemukan data untuk kriteria yang dipilih.",
  },
  tableTitle: {
    type: String,
    default: "Data",
  },
  showFilters: {
    type: Boolean,
    default: true,
  },
  showRowNumbers: {
    type: Boolean,
    default: true,
  },
  showPagination: {
    type: Boolean,
    default: true,
  },
  showExportButton: {
    type: Boolean,
    default: true,
  },
  showPrintButton: {
    type: Boolean,
    default: true,
  },
  showSorting: {
    type: Boolean,
    default: true,
  },
  showRefreshButton: {
    type: Boolean,
    default: true,
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [5, 10, 25, 50, 100],
  },
  defaultItemsPerPage: {
    type: Number,
    default: 10,
  },
  rowClass: {
    type: Function,
    default: () => "",
  },
  pagination: {
    type: Object,
    default: () => ({
      currentPage: 1,
      itemsPerPage: 10,
      total: 0,
      totalPages: 0,
    }),
  },
});

const emit = defineEmits([
  "refresh",
  "reset-filters",
  "export",
  "print",
  "page-change",
  "items-per-page-change",
  "sort-change",
]);

// State
const currentPage = ref(props.pagination?.currentPage || 1);
const sortColumn = ref(null);
const sortOrder = ref("asc"); // 'asc' or 'desc'
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
watch(
  () => props.data,
  newData => {
    // console.log('DataTable watch props.data:', newData);
    if (newData && newData.page !== undefined) {
      currentPage.value = newData.page;
    }
    if (newData && newData.limit !== undefined) {
      itemsPerPage.value = newData.limit;
    }
  },
  { immediate: true, deep: true },
);

// Sync with props.pagination when it changes
watch(
  () => props.pagination,
  newPagination => {
    // console.log('DataTable watch props.pagination:', newPagination);
    if (newPagination) {
      if (newPagination.currentPage !== undefined) {
        currentPage.value = newPagination.currentPage;
      }
      if (newPagination.itemsPerPage !== undefined) {
        itemsPerPage.value = newPagination.itemsPerPage;
      }
    }
  },
  { immediate: true, deep: true },
);

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
    pages.push("...");
  }

  // Add all pages in the range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis if needed after the range
  if (rangeEnd < total - 1) {
    pages.push("...");
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

const prevPage = event => {
  if (event) event.preventDefault();
  if (currentPage.value > 1) {
    goToPage(currentPage.value - 1);
  }
};

const nextPage = event => {
  if (event) event.preventDefault();
  if (currentPage.value < totalPages.value) {
    goToPage(currentPage.value + 1);
  }
};

const goToPage = (page, event) => {
  if (event) event.preventDefault();
  currentPage.value = page;
  emit("page-change", { page: page, itemsPerPage: itemsPerPage.value });
};

const goToFirstPage = event => {
  if (event) event.preventDefault();
  goToPage(1);
};

const goToLastPage = event => {
  if (event) event.preventDefault();
  goToPage(totalPages.value);
};

const handleItemsPerPageChange = () => {
  currentPage.value = 1; // Reset to first page
  emit("items-per-page-change", { page: 1, itemsPerPage: itemsPerPage.value });
};

// Handle refresh button click without causing full page refresh
const handleRefreshClick = event => {
  // Prevent default browser behavior to avoid page refresh
  if (event) event.preventDefault();

  // Emit refresh event with current pagination state
  emit("refresh", {
    page: currentPage.value,
    itemsPerPage: itemsPerPage.value,
    sortColumn: sortColumn.value,
    sortOrder: sortOrder.value,
  });
};

// Handle sorting when a column header is clicked
const handleSort = column => {
  // If clicking the same column, toggle sort order
  if (sortColumn.value === column) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    // If clicking a new column, set it as sort column and default to ascending
    sortColumn.value = column;
    sortOrder.value = "asc";
  }

  // Emit sort-change event with sort parameters
  emit("sort-change", {
    sortColumn: sortColumn.value,
    sortOrder: sortOrder.value,
    page: currentPage.value,
    itemsPerPage: itemsPerPage.value,
  });
};

// Watch for data changes to reset pagination if needed
watch(
  () => props.data,
  newData => {
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
        emit("page-change", { page: currentPage.value, itemsPerPage: itemsPerPage.value });
      }
    } else {
      // Client-side pagination
      if (currentPage.value > totalPages.value && totalPages.value > 0) {
        currentPage.value = totalPages.value;
        emit("page-change", { page: currentPage.value, itemsPerPage: itemsPerPage.value });
      }
    }
  },
  { deep: true },
);

watch(
  () => props.filteredData,
  newData => {
    // Periksa jika props.pagination tersedia dan memiliki totalPages
    if (props.pagination && props.pagination.totalPages !== undefined) {
      if (currentPage.value > props.pagination.totalPages && props.pagination.totalPages > 0) {
        currentPage.value = props.pagination.totalPages;
        emit("page-change", { page: currentPage.value, itemsPerPage: itemsPerPage.value });
      }
    } else if (currentPage.value > totalPages.value && totalPages.value > 0) {
      currentPage.value = totalPages.value;
      emit("page-change", { page: currentPage.value, itemsPerPage: itemsPerPage.value });
    }
  },
  { deep: true },
);
</script>

<style scoped src="./DataTable.style.css"></style>
