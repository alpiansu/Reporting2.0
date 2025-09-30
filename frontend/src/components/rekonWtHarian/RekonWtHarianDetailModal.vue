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
                      <th>Toko</th>
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
                      <td>{{ item.toko || '-' }}</td>
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
@import './RekonWtHarianDetailModal.css';
</style>