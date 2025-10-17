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
        Hpp
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
      <th class="text-center sortable" :class="getSortClass('RECID', sortColumn, sortOrder)" @click="handleSort('RECID')">
        Adjust
        <i v-if="sortColumn === 'RECID'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('LASTCATCH', sortColumn, sortOrder)" @click="handleSort('LASTCATCH')">
        Last Catch
        <i v-if="sortColumn === 'LASTCATCH'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
    </template>

    <!-- Table Row -->
    <template #table-row="{ item }">
      <td class="text-center">{{ item.CABANG }}</td>
      <td class="text-center">{{ item.SHOP }}</td>
      <td class="text-center">{{ formatDate(item.TANGGAL) }}</td>
      <td class="text-center">{{ item.PRDCD }}</td>
      <td>{{ item.SINGKATAN || '-' }}</td>
      <td class="text-right">{{ formatCurrency(item.ACOST) }}</td>
      <td class="text-right">{{ formatCurrency(item.PRICE) }}</td>
      <td class="text-right">{{ formatNumber(item.QTY_MSTRAN) }}</td>
      <td class="text-right">{{ formatNumber(item.QTY_MTRAN) }}</td>
      <td class="text-right" :class="getAmountClass(item.SEL)">
        {{ formatNumber(item.SEL) }}
      </td>
      <td class="text-center">
        <input 
          type="checkbox" 
          :checked="item.RECID === '1'" 
          @change="updateAdjustStatus(item, $event)"
          class="adjust-checkbox"
        />
      </td>
      <td class="text-center">{{ formatDateTime(item.LASTCATCH) }}</td>
    </template>
  </DataTable>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';
import * as XLSX from 'xlsx';
import rekonVirtualMrgService from '../../services/rekonVirtualMrg.service';

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

