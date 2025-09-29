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
      <th class="text-center">Aksi</th>
    </template>

    <!-- Table Row -->
    <template #table-row="{ item }">
      <td>{{ item.cab }}</td>
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
      <td class="text-center">
        <div class="action-buttons">
          <button 
            @click="showDetailModal(item)" 
            class="btn btn-detail"
            title="Lihat Detail Data"
            :disabled="!item.record_count || item.record_count === 0"
          >
            <i class="pi pi-eye"></i>
            Detail
          </button>
          <button 
            @click="refreshShopData(item)" 
            class="btn btn-refresh"
            title="Refresh Data Rekonsiliasi"
            :disabled="refreshingShops.has(`${item.cab}_${item.shop}`) || isRefreshing"
            :class="{ 'btn-processing': refreshingShops.has(`${item.cab}_${item.shop}`) }"
          >
            <i class="pi pi-refresh" :class="{ 'pi-spin': refreshingShops.has(`${item.cab}_${item.shop}`) }"></i>
            {{ refreshingShops.has(`${item.cab}_${item.shop}`) ? '...' : 'Refresh' }}
          </button>
        </div>
      </td>
    </template>
  </DataTable>

  <!-- Detail Modal -->
  <RekonWtHarianDetailModal
    :show="detailModalVisible"
    :periode="selectedItem?.periode || periode"
    :cab="selectedItem?.cab || ''"
    :toko="selectedItem?.shop || ''"
    @close="closeDetailModal"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToastService } from '../../utils/toast';
import { rekonWtHarianService } from '../../services';
import DataTable from '../common/DataTable.vue';
import RekonWtHarianDetailModal from './RekonWtHarianDetailModal.vue';

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

const emit = defineEmits(['refresh', 'page-change', 'items-per-page-change', 'sort-change', 'shop-updated', 'shop-removed']);
const toast = useToastService();

// Modal functionality
const detailModalVisible = ref(false);
const selectedItem = ref(null);

// Search functionality
const searchQuery = ref('');
const searchTimeout = ref(null);

// Refresh functionality
const refreshingShops = ref(new Set());
const isRefreshing = ref(false);

// Highlight functionality for updated rows
const highlightedShops = ref(new Set());



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

// Refresh shop data and wait for completion with reactive update
const refreshShopData = async (item) => {
  const shopKey = `${item.cab}_${item.shop}`;
  
  try {
    // Add shop to refreshing set
    refreshingShops.value.add(shopKey);
    
    toast.showInfo(
      'Proses Dimulai',
      `Rekonsiliasi toko ${item.shop} sedang diproses. Mohon tunggu...`,
      4000
    );
    
    // Call refresh endpoint and wait for completion
    const response = await rekonWtHarianService.refreshShopReconciliation(
      props.periode, 
      item.cab, 
      item.shop
    );
    
    // Remove from refreshing set
    refreshingShops.value.delete(shopKey);
    
    if (response.data.success) {
      toast.showSuccess(
        'Proses Selesai',
        `Rekonsiliasi toko ${item.shop} telah selesai.`,
        4000
      );
      
      // Get updated data for this specific shop
      await updateShopDataReactive(item.cab, item.shop);
      
    } else {
      throw new Error(response.data.message || 'Refresh gagal');
    }
  } catch (error) {
    console.error('Error refreshing shop data:', error);
    
    // Remove from refreshing set on error
    refreshingShops.value.delete(shopKey);
    
    let errorMessage = 'Terjadi kesalahan saat refresh data';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    toast.showError(
      'Refresh Gagal',
      errorMessage,
      5000
    );
  }
};

// Update specific shop data reactively without full table refresh
const updateShopDataReactive = async (cab, shop) => {
  try {
    // Get updated summary data for this specific shop
    const response = await rekonWtHarianService.getDailyShopSummary(
      cab, 
      props.periode,
      {
        page: 1,
        limit: 1000, // Get all data to find our specific shop
        searchQuery: shop // Search for specific shop
      }
    );
    
    if (response.data && response.data.data) {
      const updatedShopData = response.data.data.find(
        shopData => shopData.cab === cab && shopData.shop === shop
      );
      
      if (updatedShopData) {
        // Add highlight effect first
        const shopKey = `${cab}_${shop}`;
        highlightedShops.value.add(shopKey);
        
        // Remove highlight after animation duration
        setTimeout(() => {
          highlightedShops.value.delete(shopKey);
        }, 2000);
        
        // Emit event to parent with updated data so parent can update its reactive data
        emit('shop-updated', {
          cab,
          shop,
          updatedData: updatedShopData
        });
        
        console.log(`Shop ${shop} data updated reactively`);
      } else {
        // Shop data not found after refresh - means data is now clean/empty
        // Remove this shop from the table
        emit('shop-removed', {
          cab,
          shop
        });
        
        console.log(`Shop ${shop} data removed - refresh result is clean`);
        
        toast.showInfo(
          'Data Bersih',
          `Toko ${shop} tidak memiliki selisih lagi setelah refresh.`,
          3000
        );
      }
    } else {
      // No data returned at all - remove the shop
      emit('shop-removed', {
        cab,
        shop
      });
      
      console.log(`Shop ${shop} data removed - no data returned`);
      
      toast.showInfo(
        'Data Bersih',
        `Toko ${shop} tidak memiliki selisih lagi setelah refresh.`,
        3000
      );
    }
  } catch (error) {
    console.error('Error updating shop data reactively:', error);
    // Fallback to full refresh if reactive update fails
    emit('refresh');
  }
};

