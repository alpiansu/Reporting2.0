<template>
  <div>
    <!-- Modal Backdrop -->
    <div v-if="show" class="modal-backdrop" @click="$emit('close')"></div>
    
    <!-- Modal -->
    <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="pi pi-list"></i> Detail Data Rekonsiliasi
            </h5>
            <button type="button" class="modal-close" @click="$emit('close')">
              <i class="pi pi-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Header Information -->
            <div class="detail-header">
              <div class="detail-info-grid">
                <div class="detail-info-item">
                  <span class="detail-label">Periode:</span>
                  <span class="detail-value">{{ formatPeriode(periode) }}</span>
                </div>
                <div class="detail-info-item">
                  <span class="detail-label">Cabang:</span>
                  <span class="detail-value">{{ cab }}</span>
                </div>
                <div class="detail-info-item">
                  <span class="detail-label">Toko:</span>
                  <span class="detail-value">{{ toko }}{{ storeName ? ` - ${storeName}` : '' }}</span>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
              <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
              <p>Memuat detail data...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-state">
              <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #e74c3c;"></i>
              <p>{{ error }}</p>
              <button @click="loadDetailData" class="btn btn-refresh">
                <i class="pi pi-refresh"></i> Coba Lagi
              </button>
            </div>

            <!-- Empty State -->
            <div v-else-if="!detailData.length && !loading" class="empty-state">
              <i class="pi pi-info-circle" style="font-size: 2rem; color: #3498db;"></i>
              <p>Tidak ada detail data untuk ditampilkan</p>
            </div>

            <!-- Data Table -->
            <div v-else class="detail-table-container">
              <div class="table-header">
                <h4 class="table-title">
                  <i class="pi pi-table"></i> Detail Transaksi
                </h4>
                <div class="table-controls">
                  <div class="search-container">
                    <div class="search-box">
                      <i class="pi pi-search search-icon"></i>
                      <input 
                        type="text" 
                        v-model="searchQuery" 
                        placeholder="Cari data transaksi..." 
                        class="search-input"
                      >
                      <button 
                        v-if="searchQuery" 
                        @click="clearSearch" 
                        class="clear-search-btn"
                        title="Hapus pencarian"
                      >
                        <i class="pi pi-times"></i>
                      </button>
                    </div>
                  </div>
                  <div class="table-stats">
                    <span class="stat-item">
                      <i class="pi pi-list"></i>
                      <span v-if="searchQuery">
                        {{ filteredData.length }} dari {{ totalRecords }} record
                      </span>
                      <span v-else>
                        Total: {{ totalRecords }} record
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div class="table-responsive">
                <table class="detail-table">
                  <thead>
                    <tr>
                      <th class="text-center">No</th>
                      <th>Tanggal</th>
                      <th>Tipe</th>
                      <th>Shop</th>
                      <th class="text-right">Gross WRC</th>
                      <th class="text-right">PPN WRC</th>
                      <th class="text-right">Gross IDM WRC</th>
                      <th class="text-right">PPN IDM WRC</th>
                      <th class="text-right">Gross Store</th>
                      <th class="text-right">PPN Store</th>
                      <th class="text-right">Gross IDM Store</th>
                      <th class="text-right">PPN IDM Store</th>
                      <th class="text-right">Selisih Gross</th>
                      <th class="text-right">Selisih PPN</th>
                      <th class="text-right">Selisih Gross IDM</th>
                      <th class="text-right">Selisih PPN IDM</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in paginatedData" :key="index">
                      <td class="text-center">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                      <td>{{ formatDate(item.tgl1) }}</td>
                      <td>{{ item.tipe || '-' }}</td>
                      <td>{{ item.shop || '-' }}{{ getStoreNameByCode(item.shop) ? ` - ${getStoreNameByCode(item.shop)}` : '' }}</td>
                      <td class="text-right">{{ formatCurrency(item.gross_wrc) }}</td>
                      <td class="text-right">{{ formatCurrency(item.ppn_wrc) }}</td>
                      <td class="text-right">{{ formatCurrency(item.gross_idm_wrc) }}</td>
                      <td class="text-right">{{ formatCurrency(item.ppn_idm_wrc) }}</td>
                      <td class="text-right">{{ formatCurrency(item.gross_store) }}</td>
                      <td class="text-right">{{ formatCurrency(item.ppn_store) }}</td>
                      <td class="text-right">{{ formatCurrency(item.gross_idm_store) }}</td>
                      <td class="text-right">{{ formatCurrency(item.ppn_idm_store) }}</td>
                      <td class="text-right difference-cell" :style="getDifferenceStyle(item.selisih_gross)">{{ formatCurrency(item.selisih_gross) }}</td>
                      <td class="text-right difference-cell" :style="getDifferenceStyle(item.selisih_ppn)">{{ formatCurrency(item.selisih_ppn) }}</td>
                      <td class="text-right difference-cell" :style="getDifferenceStyle(item.selisih_gross_idm)">{{ formatCurrency(item.selisih_gross_idm) }}</td>
                      <td class="text-right difference-cell" :style="getDifferenceStyle(item.selisih_ppn_idm)">{{ formatCurrency(item.selisih_ppn_idm) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div class="pagination-container" v-if="totalPages > 1">
                <div class="pagination-info">
                  <span class="records-info">
                    Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ totalRecords }} data 
                    <strong>(Halaman {{ currentPage }} dari {{ totalPages }})</strong>
                  </span>
                </div>

                <div class="pagination-controls">
                  <button @click="goToFirstPage" :disabled="currentPage === 1" class="btn btn-nav" title="Halaman pertama">
                    <i class="pi pi-angle-double-left"></i>
                  </button>
                  <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-nav" title="Halaman sebelumnya">
                    <i class="pi pi-angle-left"></i>
                  </button>
                  <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-nav" title="Halaman selanjutnya">
                    <i class="pi pi-angle-right"></i>
                  </button>
                  <button @click="goToLastPage" :disabled="currentPage === totalPages" class="btn btn-nav" title="Halaman terakhir">
                    <i class="pi pi-angle-double-right"></i>
                  </button>
                </div>

                <div class="items-per-page">
                  <label for="itemsPerPage">Data per halaman:</label>
                  <select id="itemsPerPage" v-model="itemsPerPage" @change="currentPage = 1" class="form-select-sm">
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-cancel" @click="$emit('close')">
              <i class="pi pi-times"></i> Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import rekonWtHarianService from '@/services/rekonWtHarian.service';
