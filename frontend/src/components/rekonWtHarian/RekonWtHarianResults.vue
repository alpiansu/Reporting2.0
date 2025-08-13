<template>
  <div class="results-container">
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p>Memuat data rekonsiliasi...</p>
      <p class="help-text">Mohon tunggu sebentar...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #e74c3c;"></i>
      <p>{{ error }}</p>
      <button @click="loadResults" class="btn btn-secondary">
        <i class="pi pi-refresh"></i> Coba Lagi
      </button>
    </div>

    <div v-else-if="!results.length && !loading" class="empty-state">
      <i class="pi pi-info-circle" style="font-size: 2rem; color: #3498db;"></i>
      <p>Tidak ada data rekonsiliasi untuk ditampilkan.</p>
      <p class="help-text">Tidak ditemukan data rekonsiliasi untuk cabang dan periode yang dipilih.</p>
    </div>

    <div v-else class="results-content">
      <!-- Summary Card -->
      <RekonSummaryCard 
        v-if="summary" 
        :summary="summary" 
        :periode="periode" 
        :cab="cab"
      />

      <!-- Filters -->
      <div class="filters-container">
        <div class="filters-header">
          <h3 class="filters-title">
            <i class="pi pi-filter"></i> Filter Data
          </h3>
          <button @click="resetFilters" class="btn btn-secondary btn-sm">
            <i class="pi pi-filter-slash"></i> Reset
          </button>
        </div>
        
        <div class="filters-body">
          <div class="filter-group">
            <label for="tipe-filter">Tipe Transaksi</label>
            <div class="filter-input-wrapper">
              <i class="pi pi-tag filter-icon"></i>
              <select 
                id="tipe-filter" 
                v-model="filters.tipe" 
                @change="applyFilters"
                class="filter-control"
              >
                <option value="">Semua Tipe</option>
                <option value="TUNAI">TUNAI</option>
                <option value="NON TUNAI">NON TUNAI</option>
              </select>
            </div>
          </div>

          <div class="filter-group">
            <label for="toko-filter">Nama Toko</label>
            <div class="filter-input-wrapper">
              <i class="pi pi-shopping-bag filter-icon"></i>
              <input 
                type="text" 
                id="toko-filter" 
                v-model="filters.toko" 
                @input="applyFilters"
                placeholder="Cari berdasarkan nama toko"
                class="filter-control"
              />
            </div>
          </div>

          <div class="filter-group">
            <label for="tanggal-filter">Tanggal Transaksi</label>
            <div class="filter-input-wrapper">
              <i class="pi pi-calendar filter-icon"></i>
              <input 
                type="date" 
                id="tanggal-filter" 
                v-model="filters.tgl1" 
                @change="applyFilters"
                class="filter-control"
                :max="today"
              />
            </div>
          </div>
          
          <div class="filter-stats">
            <div class="filter-stat-item">
              <span class="filter-stat-label">Total Data:</span>
              <span class="filter-stat-value">{{ filteredResults.length }}</span>
            </div>
            <div class="filter-stat-item" v-if="filteredResults.length !== results.length">
              <span class="filter-stat-label">Terfilter:</span>
              <span class="filter-stat-value">{{ results.length - filteredResults.length }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Table -->
      <div class="table-container">
        <div class="table-header">
          <h3 class="table-title">Detail Transaksi</h3>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" @click="exportToExcel" title="Ekspor ke Excel">
              <i class="pi pi-file-excel"></i> Ekspor Data
            </button>
            <button class="btn btn-secondary btn-sm" @click="printResults" title="Cetak hasil">
              <i class="pi pi-print"></i> Cetak
            </button>
          </div>
        </div>
        
        <div class="table-responsive">
          <table class="results-table">
            <thead>
              <tr>
                <th class="text-center">No</th>
                <th>Tanggal</th>
                <th>Toko</th>
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
              <tr v-for="(item, index) in paginatedResults" :key="index" :class="{ 'has-diff': hasDifference(item) }">
                <td class="text-center">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                <td>{{ formatDate(item.tgl1) }}</td>
                <td>{{ item.toko }}</td>
                <td>
                  <span class="badge" :class="item.tipe === 'TUNAI' ? 'badge-cash' : 'badge-non-cash'">
                    {{ item.tipe }}
                  </span>
                </td>
                <td class="text-right">{{ formatCurrency(item.grossWrc) }}</td>
                <td class="text-right">{{ formatCurrency(item.grossToko) }}</td>
                <td class="text-right" :class="getAmountClass(item.diffGross)">
                  {{ formatCurrency(item.diffGross) }}
                </td>
                <td class="text-right">{{ formatCurrency(item.ppnWrc) }}</td>
                <td class="text-right">{{ formatCurrency(item.ppnToko) }}</td>
                <td class="text-right" :class="getAmountClass(item.diffPpn)">
                  {{ formatCurrency(item.diffPpn) }}
                </td>
                <td class="text-right" :class="getAmountClass(item.diffGross + item.diffPpn)">
                  {{ formatCurrency(item.diffGross + item.diffPpn) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination-container" v-if="totalPages > 0">
        <div class="pagination-info">
          <span class="records-info">Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ filteredResults.length }} data</span>
        </div>
        
        <div class="pagination-controls">
          <button 
            @click="() => currentPage = 1" 
            :disabled="currentPage === 1"
            class="btn btn-icon"
            title="Halaman pertama"
          >
            <i class="pi pi-angle-double-left"></i>
          </button>
          
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1"
            class="btn btn-icon"
            title="Halaman sebelumnya"
          >
            <i class="pi pi-angle-left"></i>
          </button>
          
          <div class="page-numbers">
            <template v-for="pageNum in displayedPageNumbers" :key="pageNum">
              <button 
                v-if="pageNum !== '...'"
                @click="currentPage = pageNum" 
                :class="['btn', 'btn-page', currentPage === pageNum ? 'btn-active' : '']"
              >
                {{ pageNum }}
              </button>
              <span v-else class="ellipsis">...</span>
            </template>
          </div>
          
          <button 
            @click="nextPage" 
            :disabled="currentPage === totalPages"
            class="btn btn-icon"
            title="Halaman selanjutnya"
          >
            <i class="pi pi-angle-right"></i>
          </button>
          
          <button 
            @click="() => currentPage = totalPages" 
            :disabled="currentPage === totalPages"
            class="btn btn-icon"
            title="Halaman terakhir"
          >
            <i class="pi pi-angle-double-right"></i>
          </button>
        </div>
        
        <div class="items-per-page">
          <label for="items-per-page-select">Per halaman:</label>
          <select 
            id="items-per-page-select"
            v-model="itemsPerPage"
            @change="currentPage = 1"
            class="items-select"
          >
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions-section">
        <button @click="loadResults" class="btn btn-secondary">
          <i class="pi pi-refresh"></i> Refresh Data
        </button>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToastService } from '../../utils/toast';
