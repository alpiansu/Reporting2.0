<template>
  <DataTable :data="data" :filteredData="filteredData" :loading="loading" :error="error"
    :loadingMessage="'Memuat data rekonsiliasi...'" :loadingHelpText="'Mohon tunggu sebentar...'"
    :emptyMessage="'Tidak ada data rekonsiliasi untuk ditampilkan.'"
    :emptyHelpText="'Tidak ditemukan data rekonsiliasi untuk cabang dan periode yang dipilih.'"
    :pagination="pagination"
    :tableTitle="'Detail Transaksi'" :rowClass="getRowClass" @refresh="$emit('refresh')" @reset-filters="resetFilters"
    @export="exportToExcel" @page-change="handlePageChange"
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
      <th class="text-center sortable" :class="{ 'sort-asc': sortColumn === 'status' && sortOrder === 'asc', 'sort-desc': sortColumn === 'status' && sortOrder === 'desc' }" @click="handleSort('status')">
        Status
        <i v-if="sortColumn === 'status'" class="pi sort-icon" :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'"></i>
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
        <span 
          class="badge" 
          :class="getStatusBadgeClass(item.status)"
          :title="item.status || 'Tidak ada data'"
        >
          {{ getStatusText(item.status) }}
        </span>
      </td>
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
  // Data received
}, { immediate: true, deep: true });

watch(() => props.pagination, (newPagination) => {
  // Pagination received
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
      } else {
        // Shop data not found after refresh - means data is now clean/empty
        // Remove this shop from the table
        emit('shop-removed', {
          cab,
          shop
        });
        
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
      
      toast.showInfo(
        'Data Bersih',
        `Toko ${shop} tidak memiliki selisih lagi setelah refresh.`,
        3000
      );
    }
  } catch (error) {
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

// Get status badge class
const getStatusBadgeClass = (status) => {
  if (!status) return 'badge-danger';
  
  // Jika status mengandung [kdtk] berarti sukses (hijau)
  if (status.includes('[') && status.includes(']')) {
    return 'badge-success';
  }
  
  // Selain itu gagal (merah)
  return 'badge-danger';
};

// Get status text
const getStatusText = (status) => {
  if (!status) return 'Tidak ada data';
  
  // Jika status mengandung [kdtk] berarti sukses, ambil kalimat setelah [kdtk]
  if (status.includes('[') && status.includes(']')) {
    const closingBracketIndex = status.lastIndexOf(']');
    if (closingBracketIndex < status.length - 1) {
      // Ada teks setelah ], ambil teks tersebut dan trim whitespace
      const textAfter = status.substring(closingBracketIndex + 1).trim();
      return textAfter || 'Berhasil';
    }
    return 'Berhasil';
  }
  
  // Selain itu gagal, return teks apa adanya
  return status;
};

// Export to Excel
const exportToExcel = async () => {
  try {
    // Prepare data for export
    const exportData = filteredData.value.map((item, index) => ({
      'No': index + 1,
      'Cab': item.cab,
      'Shop': item.shop,
      'Tipe': item.tipe,
      'Gross WRC': item.gross_wrc,
      'Gross Toko': item.gross_store,
      'Selisih Gross': item.selisih_gross,
      'PPN WRC': item.ppn_wrc,
      'PPN Toko': item.ppn_store,
      'Selisih PPN': item.selisih_ppn,
      'Total Selisih': item.selisih_gross + item.selisih_ppn,
      'Status': getStatusText(item.status),
      'Update Time': item.updtime ? formatDateTime(item.updtime) : '-'
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekonsiliasi WT Harian');
    
    // Generate filename
    const filename = `rekonsiliasi_wt_harian_${props.cab}_${props.periode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, filename);
    
    toast.showSuccess(
      'Ekspor Berhasil',
      'Data berhasil diekspor ke Excel',
      3000
    );
  } catch (err) {
    console.error('Export error:', err);
    toast.showError(
      'Ekspor Gagal',
      'Terjadi kesalahan saat mengekspor data',
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
@import './RekonWtHarianTable.css';
</style>