// Get row class with highlight effect
const getRowClass = (item) => {
  const shopKey = `${item.cab}_${item.shop}`;
  const baseClass = hasDifference(item) ? 'has-diff' : '';
  const highlightClass = highlightedShops.value.has(shopKey) ? 'row-updated' : '';
  
  return [baseClass, highlightClass].filter(Boolean).join(' ');
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
    toast.showSuccess(
      'Ekspor Berhasil',
      'Data berhasil diekspor ke Excel',
      3000
    );
  } catch (err) {
    console.error('Error exporting data:', err);
    toast.showError(
      'Ekspor Gagal',
      'Terjadi kesalahan saat mengekspor data',
      3000
    );
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
    toast.showError(
      'Cetak Gagal',
      'Terjadi kesalahan saat mencetak data',
      3000
    );
  }
};

// Modal methods
const showDetailModal = (item) => {
  selectedItem.value = {
    ...item,
    periode: props.periode
  };
  detailModalVisible.value = true;
};

const closeDetailModal = () => {
  detailModalVisible.value = false;
  selectedItem.value = null;
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
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 2.5rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  font-size: 1rem;
}

.clear-button {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-button:hover {
  color: #374151;
  background: #f3f4f6;
}

/* Enhanced table styling with horizontal scroll and frozen headers */
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

.results-table {
  width: 100%;
  min-width: 1200px; /* Ensure minimum width for all columns */
  border-collapse: separate;
  border-spacing: 0;
  background-color: #fff;
  position: relative;
}

.results-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #f8f9fa;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.results-table th {
  background-color: #f8f9fa;
  color: #495057;
  font-weight: 600;
  text-align: left;
  padding: 1rem 0.75rem;
  border-bottom: 2px solid #dee2e6;
  border-right: 1px solid #dee2e6;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 5;
}

.results-table th:last-child {
  border-right: none;
  min-width: 180px; /* Ensure action column has enough space */
  width: 180px;
}

.results-table td {
  padding: 0.875rem 0.75rem;
  border-bottom: 1px solid #e9ecef;
  border-right: 1px solid #f1f3f4;
  vertical-align: middle;
  white-space: nowrap;
}

.results-table td:last-child {
  border-right: none;
  min-width: 180px; /* Match header width */
  width: 180px;
}

/* Action buttons styling */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  min-width: 160px; /* Ensure buttons don't get cramped */
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  min-width: 70px;
}

.btn-detail {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.btn-detail:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
}

