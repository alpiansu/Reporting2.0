<template>
  <DataTable :data="data" :filteredData="filteredData" :loading="loading" :error="error"
    :loadingMessage="'Memuat data rekonsiliasi...'" :loadingHelpText="'Mohon tunggu sebentar...'"
    :emptyMessage="'Tidak ada data rekonsiliasi untuk ditampilkan.'"
    :emptyHelpText="'Tidak ditemukan data rekonsiliasi untuk cabang dan periode yang dipilih.'"
    :pagination="pagination"
    :tableTitle="'Detail Transaksi'" :rowClass="getRowClass" @refresh="$emit('refresh')" @reset-filters="resetFilters"
    @export="exportToExcel" @print="printResults" @page-change="handlePageChange"
    @items-per-page-change="handleItemsPerPageChange" @sort-change="handleSortChange">
    <!-- Search Component -->
    <template #filters>
      <div class="search-container">
        <div class="filters-row">
          <form @submit.prevent="handleSearch" class="search-form">
            <div class="search-box">
              <i class="pi pi-search search-icon"></i>
              <input type="text" v-model="searchQuery" @input="handleSearch" placeholder="Cari Data ..."
                class="search-input" />
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
      <th class="sortable" :class="{ 'sort-asc': sortColumn === 'cab' && sortOrder === 'asc', 'sort-desc': sortColumn === 'cab' && sortOrder === 'desc' }" @click="handleSort('cab')">
        Cab
        <i v-if="sortColumn === 'cab'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="sortable" :class="{ 'sort-asc': sortColumn === 'tanggal' && sortOrder === 'asc', 'sort-desc': sortColumn === 'tanggal' && sortOrder === 'desc' }" @click="handleSort('tanggal')">
        Tanggal
        <i v-if="sortColumn === 'tanggal'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="sortable" :class="{ 'sort-asc': sortColumn === 'shop' && sortOrder === 'asc', 'sort-desc': sortColumn === 'shop' && sortOrder === 'desc' }" @click="handleSort('shop')">
        Shop
        <i v-if="sortColumn === 'shop'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="text-right sortable" :class="{ 'sort-asc': sortColumn === 'sum_sel_gross' && sortOrder === 'asc', 'sort-desc': sortColumn === 'sum_sel_gross' && sortOrder === 'desc' }" @click="handleSort('sum_sel_gross')">
        Total Selisih Gross
        <i v-if="sortColumn === 'sum_sel_gross'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="text-right sortable" :class="{ 'sort-asc': sortColumn === 'sum_sel_ppn' && sortOrder === 'asc', 'sort-desc': sortColumn === 'sum_sel_ppn' && sortOrder === 'desc' }" @click="handleSort('sum_sel_ppn')">
        Total Selisih PPN
        <i v-if="sortColumn === 'sum_sel_ppn'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="text-right sortable" :class="{ 'sort-asc': sortColumn === 'sum_sel_gross_idm' && sortOrder === 'asc', 'sort-desc': sortColumn === 'sum_sel_gross_idm' && sortOrder === 'desc' }" @click="handleSort('sum_sel_gross_idm')">
        Total Selisih Gross IDM
        <i v-if="sortColumn === 'sum_sel_gross_idm'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="text-right sortable" :class="{ 'sort-asc': sortColumn === 'sum_sel_ppn_idm' && sortOrder === 'asc', 'sort-desc': sortColumn === 'sum_sel_ppn_idm' && sortOrder === 'desc' }" @click="handleSort('sum_sel_ppn_idm')">
        Total Selisih PPN IDM
        <i v-if="sortColumn === 'sum_sel_ppn_idm'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="text-right sortable" :class="{ 'sort-asc': sortColumn === 'record_count' && sortOrder === 'asc', 'sort-desc': sortColumn === 'record_count' && sortOrder === 'desc' }" @click="handleSort('record_count')">
        Jumlah Record
        <i v-if="sortColumn === 'record_count'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
      <th class="sortable" :class="{ 'sort-asc': sortColumn === 'updtime' && sortOrder === 'asc', 'sort-desc': sortColumn === 'updtime' && sortOrder === 'desc' }" @click="handleSort('updtime')">
        Update Time
        <i v-if="sortColumn === 'updtime'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
      </th>
    </template>

    <!-- Table Row -->
    <template #table-row="{ item }">
      <td>{{ item.cab }}</td>
      <td>{{ formatDate(item.tanggal) }}</td>
      <td>{{ item.shop }}</td>
      <td class="text-right" :class="getAmountClass(item.sum_sel_gross)">
        {{ formatCurrency(item.sum_sel_gross) }}
      </td>
      <td class="text-right" :class="getAmountClass(item.sum_sel_ppn)">
        {{ formatCurrency(item.sum_sel_ppn) }}
      </td>
      <td class="text-right" :class="getAmountClass(item.sum_sel_gross_idm)">
        {{ formatCurrency(item.sum_sel_gross_idm) }}
      </td>
      <td class="text-right" :class="getAmountClass(item.sum_sel_ppn_idm)">
        {{ formatCurrencyDecimal(item.sum_sel_ppn_idm) }}
      </td>
      <td class="text-right">
        <span class="badge badge-info">{{ item.record_count }}</span>
      </td>
      <td>{{ formatDateTime(item.updtime) }}</td>
    </template>
  </DataTable>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';

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
  // Pastikan kita mengembalikan array, bukan objek pagination
  if (Array.isArray(props.data)) {
    return props.data;
  } else if (props.data && Array.isArray(props.data.data)) {
    // Jika data adalah objek pagination dari backend
    return props.data.data;
  } else {
    return [];
  }
});