import storeService from '@/services/store.service';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  periode: {
    type: String,
    required: true
  },
  cab: {
    type: String,
    required: true
  },
  toko: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close']);

// Reactive data
const loading = ref(false);
const error = ref('');
const detailData = ref([]);
const currentPage = ref(1);
const itemsPerPage = ref(25);
const totalRecords = ref(0);
const searchQuery = ref('');
const storesData = ref([]);
const storeName = ref('');

// Computed properties
const filteredData = computed(() => {
  if (!searchQuery.value.trim()) {
    return detailData.value;
  }
  
  const query = searchQuery.value.toLowerCase();
  return detailData.value.filter(item => {
    return (
      (item.tgl1 && item.tgl1.toString().toLowerCase().includes(query)) ||
      (item.tipe && item.tipe.toString().toLowerCase().includes(query)) ||
      (item.shop && item.shop.toString().toLowerCase().includes(query)) ||
      (item.gross_wrc && item.gross_wrc.toString().toLowerCase().includes(query)) ||
      (item.ppn_wrc && item.ppn_wrc.toString().toLowerCase().includes(query)) ||
      (item.gross_idm_wrc && item.gross_idm_wrc.toString().toLowerCase().includes(query)) ||
      (item.ppn_idm_wrc && item.ppn_idm_wrc.toString().toLowerCase().includes(query)) ||
      (item.gross_store && item.gross_store.toString().toLowerCase().includes(query)) ||
      (item.ppn_store && item.ppn_store.toString().toLowerCase().includes(query)) ||
      (item.gross_idm_store && item.gross_idm_store.toString().toLowerCase().includes(query)) ||
      (item.ppn_idm_store && item.ppn_idm_store.toString().toLowerCase().includes(query)) ||
      (item.selisih_gross && item.selisih_gross.toString().toLowerCase().includes(query)) ||
      (item.selisih_ppn && item.selisih_ppn.toString().toLowerCase().includes(query)) ||
      (item.selisih_gross_idm && item.selisih_gross_idm.toString().toLowerCase().includes(query)) ||
      (item.selisih_ppn_idm && item.selisih_ppn_idm.toString().toLowerCase().includes(query))
    );
  });
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage.value));
const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage.value);
const endIndex = computed(() => Math.min(startIndex.value + itemsPerPage.value, filteredData.value.length));