.btn-detail:disabled {
  background: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.btn-refresh {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.btn-refresh:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

.btn-refresh:disabled {
  background: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.btn-processing {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  cursor: not-allowed;
  position: relative;
  overflow: hidden;
}

.btn-processing::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 1.5s ease-in-out infinite;
}

.pi-spin {
  animation: smoothSpin 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  transform-origin: center;
  display: inline-block;
}

@keyframes smoothSpin {
  0% { 
    transform: rotate(0deg);
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% { 
    transform: rotate(360deg);
    opacity: 0.8;
  }
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Enhanced loading states */
.btn-processing .pi-spin {
  animation: smoothSpin 2s cubic-bezier(0.4, 0, 0.6, 1) infinite,
             pulse 1.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  0% {
    transform: scale(1) rotate(0deg);
  }
  100% {
    transform: scale(1.1) rotate(360deg);
  }
}

/* Column width specifications for better layout */
.results-table th:nth-child(1), /* NO */
.results-table td:nth-child(1) {
  width: 60px;
  min-width: 60px;
  text-align: center;
}

.results-table th:nth-child(2), /* Cab */
.results-table td:nth-child(2) {
  width: 80px;
  min-width: 80px;
}

.results-table th:nth-child(3), /* Shop */
.results-table td:nth-child(3) {
  width: 80px;
  min-width: 80px;
}

.results-table th:nth-child(4), /* Total Selisih Gross */
.results-table td:nth-child(4) {
  width: 140px;
  min-width: 140px;
}

.results-table th:nth-child(5), /* Total Selisih PPN */
.results-table td:nth-child(5) {
  width: 140px;
  min-width: 140px;
}

.results-table th:nth-child(6), /* Total Selisih Gross IDM */
.results-table td:nth-child(6) {
  width: 160px;
  min-width: 160px;
}

.results-table th:nth-child(7), /* Total Selisih PPN IDM */
.results-table td:nth-child(7) {
  width: 160px;
  min-width: 160px;
}

.results-table th:nth-child(8), /* Jumlah Record */
.results-table td:nth-child(8) {
  width: 120px;
  min-width: 120px;
}

.results-table th:nth-child(9), /* Update Time */
.results-table td:nth-child(9) {
  width: 140px;
  min-width: 140px;
}

/* Horizontal scroll indicator */
.table-responsive::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 100%;
  background: linear-gradient(to left, rgba(0,0,0,0.1), transparent);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.table-responsive:hover::after {
  opacity: 1;
}

/* Scrollbar styling */
.table-responsive::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.table-responsive::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.table-responsive::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.table-responsive::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Row highlight animation for updated data */
.row-updated {
  background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 50%, #dcfce7 100%) !important;
  animation: highlightFade 2s ease-in-out;
  border-left: 4px solid #10b981 !important;
}

@keyframes highlightFade {
  0% {
    background: linear-gradient(90deg, #10b981 0%, #059669 50%, #10b981 100%);
    transform: scale(1.01);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }
  25% {
    background: linear-gradient(90deg, #34d399 0%, #10b981 50%, #34d399 100%);
  }
  50% {
    background: linear-gradient(90deg, #6ee7b7 0%, #34d399 50%, #6ee7b7 100%);
  }
  75% {
    background: linear-gradient(90deg, #a7f3d0 0%, #6ee7b7 50%, #a7f3d0 100%);
  }
  100% {
    background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 50%, #dcfce7 100%);
    transform: scale(1);
    box-shadow: none;
  }
}

/* Enhanced styling for rows with differences */
.has-diff {
  background-color: #fef3c7;
  border-left: 3px solid #f59e0b;
}

.has-diff.row-updated {
  /* Updated row takes precedence over difference styling */
  background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 50%, #dcfce7 100%) !important;
  border-left: 4px solid #10b981 !important;
}

/* Smooth transitions for all table rows */
tbody tr {
  transition: all 0.3s ease;
}

tbody tr:hover {
  background-color: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Ensure updated rows maintain hover effect */
.row-updated:hover {
  background: linear-gradient(90deg, #bbf7d0 0%, #a7f3d0 50%, #bbf7d0 100%) !important;
}

/* Amount styling */
.same-amount {
  color: #6b7280;
}

.different-amount {
  color: #dc2626;
  font-weight: 600;
}

/* Badge styling */
.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-info {
  background-color: #dbeafe;
  color: #1e40af;
}

/* Responsive design */
@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    gap: 1rem;
  }
  
  .search-box {
    max-width: 100%;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.375rem;
    min-width: 120px;
  }
  
  .btn {
    min-width: 100px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
  
  .results-table {
    min-width: 1000px; /* Reduced for mobile but still scrollable */
  }
  
  .results-table th,
  .results-table td {
    padding: 0.75rem 0.5rem;
    font-size: 0.85rem;
  }
  
  .results-table th:last-child,
  .results-table td:last-child {
    min-width: 140px;
    width: 140px;
  }
}

@media (max-width: 576px) {
  .action-buttons {
    min-width: 100px;
  }
  
  .btn {
    min-width: 90px;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    gap: 0.25rem;
  }
  
  .results-table {
    min-width: 900px;
  }
  
  .results-table th,
  .results-table td {
    padding: 0.6rem 0.4rem;
    font-size: 0.8rem;
  }
  
  .results-table th:last-child,
  .results-table td:last-child {
    min-width: 120px;
    width: 120px;
  }
  
  /* Compact column widths for mobile */
  .results-table th:nth-child(1),
  .results-table td:nth-child(1) {
    width: 50px;
    min-width: 50px;
  }
  
  .results-table th:nth-child(2),
  .results-table td:nth-child(2) {
    width: 70px;
    min-width: 70px;
  }
  
  .results-table th:nth-child(3),
  .results-table td:nth-child(3) {
    width: 70px;
    min-width: 70px;
  }
  
  .results-table th:nth-child(4),
  .results-table td:nth-child(4) {
    width: 120px;
    min-width: 120px;
  }
  
  .results-table th:nth-child(5),
  .results-table td:nth-child(5) {
    width: 120px;
    min-width: 120px;
  }
  
  .results-table th:nth-child(6),
  .results-table td:nth-child(6) {
    width: 140px;
    min-width: 140px;
  }
  
  .results-table th:nth-child(7),
  .results-table td:nth-child(7) {
    width: 140px;
    min-width: 140px;
  }
  
  .results-table th:nth-child(8),
  .results-table td:nth-child(8) {
    width: 100px;
    min-width: 100px;
  }
  
  .results-table th:nth-child(9),
  .results-table td:nth-child(9) {
    width: 120px;
    min-width: 120px;
  }
}

/* Print styles */
@media print {
  .action-buttons,
  .search-container {
    display: none !important;
  }
  
  .row-updated {
    background: #f0f0f0 !important;
    animation: none !important;
  }
}
</style>

