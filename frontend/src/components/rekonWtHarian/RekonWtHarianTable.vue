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
    :tableTitle="'Detail Transaksi'"
    :rowClass="getRowClass"
    @refresh="$emit('refresh')"
    @reset-filters="resetFilters"
    @export="exportToExcel"
    @print="printResults"
  >
    <!-- Filters -->
    <template #filters>
      <FilterGroup label="Nama Toko" icon="pi-shopping-bag" id="toko-filter">
        <input type="text" id="toko-filter" v-model="filters.toko" @input="applyFilters"
          placeholder="Cari berdasarkan nama toko" class="filter-control" />
      </FilterGroup>

      <FilterGroup label="Tanggal Transaksi" icon="pi-calendar" id="tanggal-filter">
        <input type="date" id="tanggal-filter" v-model="filters.tgl1" @change="applyFilters"
          class="filter-control" :max="today" />
      </FilterGroup>
    </template>

    <!-- Table Header -->
    <template #table-header>
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
      <th class="text-right">Gross Idm WRC</th>
      <th class="text-right">Gross Idm Toko</th>
      <th class="text-right">Selisih Gross Idm</th>
      <th class="text-right">PPN Idm WRC</th>
      <th class="text-right">PPN Idm Toko</th>
      <th class="text-right">Selisih PPN Idm</th>
    </template>

    <!-- Table Row -->
    <template #table-row="{ item, index }">
      <td>{{ item.cab }}</td>
      <td>{{ formatDate(item.tgl1) }}</td>
      <td>{{ item.shop }}</td>
      <td>{{ item.tipe }}</td>
      <td class="text-right">{{ formatCurrency(item.gross_wrc) }}</td>
      <td class="text-right">{{ formatCurrency(item.gross_store) }}</td>
      <td class="text-right" :class="getAmountClass(item.selisih_gross)">
        {{ formatCurrency(item.selisih_gross) }}
      </td>
      <td class="text-right">{{ formatCurrency(item.ppn_wrc) }}</td>
      <td class="text-right">{{ formatCurrency(item.ppn_store) }}</td>
      <td class="text-right" :class="getAmountClass(item.selisih_ppn)">
        {{ formatCurrencyDecimal(item.selisih_ppn) }}
      </td>
      <td class="text-right">{{ formatCurrency(item.gross_idm_wrc) }}</td>
      <td class="text-right">{{ formatCurrency(item.gross_idm_store) }}</td>
      <td class="text-right" :class="getAmountClass(item.selisih_gross_idm)">
        {{ formatCurrency(item.selisih_gross_idm) }}
      </td>
      <td class="text-right">{{ formatCurrency(item.ppn_idm_wrc) }}</td>
      <td class="text-right">{{ formatCurrency(item.ppn_idm_store) }}</td>
      <td class="text-right" :class="getAmountClass(item.selisih_ppn_idm)">
        {{ formatCurrencyDecimal(item.selisih_ppn_idm) }}
      </td>
    </template>
  </DataTable>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';
import FilterGroup from '../common/FilterGroup.vue';

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
  }
});

const emit = defineEmits(['refresh']);
const toast = useToastService();

// Tanggal hari ini untuk batasan input tanggal
const today = ref(new Date().toISOString().split('T')[0]); // Format YYYY-MM-DD untuk input type="date"

// Filters
const filters = ref({
  tipe: '',
  toko: '',
  tgl1: ''
});

// Computed properties
const filteredData = computed(() => {
  let filtered = [...props.data];
  
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

// Methods
const applyFilters = () => {
  // Filters are applied automatically through the computed property
};

const resetFilters = () => {
  filters.value = {
    tipe: '',
    toko: '',
    tgl1: ''
  };
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

const getAmountClass = (amount) => {
  if (!amount) return '';
  return amount > 5 || amount < -5 ? 'different-amount' : 'same-amount';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '-';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatCurrencyDecimal = (amount) => {
  if (amount === undefined || amount === null) return '-';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
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

// Export to Excel function
const exportToExcel = () => {
  if (!filteredData.value.length) {
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
      'No', 'Tanggal', 'Shop', 'Tipe', 
      'Gross WRC', 'Gross Toko', 'Selisih Gross',
      'PPN WRC', 'PPN Toko', 'Selisih PPN',
      'Total Selisih'
    ];
    
    // Prepare data rows
    const data = filteredData.value.map((item, index) => [
      index + 1,
      formatDate(item.tgl1),
      item.shop,
      item.tipe,
      item.gross_wrc,
      item.gross_store,
      item.selisih_gross,
      item.ppn_wrc,
      item.ppn_store,
      item.selisih_ppn,
      item.selisih_gross + item.selisih_ppn
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
  if (!filteredData.value.length) {
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
    filteredData.value.forEach((item, index) => {
      const diffGrossClass = item.selisih_gross !== 0 ? 'different-amount' : '';
      const diffPpnClass = item.selisih_ppn !== 0 ? 'different-amount' : '';
      const totalDiffClass = (item.selisih_gross + item.selisih_ppn) !== 0 ? 'different-amount' : '';
      
      printContent += `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${formatDate(item.tgl1)}</td>
          <td>${item.toko}</td>
          <td>${item.tipe}</td>
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