// Function to get store name by store code
const getStoreNameByCode = (storeCode) => {
  if (!storeCode || !storesData.value.length) return '';
  const store = storesData.value.find(s => s.storeCode === storeCode);
  return store ? store.storeName : '';
};

const paginatedData = computed(() => {
  const start = startIndex.value;
  const end = start + itemsPerPage.value;
  return filteredData.value.slice(start, end);
});

// Methods
async function loadStoreData() {
  try {
    const response = await storeService.getStoresByBranch(props.cab, { limit: 1000 });
    if (response.data && Array.isArray(response.data.stores)) {
      storesData.value = response.data.stores;
      // Find store name for current toko
      const store = storesData.value.find(s => s.storeCode === props.toko);
      storeName.value = store ? store.storeName : '';
    }
  } catch (err) {
    console.error('Error loading store data:', err);
    storeName.value = '';
  }
}

async function loadDetailData() {
  if (!props.periode || !props.cab || !props.toko) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    const params = {
      page: 1,
      limit: 1000, // Load all data for client-side pagination
      sortColumn: 'tgl1',
      sortOrder: 'asc'
    };
    
    const response = await rekonWtHarianService.getResultDetail(props.periode, props.cab, props.toko, params);
    
    // Handle direct response structure from backend
    if (response.data && Array.isArray(response.data.data)) {
      detailData.value = response.data.data || [];
      totalRecords.value = response.data.total || detailData.value.length;
      currentPage.value = 1;
    } else {
      throw new Error('Format response tidak valid');
    }
  } catch (err) {
    console.error('Error loading detail data:', err);
    error.value = `Error loading detail data: ${err.response?.data?.message || err.message || 'Terjadi kesalahan saat memuat detail data'}`;
    detailData.value = [];
    totalRecords.value = 0;
  } finally {
    loading.value = false;
  }
}

function formatPeriode(periode) {
  if (!periode || periode.length !== 4) return periode;
  const year = '20' + periode.substring(0, 2);
  const month = periode.substring(2, 4);
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numValue);
}





// Pagination methods
function goToFirstPage() {
  currentPage.value = 1;
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function goToLastPage() {
  currentPage.value = totalPages.value;
}

// Search methods
function clearSearch() {
  searchQuery.value = '';
}

// Function to calculate color intensity for difference highlighting
function getDifferenceStyle(value) {
  if (value === null || value === undefined || value === '' || value === 0) {
    return {};
  }
  
  const numValue = Math.abs(parseFloat(value));
  if (isNaN(numValue)) {
    return {};
  }
  
  // Calculate intensity based on absolute value
  // You can adjust these thresholds based on your data range
  let intensity = 0;
  
  if (numValue <= 100000) {
    // Light red for small differences (0-100k)
    intensity = Math.min(numValue / 100000 * 0.3, 0.3);
  } else if (numValue <= 500000) {
    // Medium red for moderate differences (100k-500k)
    intensity = 0.3 + Math.min((numValue - 100000) / 400000 * 0.3, 0.3);
  } else if (numValue <= 1000000) {
    // Strong red for large differences (500k-1M)
    intensity = 0.6 + Math.min((numValue - 500000) / 500000 * 0.25, 0.25);
  } else {
    // Maximum red for very large differences (>1M)
    intensity = Math.min(0.85 + (numValue - 1000000) / 2000000 * 0.15, 1);
  }
  
  // Generate red background with calculated intensity
  const redValue = Math.floor(220 + (255 - 220) * intensity); // Red component (220-255)
  const greenBlueValue = Math.floor(255 * (1 - intensity)); // Green and blue components decrease with intensity
  
  const backgroundColor = `rgb(${redValue}, ${greenBlueValue}, ${greenBlueValue})`;
  const textColor = intensity > 0.5 ? '#ffffff' : '#000000'; // White text for dark backgrounds
  
  return {
    backgroundColor,
    color: textColor,
    fontWeight: intensity > 0.3 ? '600' : '500',
    transition: 'all 0.2s ease'
  };
}

// Watch for prop changes
watch(() => props.show, (newValue) => {
  if (newValue) {
    loadStoreData();
    loadDetailData();
  }
});

// Watch for search changes to reset pagination
watch(searchQuery, () => {
  currentPage.value = 1;
});

// Load data when component mounts if modal is already shown
onMounted(() => {
  if (props.show) {
    loadStoreData();
    loadDetailData();
  }
});
</script>

<style scoped>
/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1040;
  opacity: 0;
  animation: fadeIn 0.3s ease forwards;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.9);
  transition: all 0.3s ease;
}