// Debug untuk melihat data yang diterima
watch(() => props.data, (newData) => {
  console.log('RekonWtHarianTable received data:', newData);
}, { immediate: true, deep: true });

watch(() => props.pagination, (newPagination) => {
  console.log('RekonWtHarianTable received pagination:', newPagination);
}, { immediate: true, deep: true });



// Handle search with debounce
const handleSearch = (event) => {
  // Prevent default browser behavior to avoid page refresh
  if (event && event.type === 'submit') event.preventDefault();
  
  // Clear any existing timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  // Set a new timeout to debounce the search
  searchTimeout.value = setTimeout(() => {
    // Emit event to parent component to refresh data with search query
    // Hanya emit refresh dengan searchQuery, tidak perlu emit page-change
    emit('refresh', { 
      searchQuery: searchQuery.value,
      page: 1,
      itemsPerPage: props.pagination.itemsPerPage || 10
    });
  }, 500); // 500ms debounce
};

// Clear search
const clearSearch = (event) => {
  // Prevent default browser behavior to avoid page refresh
  if (event) event.preventDefault();
  
  searchQuery.value = '';
  // Emit event to parent component to refresh data without search query
  // Gabungkan reset halaman dalam satu emit refresh
  emit('refresh', {
    page: 1,
    itemsPerPage: props.pagination.itemsPerPage || 10
  });
};

// Handle page change
const handlePageChange = (data) => {
  emit('page-change', data);
};

// Handle items per page change
const handleItemsPerPageChange = (data) => {
  emit('items-per-page-change', data);
};

// Handle sort change
const handleSortChange = (data) => {
  console.log('Sort changed:', data);
  emit('sort-change', data);
  // Reset to page 1 when sorting changes
  emit('page-change', { page: 1, itemsPerPage: props.pagination.itemsPerPage || 10 });
};

// Reset filters (for compatibility with DataTable component)
const resetFilters = (event) => {
  // Prevent default browser behavior to avoid page refresh
  if (event) event.preventDefault();
  
  searchQuery.value = '';
  
  // Gabungkan reset halaman dalam satu emit refresh
  emit('refresh', {
    page: 1,
    itemsPerPage: props.pagination.itemsPerPage || 10
  });
};

const getRowClass = (item) => {
  return hasDifference(item) ? 'has-diff' : '';
};

const hasDifference = (item) => {
  return item.selisih_gross !== 0 || 
         item.selisih_ppn !== 0 || 
         item.selisih_gross_idm !== 0 || 
         item.selisih_ppn_idm !== 0;
};

// Format currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Format currency with decimal
const formatCurrencyDecimal = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

// Format date time for display
const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return '-';
  
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return dateTimeString;
    
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return dateTimeString;
  }
};

// Get class for amount display
const getAmountClass = (value) => {
  if (!value || value === 0) return 'same-amount';
  return 'different-amount';
};

// Format periode for display
const formatPeriode = (periode) => {
  if (!periode || periode.length !== 4) return periode;
  
  const year = '20' + periode.substring(0, 2);
  const month = parseInt(periode.substring(2, 4));
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
};

// Export to Excel
const exportToExcel = async () => {
  try {
    // Implementasi export ke Excel
    toast.add({
      severity: 'success',
      summary: 'Ekspor Berhasil',
      detail: 'Data berhasil diekspor ke Excel',
      life: 3000
    });
  } catch (err) {
    console.error('Error exporting data:', err);
    toast.add({
      severity: 'error',
      summary: 'Ekspor Gagal',
      detail: 'Terjadi kesalahan saat mengekspor data',
      life: 3000
    });
  }
};

