<template>
  <DataTable 
    :data="data" 
    :filteredData="filteredData" 
    :loading="loading" 
    :error="error"
    :loadingMessage="'Memuat data rekonsiliasi...'" 
    :loadingHelpText="'Mohon tunggu sebentar...'"
    :emptyMessage="'Tidak ada data rekonsiliasi untuk ditampilkan.'"
    :emptyHelpText="'Tidak ditemukan data rekonsiliasi untuk cabang dan periode yang dipilih.'"
    :pagination="pagination"
    :tableTitle="'Saldo Virtual Margin Based'" 
    @refresh="$emit('refresh')" 
    @reset-filters="resetFilters"
    @export="exportToExcel" 
    @print="printResults" 
    @page-change="handlePageChange"
    @items-per-page-change="handleItemsPerPageChange" 
    @sort-change="handleSortChange"
  >
    <!-- Search Component -->
    <template #filters>
      <div class="search-container">
        <div class="filters-row">
          <form @submit.prevent="handleSearch" class="search-form">
            <div class="search-box">
              <i class="pi pi-search search-icon"></i>
              <input 
                type="text" 
                v-model="searchQuery" 
                @input="handleSearch" 
                placeholder="Cari Data ..."
                class="search-input" 
              />
              <button type="button" v-if="searchQuery" @click="clearSearch" class="clear-button">
                <i class="pi pi-times"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </template>

    <!-- Table Header with Sorting -->
    <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
      <th class="sortable" :class="getSortClass('CABANG', sortColumn, sortOrder)" @click="handleSort('CABANG')">
        Cabang
        <i v-if="sortColumn === 'CABANG'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('SHOP', sortColumn, sortOrder)" @click="handleSort('SHOP')">
        Shop
        <i v-if="sortColumn === 'SHOP'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('TANGGAL', sortColumn, sortOrder)" @click="handleSort('TANGGAL')">
        Tanggal
        <i v-if="sortColumn === 'TANGGAL'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('PRDCD', sortColumn, sortOrder)" @click="handleSort('PRDCD')">
        Kode Produk
        <i v-if="sortColumn === 'PRDCD'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th>Nama Produk</th>
      <th class="text-right sortable" :class="getSortClass('ACOST', sortColumn, sortOrder)" @click="handleSort('ACOST')">
        Cost
        <i v-if="sortColumn === 'ACOST'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('PRICE', sortColumn, sortOrder)" @click="handleSort('PRICE')">
        Price
        <i v-if="sortColumn === 'PRICE'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('QTY_MSTRAN', sortColumn, sortOrder)" @click="handleSort('QTY_MSTRAN')">
        Qty MSTRAN
        <i v-if="sortColumn === 'QTY_MSTRAN'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('QTY_MTRAN', sortColumn, sortOrder)" @click="handleSort('QTY_MTRAN')">
        Qty MTRAN
        <i v-if="sortColumn === 'QTY_MTRAN'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('SEL', sortColumn, sortOrder)" @click="handleSort('SEL')">
        Selisih
        <i v-if="sortColumn === 'SEL'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('LASTCATCH', sortColumn, sortOrder)" @click="handleSort('LASTCATCH')">
        Last Catch
        <i v-if="sortColumn === 'LASTCATCH'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
    </template>

    <!-- Table Row -->
    <template #table-row="{ item }">
      <td>{{ item.CABANG }}</td>
      <td>{{ item.SHOP }}</td>
      <td>{{ formatDate(item.TANGGAL) }}</td>
      <td>{{ item.PRDCD }}</td>
      <td>{{ item.SINGKATAN || '-' }}</td>
      <td class="text-right">{{ formatCurrency(item.ACOST) }}</td>
      <td class="text-right">{{ formatCurrency(item.PRICE) }}</td>
      <td class="text-right">{{ formatNumber(item.QTY_MSTRAN) }}</td>
      <td class="text-right">{{ formatNumber(item.QTY_MTRAN) }}</td>
      <td class="text-right" :class="getAmountClass(item.SEL)">
        {{ formatNumber(item.SEL) }}
      </td>
      <td>{{ formatDateTime(item.LASTCATCH) }}</td>
    </template>
  </DataTable>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';