import { rekonWtHarianService } from '../../services';
import RekonSummaryCard from './RekonSummaryCard.vue';

const props = defineProps({
  cab: {
    type: String,
    required: true
  },
  periode: {
    type: String,
    required: true
  },
  autoLoad: {
    type: Boolean,
    default: true
  }
});

const toast = useToastService();

// State
const loading = ref(false);
const error = ref(null);
const results = ref([]);
const summary = ref(null);
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Tanggal hari ini untuk batasan input tanggal
const today = ref(new Date().toISOString().split('T')[0]); // Format YYYY-MM-DD untuk input type="date"

// Filters
const filters = ref({
  tipe: '',
  toko: '',
  tgl1: ''
});

// Computed properties
const filteredResults = computed(() => {
  let filtered = [...results.value];
  
  if (filters.value.tipe) {
    filtered = filtered.filter(item => item.tipe === filters.value.tipe);
  }
  
  if (filters.value.toko) {
    filtered = filtered.filter(item => 
      item.toko.toLowerCase().includes(filters.value.toko.toLowerCase())
    );
  }
  
  if (filters.value.tgl1) {
    const filterDate = new Date(filters.value.tgl1).toISOString().split('T')[0];
    filtered = filtered.filter(item => {
      const itemDate = new Date(item.tgl1).toISOString().split('T')[0];
      return itemDate === filterDate;
    });
  }
  
  return filtered;
});

const totalPages = computed(() => {
  return Math.ceil(filteredResults.value.length / itemsPerPage.value);
});

const startIndex = computed(() => {
  return (currentPage.value - 1) * itemsPerPage.value;
});

const endIndex = computed(() => {
  return Math.min(startIndex.value + itemsPerPage.value, filteredResults.value.length);
});