.modal.show {
  opacity: 1;
  transform: scale(1);
}

.modal-dialog {
  width: 95%;
  max-width: 1200px;
  margin: 1rem;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.modal-dialog.modal-xl {
  max-width: 1400px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: #f8f9fa;
  flex-shrink: 0;
}

/* Detail Header Styles */
.detail-header {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

/* State Styles */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.loading-state i,
.error-state i,
.empty-state i {
  display: block;
  margin-bottom: 1rem;
}

.loading-state .pi-spinner {
  animation: smoothSpin 2s cubic-bezier(0.4, 0, 0.6, 1) infinite,
             breathe 3s ease-in-out infinite;
  color: #3b82f6;
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

@keyframes breathe {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.error-state {
  color: #dc3545;
}

/* Table Styles */
.detail-table-container {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.table-header {
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-container {
  position: relative;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  padding: 0.5rem 2.5rem 0.5rem 2.5rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  width: 250px;
  transition: all 0.3s ease;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: #6b7280;
  font-size: 0.875rem;
  pointer-events: none;
}

.clear-search-btn {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-search-btn:hover {
  color: #ef4444;
  background: #fef2f2;
}

.table-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.table-stats {
  display: flex;
  gap: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.table-responsive {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 400px; /* Set maximum height for scrollable area */
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 100%;
}

.detail-table {
  width: 100%;
  min-width: 1800px; /* Increased width to accommodate new columns and store names */
  border-collapse: collapse;
  font-size: 0.875rem;
}

.detail-table th {
  background: #f8fafc;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.detail-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}

.detail-table tbody tr:hover {
  background: #f9fafb;
}

.detail-table .text-center {
  text-align: center;
}

.detail-table .text-right {
  text-align: right;
}

/* Shop column styling for store code and name */
.detail-table th:nth-child(4),
.detail-table td:nth-child(4) {
  min-width: 200px;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Difference cell styling for highlighting */
.difference-cell {
  position: relative;
  font-weight: 500;
  border-radius: 4px;
  padding: 0.75rem 0.5rem !important;
}

.difference-cell:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

/* Pagination Styles */
.pagination-container {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.pagination-info {
  color: #6b7280;
  font-size: 0.875rem;
}

.pagination-controls {
  display: flex;
  gap: 0.5rem;
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.form-select-sm {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
}

/* Button Styles */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-nav {
  background: #f3f4f6;
  color: #374151;
  padding: 0.5rem;
  border-radius: 6px;
}

.btn-nav:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-cancel {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
}

.btn-refresh {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.btn-refresh:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-dialog {
    width: 98%;
    margin: 0.5rem;
    max-height: 95vh;
  }
  
  .detail-info-grid {
    grid-template-columns: 1fr;
  }
  
  .table-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .pagination-container {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .pagination-controls {
    justify-content: center;
  }
  
  .detail-table {
    font-size: 0.75rem;
  }
  
  .detail-table th,
  .detail-table td {
    padding: 0.5rem 0.25rem;
  }
}

@media (max-width: 480px) {
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }
  
  .detail-header {
    padding: 1rem;
  }
  
  .table-header {
    padding: 1rem;
  }
  
  .pagination-container {
    padding: 1rem;
  }
}
</style>