import * as XLSX from 'xlsx';

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  cab: {
    type: String,
    required: true
  },
  periode: {
    type: String,
    required: true
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

const emit = defineEmits(['refresh', 'page-change', 'items-per-page-change', 'sort-change']);
const toast = useToastService();

// Search functionality
const searchQuery = ref('');
const searchTimeout = ref(null);

// Computed properties
const filteredData = computed(() => {
  if (Array.isArray(props.data)) {
    return props.data;
  }
  return [];
});

// Formatting methods
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getAmountClass = (amount) => {
  if (!amount || amount === 0) return '';
  return amount < 0 ? 'negative-amount' : 'positive-amount';
};

const getSortClass = (column, currentColumn, currentOrder) => {
  if (column !== currentColumn) return '';
  return currentOrder === 'asc' ? 'sort-asc' : 'sort-desc';
};

const getSortIcon = (sortOrder) => {
  return sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down';
};

// Search methods
const handleSearch = () => {
  clearTimeout(searchTimeout.value);
  searchTimeout.value = setTimeout(() => {
    emit('refresh', { 
      searchQuery: searchQuery.value,
      page: 1
    });
  }, 500);
};

const clearSearch = () => {
  searchQuery.value = '';
  emit('refresh', { 
    searchQuery: '',
    page: 1
  });
};

const resetFilters = () => {
  searchQuery.value = '';
  emit('refresh', { 
    searchQuery: '',
    page: 1
  });
};

// Pagination methods
const handlePageChange = (data) => {
  emit('page-change', data);
};

const handleItemsPerPageChange = (data) => {
  emit('items-per-page-change', data);
};

const handleSortChange = (data) => {
  emit('sort-change', data);
};

// Export to Excel
const exportToExcel = () => {
  if (!props.data || props.data.length === 0) {
    toast.showWarning('Perhatian', 'Tidak ada data untuk diekspor');
    return;
  }

  try {
    // Prepare data for export
    const exportData = props.data.map(item => ({
      'Cabang': item.CABANG,
      'Shop': item.SHOP,
      'Tanggal': formatDate(item.TANGGAL),
      'Kode Produk': item.PRDCD,
      'Nama Produk': item.SINGKATAN || '-',
      'Cost': item.ACOST,
      'Price': item.PRICE,
      'Qty MSTRAN': item.QTY_MSTRAN,
      'Qty MTRAN': item.QTY_MTRAN,
      'Selisih': item.SEL,
      'Last Catch': formatDateTime(item.LASTCATCH)
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Rekon Virtual');

    // Generate filename
    const filename = `rekon_virtual_margin_${props.cab}_${props.periode}_${new Date().getTime()}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);

    toast.showSuccess('Sukses', 'Data berhasil diekspor ke Excel');
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.showError('Error', 'Gagal mengekspor data ke Excel');
  }
};

// Print functionality
const printResults = () => {
  window.print();
};
</script>

<style scoped>
.search-container {
  margin-bottom: 1rem;
}

.filters-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-form {
  flex: 1;
  min-width: 250px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #64748b;
  pointer-events: none;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 2.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color, #0ea5e9);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.clear-button {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.clear-button:hover {
  background-color: #f1f5f9;
  color: #64748b;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.sortable {
  cursor: pointer;
  user-select: none;
  position: relative;
}

.sortable:hover {
  background-color: #f8fafc;
}

.sort-icon {
  margin-left: 0.5rem;
  font-size: 0.875rem;
}

.sort-asc {
  background-color: #eff6ff;
}

.sort-desc {
  background-color: #eff6ff;
}

.positive-amount {
  color: #059669;
  font-weight: 600;
}

.negative-amount {
  color: #dc2626;
  font-weight: 600;
}

@media print {
  .search-container,
  .filters-row {
    display: none;
  }
}

@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-form {
    width: 100%;
  }
}
</style>