// Print results
const printResults = () => {
  try {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Generate print content
    let printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rekonsiliasi WT Harian - ${props.cab === 'SEMUA' ? 'SEMUA CABANG' : props.cab} - ${formatPeriode(props.periode)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 10px; }
          h2 { font-size: 16px; margin-bottom: 10px; }
          .summary { margin-bottom: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px; }
          .summary-item { margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .different-amount { color: #e74c3c; }
          .footer { margin-top: 20px; font-size: 12px; text-align: center; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
          .badge-cash { background-color: #e8f5e9; color: #4caf50; }
          .badge-non-cash { background-color: #e3f2fd; color: #2196f3; }
          .has-diff { background-color: #fff8e1; }
        </style>
      </head>
      <body>
        <h1>Hasil Rekonsiliasi WT Harian</h1>
        <div>
          <p><strong>Cabang:</strong> ${props.cab === 'SEMUA' ? 'SEMUA CABANG' : props.cab}</p>
          <p><strong>Periode:</strong> ${formatPeriode(props.periode)}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Cab</th>
              <th>Tanggal</th>
              <th>Shop</th>
              <th>Tipe</th>
              <th class="text-right">Gross WRC</th>
              <th class="text-right">Gross Toko</th>
              <th class="text-right">Selisih Gross</th>
              <th class="text-right">PPN WRC</th>
              <th class="text-right">PPN Toko</th>
              <th class="text-right">Selisih PPN</th>
              <th class="text-right">Total Selisih</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add data rows
    filteredData.value.forEach((item, index) => {
      const diffGrossClass = item.selisih_gross !== 0 ? 'different-amount' : '';
      const diffPpnClass = item.selisih_ppn !== 0 ? 'different-amount' : '';
      const totalDiffClass = (item.selisih_gross + item.selisih_ppn) !== 0 ? 'different-amount' : '';
      const rowClass = hasDifference(item) ? 'has-diff' : '';
      
      printContent += `
        <tr class="${rowClass}">
          <td class="text-center">${index + 1}</td>
          <td>${item.cab}</td>
          <td>${formatDate(item.tgl1)}</td>
          <td>${item.shop}</td>
          <td>
            <span class="badge badge-${item.tipe === 'CASH' ? 'cash' : 'non-cash'}">
              ${item.tipe}
            </span>
          </td>
          <td class="text-right">${formatCurrency(item.gross_wrc)}</td>
          <td class="text-right">${formatCurrency(item.gross_store)}</td>
          <td class="text-right ${diffGrossClass}">${formatCurrency(item.selisih_gross)}</td>
          <td class="text-right">${formatCurrency(item.ppn_wrc)}</td>
          <td class="text-right">${formatCurrency(item.ppn_store)}</td>
          <td class="text-right ${diffPpnClass}">${formatCurrency(item.selisih_ppn)}</td>
          <td class="text-right ${totalDiffClass}">${formatCurrency(item.selisih_gross + item.selisih_ppn)}</td>
        </tr>
      `;
    });
    
    // Close the HTML structure
    printContent += `
          </tbody>
        </table>
        
        <div class="footer">
          <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
        </div>
      </body>
      </html>
    `;
    
    // Write to the new window and print
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
      printWindow.print();
      // printWindow.close();
    };
  } catch (err) {
    console.error('Error printing data:', err);
    toast.add({
      severity: 'error',
      summary: 'Cetak Gagal',
      detail: 'Terjadi kesalahan saat mencetak data',
      life: 3000
    });
  }
};
</script>

<style scoped>
.search-container {
  margin-bottom: 1rem;
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
}

.search-form {
  flex: 1;
  display: flex;
  align-items: center;
}

.search-box {
  position: relative;
  width: 100%;
  background-color: #fff;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--primary-color);
  font-size: 0.9rem;
}

.search-input {
  width: 100%;
  padding: 12px 40px 12px 40px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s ease;
  background-color: transparent;
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



.same-amount {
  color: #61CE70;
  font-weight: 600;
  position: relative;
}

.same-amount::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #40894A;
  border-radius: 1px;
}

.different-amount {
  color: #e74c3c;
  font-weight: 600;
  position: relative;
}

.different-amount::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: rgba(231, 76, 60, 0.3);
  border-radius: 1px;
}

:deep(.has-diff) {
  background-color: rgba(255, 248, 225, 0.7);
}

:deep(.has-diff:hover) {
  background-color: rgba(255, 236, 179, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

:deep(.results-table) {
  width: 100%;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

:deep(.results-table th) {
  position: sticky;
  top: 0;
  z-index: 10;
  /* Stronger shadow for better visibility during scroll */
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.15);
  background: linear-gradient(to bottom, #f8f9fa, #f1f3f5);
  color: #37474f;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  border-bottom: 2px solid #cfd8dc;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  padding: 0.85rem 1rem;
}

:deep(.results-table td) {
  transition: all 0.2s ease;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  vertical-align: middle;
  min-width: 100px;
  max-width: 300px;
  white-space: nowrap;
}

:deep(.text-right) {
  font-family: 'Roboto Mono', monospace, sans-serif;
  font-size: 0.85rem;
  text-align: right;
}
</style>