const paginatedResults = computed(() => {
  return filteredResults.value.slice(startIndex.value, endIndex.value);
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
const loadResults = async () => {
  // Hanya memeriksa periode, karena cabang bisa kosong (untuk semua cabang)
  if (!props.periode) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    // Load results
    const resultsResponse = await rekonWtHarianService.getResults(
      props.cab, 
      props.periode
    );
    console.log('Results response:', resultsResponse);
    results.value = resultsResponse.data.data || [];
    
    // Log additional info for debugging
    console.log(`Loaded ${results.value.length} results for cab: ${props.cab || 'All'}, periode: ${props.periode}`);
    
    // Load summary
    const summaryResponse = await rekonWtHarianService.getSummary(
      props.cab, 
      props.periode
    );
    console.log('Summary response:', summaryResponse);
    summary.value = summaryResponse.data.data;
    
    // Log additional info for debugging
    console.log(`Loaded summary for cab: ${props.cab || 'All'}, periode: ${props.periode}`, summary.value);
    
    // Reset to first page when loading new data
    currentPage.value = 1;
  } catch (err) {
    console.error('Error loading reconciliation data:', err);
    error.value = 'Terjadi kesalahan saat memuat data rekonsiliasi';
    
    if (err.response?.data?.message) {
      error.value = err.response.data.message;
    }
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  // Reset to first page when applying filters
  currentPage.value = 1;
};

const resetFilters = () => {
  filters.value = {
    tipe: '',
    toko: '',
    tgl1: ''
  };
  currentPage.value = 1;
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

// Export to Excel function
const exportToExcel = () => {
  if (!filteredResults.value.length) {
    toast.add({
      severity: 'warn',
      summary: 'Ekspor Gagal',
      detail: 'Tidak ada data untuk diekspor',
      life: 3000
    });
    return;
  }
  
  try {
    // Create a workbook with a worksheet
    const workbook = {
      SheetNames: ['Rekonsiliasi WT'],
      Sheets: {}
    };
    
    // Prepare headers
    const headers = [
      'No', 'Tanggal', 'Toko', 'Tipe', 
      'Gross WRC', 'Gross Toko', 'Selisih Gross',
      'PPN WRC', 'PPN Toko', 'Selisih PPN',
      'Total Selisih'
    ];
    
    // Prepare data rows
    const data = filteredResults.value.map((item, index) => [
      index + 1,
      formatDate(item.tgl1),
      item.toko,
      item.tipe,
      item.grossWrc,
      item.grossToko,
      item.diffGross,
      item.ppnWrc,
      item.ppnToko,
      item.diffPpn,
      item.diffGross + item.diffPpn
    ]);
    
    // Combine headers and data
    const worksheet = [headers, ...data];
    
    // Convert to CSV
    let csvContent = worksheet.map(row => row.join(',')).join('\n');
    
    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    // Use 'SEMUA CABANG' in filename if cab is 'SEMUA'
    const cabDisplay = props.cab === 'SEMUA' ? 'SEMUA_CABANG' : props.cab;
    link.setAttribute('download', `Rekonsiliasi_WT_${cabDisplay}_${props.periode}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.add({
      severity: 'success',
      summary: 'Ekspor Berhasil',
      detail: 'Data berhasil diekspor ke CSV',
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

// Print function
const printResults = () => {
  if (!filteredResults.value.length) {
    toast.add({
      severity: 'warn',
      summary: 'Cetak Gagal',
      detail: 'Tidak ada data untuk dicetak',
      life: 3000
    });
    return;
  }
  
  try {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      toast.add({
        severity: 'error',
        summary: 'Cetak Gagal',
        detail: 'Popup diblokir oleh browser. Mohon izinkan popup untuk mencetak.',
        life: 5000
      });
      return;
    }
    
    // Generate HTML content for printing
    let printContent = `
      <!DOCTYPE html>
      <html>
      <head>
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
          .positive-amount { color: #e74c3c; }
          .negative-amount { color: #2ecc71; }
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
        
        <h2>Ringkasan</h2>
        <div class="summary">
          <div class="summary-item"><strong>Jumlah Toko:</strong> ${summary.value?.jml_toko || 0}</div>
          <div class="summary-item"><strong>Selisih Gross:</strong> ${formatCurrency(summary.value?.sel_gross || 0)}</div>
          <div class="summary-item"><strong>Selisih PPN:</strong> ${formatCurrency(summary.value?.sel_ppn || 0)}</div>
          <div class="summary-item"><strong>Selisih Total:</strong> ${formatCurrency((summary.value?.sel_gross || 0) + (summary.value?.sel_ppn || 0))}</div>
          <div class="summary-item"><strong>Selisih Gross IDM:</strong> ${formatCurrency(summary.value?.sel_gross_idm || 0)}</div>
          <div class="summary-item"><strong>Selisih PPN IDM:</strong> ${formatCurrency(summary.value?.sel_ppn_idm || 0)}</div>
          <div class="summary-item"><strong>Selisih Total IDM:</strong> ${formatCurrency((summary.value?.sel_gross_idm || 0) + (summary.value?.sel_ppn_idm || 0))}</div>
        </div>
        
        <h2>Detail Transaksi</h2>
        <table>
          <thead>
            <tr>
              <th class="text-center">No</th>
              <th>Tanggal</th>
              <th>Toko</th>
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
    
    // Add table rows
    filteredResults.value.forEach((item, index) => {
      const diffGrossClass = item.diffGross > 0 ? 'positive-amount' : item.diffGross < 0 ? 'negative-amount' : '';
      const diffPpnClass = item.diffPpn > 0 ? 'positive-amount' : item.diffPpn < 0 ? 'negative-amount' : '';
      const totalDiffClass = (item.diffGross + item.diffPpn) > 0 ? 'positive-amount' : (item.diffGross + item.diffPpn) < 0 ? 'negative-amount' : '';
      
      printContent += `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${formatDate(item.tgl1)}</td>
          <td>${item.toko}</td>
          <td>${item.tipe}</td>
          <td class="text-right">${formatCurrency(item.grossWrc)}</td>
          <td class="text-right">${formatCurrency(item.grossToko)}</td>
          <td class="text-right ${diffGrossClass}">${formatCurrency(item.diffGross)}</td>
          <td class="text-right">${formatCurrency(item.ppnWrc)}</td>
          <td class="text-right">${formatCurrency(item.ppnToko)}</td>
          <td class="text-right ${diffPpnClass}">${formatCurrency(item.diffPpn)}</td>
          <td class="text-right ${totalDiffClass}">${formatCurrency(item.diffGross + item.diffPpn)}</td>
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
    
    toast.add({
      severity: 'success',
      summary: 'Cetak Berhasil',
      detail: 'Halaman cetak telah dibuka',
      life: 3000
    });
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

// Utility functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

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

const getAmountClass = (amount) => {
  if (!amount) return '';
  return amount < 0 ? 'negative-amount' : amount > 0 ? 'positive-amount' : '';
};

const hasDifference = (item) => {
  return item.diffGross !== 0 || item.diffPpn !== 0;
};

// Watch for changes in props
watch(
  () => [props.cab, props.periode],
  () => {
    if (props.autoLoad) {
      loadResults();
    }
  },
  { immediate: props.autoLoad }
);

// Expose methods to parent component
defineExpose({
  loadResults,
  resetFilters,
  exportToExcel,
  printResults
});
</script>

<style scoped>
/* Container */
.results-container {
  padding: 0 0;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background-color: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 1.5rem;
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

.results-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Summary Card */
/* Summary card styles moved to RekonSummaryCard.vue */

/* Filters */
.filters-container {
  margin-bottom: 1.5rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.filters-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--primary-color);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-body {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  min-width: 220px;
  flex: 1;
}

.filter-group label {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: #555;
  font-weight: 500;
}

.filter-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-icon {
  position: absolute;
  left: 0.75rem;
  color: #666;
  font-size: 0.875rem;
  transition: color 0.3s ease;
}

.filter-input-wrapper:hover .filter-icon {
  color: #555;
}

.filter-input-wrapper:focus-within .filter-icon {
  color: var(--primary-color);
}

.filter-control {
  padding: 0.625rem 0.75rem 0.625rem 2.25rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 100%;
  transition: all 0.3s ease;
  background-color: #f9f9f9;
}

.filter-control:hover {
  border-color: #bbb;
  background-color: #fff;
}

.filter-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
  background-color: #fff;
}

.filter-stats {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed #eee;
  width: 100%;
}

.filter-stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-stat-label {
  font-size: 0.875rem;
  color: #666;
}

.filter-stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
  background-color: #f5f5f5;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  border: 1px solid #eee;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.filters-container:hover .filter-stat-value {
  background-color: var(--primary-light);
  color: var(--primary-color-darken);
  border-color: rgba(var(--primary-color-rgb), 0.2);
  box-shadow: 0 2px 5px rgba(var(--primary-color-rgb), 0.15);
}

/* Results Table */
.table-container {
  margin-top: 1.5rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.table-container:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(to right, #f8f9fa, #f5f7fa);
  border-bottom: 1px solid #eee;
  position: relative;
}

.table-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(to right, rgba(var(--primary-color-rgb), 0.1), rgba(var(--primary-color-rgb), 0.3), rgba(var(--primary-color-rgb), 0.1));
}

.table-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--primary-color);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.table-title::before {
  content: '\f0ce'; /* pi-table icon */
  font-family: 'primeicons';
  font-size: 1rem;
  color: var(--primary-color);
  opacity: 0.8;
}

.table-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: #f8f9fa;
  color: #555;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-sm:hover {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(var(--primary-color-rgb), 0.3);
}

.btn-sm:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(var(--primary-color-rgb), 0.3);
}

.btn-sm i {
  transition: transform 0.3s ease;
}

.btn-sm:hover i {
  transform: scale(1.2);
}

.table-responsive {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  background-color: #fff;
  font-size: 0.875rem;
}

.results-table th,
.results-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.results-table th {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 10;
}

.results-table tbody tr {
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.results-table tbody tr:hover {
  background-color: #f5f9ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 1;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 80px;
}

.results-table tr:hover .badge {
  transform: scale(1.05);
}

.badge-cash {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid rgba(25, 118, 210, 0.2);
}

.badge-cash::before {
  content: '\f3d1'; /* pi-money-bill icon */
  font-family: 'primeicons';
  margin-right: 0.25rem;
  font-size: 0.7rem;
}

.badge-non-cash {
  background-color: #e8f5e9;
  color: #388e3c;
  border: 1px solid rgba(56, 142, 60, 0.2);
}

.badge-non-cash::before {
  content: '\f3c0'; /* pi-credit-card icon */
  font-family: 'primeicons';
  margin-right: 0.25rem;
  font-size: 0.7rem;
}

.has-diff {
  background-color: rgba(255, 152, 0, 0.05);
  position: relative;
}

.positive-amount {
  color: #e74c3c;
  font-weight: 600;
  text-shadow: 0 0 1px rgba(231, 76, 60, 0.2);
}

.negative-amount {
  color: #2ecc71;
  font-weight: 600;
  text-shadow: 0 0 1px rgba(46, 204, 113, 0.2);
}

/* Highlight row with differences */
.has-diff td {
  position: relative;
}

.has-diff:hover {
  background-color: rgba(255, 152, 0, 0.1);
}

/* Add a subtle left border to highlight rows with differences */
.has-diff td:first-child::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #ff9800;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 0 8px rgba(255, 152, 0, 0.4);
}

/* Add a subtle indicator for rows with differences */
.has-diff td:last-child::after {
  content: '\f0e7'; /* pi-exclamation-triangle icon */
  font-family: 'primeicons';
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: #ff9800;
  font-size: 0.75rem;
  opacity: 0.6;
}

.has-diff:hover td:last-child::after {
  opacity: 1;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: translateY(-50%) scale(1);
  }
  50% {
    transform: translateY(-50%) scale(1.2);
  }
  100% {
    transform: translateY(-50%) scale(1);
  }
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding: 1rem 1.5rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  border-bottom: 3px solid transparent;
}

.pagination-container:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  border-bottom: 3px solid var(--primary-color);
}

.pagination-info {
  font-size: 0.875rem;
  color: #666;
}

.records-info {
  padding: 0.375rem 0.75rem;
  background-color: #f5f5f5;
  border-radius: 20px;
  font-weight: 500;
  border: 1px solid #eee;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.records-info::before {
  content: '\f0ce'; /* pi-table icon */
  font-family: 'primeicons';
  font-size: 0.75rem;
  color: var(--primary-color);
  opacity: 0.8;
}

.pagination-container:hover .records-info {
  background-color: var(--primary-light);
  color: var(--primary-color-darken);
  border-color: rgba(var(--primary-color-rgb), 0.2);
  box-shadow: 0 2px 5px rgba(var(--primary-color-rgb), 0.15);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.btn-icon:hover:not(:disabled) {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(var(--primary-color-rgb), 0.3);
}

.btn-icon:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(var(--primary-color-rgb), 0.3);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon i {
  transition: transform 0.3s ease;
}

.btn-icon:hover:not(:disabled) i {
  transform: scale(1.2);
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0 0.5rem;
}

.btn-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  border-radius: 4px;
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0 0.5rem;
  position: relative;
  overflow: hidden;
}

.btn-page:hover:not(.btn-active) {
  background-color: #e9ecef;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  border-color: #ccc;
}

.btn-page:hover:not(.btn-active)::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(var(--primary-color-rgb), 0.05);
  pointer-events: none;
}

.btn-active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 2px 5px rgba(var(--primary-color-rgb), 0.3);
  font-weight: 600;
}

.ellipsis {
  margin: 0 0.25rem;
  color: #666;
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
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

.btn-danger {
  background-color: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background-color: #c0392b;
}

.btn:disabled {
  background-color: #b0bec5;
  cursor: not-allowed;
}

/* Confirmation Dialog */
.confirm-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
}

.dialog-title {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #e74c3c;
}

.dialog-message {
  margin-bottom: 1.5rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

@media (max-width: 768px) {
  .summary-stats {
    grid-template-columns: 1fr 1fr;
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .pagination-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .actions-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .btn {
    width: 100%;
  }
}
</style>