// Update adjust status
const updateAdjustStatus = async (item, event) => {
  try {
    const newRecid = event.target.checked ? '1' : '*';
    
    await rekonVirtualMrgService.updateRecid(
      item.CABANG,
      item.SHOP,
      item.TANGGAL,
      item.PRDCD,
      newRecid
    );
    
    toast.showSuccess('Sukses', `Status adjust untuk ${item.SHOP} ${item.PRDCD} berhasil diperbarui`);
    
    // Refresh the table to show updated data
    // emit('refresh');
  } catch (error) {
    console.error('Error updating adjust status:', error);
    toast.showError('Error', 'Gagal memperbarui status adjust');
    
    // Revert the checkbox state if update failed
    event.target.checked = !event.target.checked;
  }
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
      'Adjust': item.RECID === '1' ? 'Sudah' : 'Belum',
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
/* Clean and Professional Search Container */
.search-container {
  margin-bottom: 1.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filters-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 1.5rem;
  width: 100%;
  padding: 1.25rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
}

.search-form {
  flex: 1;
  display: flex;
  align-items: center;
}

.search-box {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 0.875rem 2.75rem 0.875rem 2.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #374151;
  background: #ffffff;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: #ffffff;
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.search-input:focus ~ .search-icon {
  color: #3b82f6;
}

.clear-button {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  background: #f9fafb;
  border: 1px solid #d1d5db;
  color: #6b7280;
  cursor: pointer;
  padding: 0.375rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-button:hover {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fca5a5;
}

/* Clean and Professional Table Container */
.table-responsive {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 70vh;
  width: 100%;
  position: relative;
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
}

.results-table {
  width: 100%;
  min-width: 1400px;
  border-collapse: separate;
  border-spacing: 0;
  background: #ffffff;
  position: relative;
  table-layout: auto;
}

/* Clean Professional Header */
.results-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
}

.results-table th {
  background: #f8fafc;
  color: #374151;
  font-weight: 600;
  font-size: 0.875rem;
  text-align: left;
  padding: 1rem 0.875rem;
  border-right: 1px solid #e5e7eb;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 5;
  text-transform: none;
  letter-spacing: normal;
  transition: all 0.2s ease;
}

.results-table th:last-child {
  border-right: none;
}

.results-table th:hover {
  background: #f1f5f9;
  color: #1f2937;
}

/* Sortable Header Styling */
.results-table th.sortable {
  cursor: pointer;
  user-select: none;
  position: relative;
  padding-right: 2rem;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
}

.results-table th.sortable:hover {
  background: #e5e7eb;
  color: #111827;
}

.results-table th.sortable .sort-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  transition: all 0.2s ease;
  font-size: 0.8rem;
  pointer-events: none;
}

.results-table th.sort-asc,
.results-table th.sort-desc {
  background: #dbeafe;
  color: #1e40af;
}

.results-table th.sort-asc .sort-icon,
.results-table th.sort-desc .sort-icon {
  opacity: 1;
  color: #2563eb;
}

/* Clean Table Body with Good Readability */
.results-table tbody tr {
  transition: all 0.2s ease;
  border-bottom: 1px solid #f3f4f6;
}

.results-table tbody tr:nth-child(even) {
  background: #fafbfc;
}

.results-table tbody tr:nth-child(odd) {
  background: #ffffff;
}

.results-table tbody tr:hover {
  background: #f0f9ff !important;
  transform: translateX(2px);
}

.results-table td {
  padding: 0.875rem;
  border-right: 1px solid #f3f4f6;
  vertical-align: middle;
  white-space: nowrap;
  font-size: 0.875rem;
  color: #374151;
  transition: all 0.2s ease;
}

.results-table td:last-child {
  border-right: none;
}

/* Enhanced Text Alignment */
.text-right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.text-center {
  text-align: center;
}

/* Clean Amount Styling */
.positive-amount {
  color: #059669;
  font-weight: 600;
}

.negative-amount {
  color: #dc2626;
  font-weight: 600;
}

/* Optimized Column Widths for Better Readability */
.results-table th:nth-child(1),
.results-table td:nth-child(1) {
  width: 60px;
  min-width: 60px;
  text-align: center;
  font-weight: 500;
  color: #6b7280;
}

.results-table th:nth-child(2),
.results-table td:nth-child(2) {
  min-width: 80px;
  width: auto;
  font-weight: 500;
}

.results-table th:nth-child(3),
.results-table td:nth-child(3) {
  min-width: 110px;
  width: auto;
  font-weight: 500;
}

.results-table th:nth-child(4),
.results-table td:nth-child(4) {
  min-width: 130px;
  width: auto;
}

.results-table th:nth-child(5),
.results-table td:nth-child(5) {
  min-width: 200px;
  width: auto;
}

.results-table th:nth-child(6),
.results-table td:nth-child(6) {
  min-width: 120px;
  width: auto;
  font-variant-numeric: tabular-nums;
}

.results-table th:nth-child(7),
.results-table td:nth-child(7) {
  min-width: 120px;
  width: auto;
  font-variant-numeric: tabular-nums;
}

.results-table th:nth-child(8),
.results-table td:nth-child(8) {
  min-width: 120px;
  width: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.results-table th:nth-child(9),
.results-table td:nth-child(9) {
  min-width: 120px;
  width: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.results-table th:nth-child(10),
.results-table td:nth-child(10) {
  min-width: 130px;
  width: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.results-table th:nth-child(11),
.results-table td:nth-child(11) {
  min-width: 180px;
  width: auto;
}

/* Clean Scrollbar Design */
.table-responsive::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.table-responsive::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.table-responsive::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.table-responsive::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Clean Responsive Design */
@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .search-box {
    max-width: 100%;
  }
  
  .search-input {
    padding: 0.75rem 2.5rem 0.75rem 2.5rem;
    font-size: 0.875rem;
  }
  
  .results-table {
    min-width: 1200px;
  }
  
  .results-table th,
  .results-table td {
    padding: 0.75rem 0.625rem;
    font-size: 0.8rem;
  }
}

@media (max-width: 576px) {
  .search-container {
    margin-bottom: 1rem;
  }
  
  .filters-row {
    padding: 0.875rem;
    gap: 0.75rem;
  }
  
  .search-input {
    padding: 0.625rem 2.25rem 0.625rem 2.25rem;
    font-size: 0.8rem;
  }
  
  .results-table {
    min-width: 1000px;
  }
  
  .results-table th,
  .results-table td {
    padding: 0.625rem 0.5rem;
    font-size: 0.75rem;
  }
  
  .table-responsive {
    max-height: 60vh;
  }
}

@media print {
  .search-container,
  .filters-row {
    display: none !important;
  }
  
  .table-responsive {
    overflow: visible !important;
    max-height: none !important;
    box-shadow: none !important;
    border: 1px solid #000 !important;
  }
  
  .results-table {
    min-width: auto !important;
  }
  
  .results-table th {
    background: #f5f5f5 !important;
    color: #000 !important;
    border: 1px solid #000 !important;
  }
  
  .results-table td {
    border: 1px solid #000 !important;
    color: #000 !important;
  }
  
  .positive-amount {
    color: #000 !important;
    font-weight: bold !important;
  }
  
  .negative-amount {
    color: #000 !important;
    font-weight: bold !important;
    text-decoration: underline !important;
  }
}

/* Adjust checkbox styling */
.adjust-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}
</style>
