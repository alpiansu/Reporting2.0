<template>
  <BaseModalDetail :show="show" title="Detail Data Rekonsiliasi" icon="pi pi-list" size="full" @close="$emit('close')">
    <!-- Header Info Slot -->
    <template #header-info>
      <div class="dtl-info-grid">
        <div class="dtl-info-item">
          <span class="detail-label">Periode </span>
          <span class="detail-value">{{ formatPeriode(periode) }}</span>
        </div>
        <div class="dtl-info-item">
          <span class="detail-label">Cabang </span>
          <span class="detail-value">{{ cab }}</span>
        </div>
        <div class="dtl-info-item">
          <span class="detail-label">Toko </span>
          <span class="detail-value">{{ toko }}{{ storeName ? ` - ${storeName}` : '' }}</span>
        </div>
      </div>
    </template>

    <!-- Loading State Slot -->
    <template #loading-state v-if="loading">
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
        <p>Memuat detail data...</p>
      </div>
    </template>

    <!-- Error State Slot -->
    <template #error-state v-else-if="error">
      <div class="error-state">
        <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #e74c3c;"></i>
        <p>{{ error }}</p>
        <button @click="loadDetailData" class="btn btn-refresh">
          <i class="pi pi-refresh"></i> Coba Lagi
        </button>
      </div>
    </template>

    <!-- Empty State Slot -->
    <template #empty-state v-else-if="!detailData.length && !loading">
      <div class="empty-state">
        <i class="pi pi-info-circle" style="font-size: 2rem; color: #3498db;"></i>
        <p>Tidak ada detail data untuk ditampilkan</p>
      </div>
    </template>

    <!-- Data Table -->
    <template #content>
      <BaseDataTableModal :data="detailData" :columns="tableColumns" :loading="loading" :total-records="totalRecords"
        :items-per-page="25" :searchable="true" :sortable="true" title="Detail Transaksi" icon="pi pi-table"
        max-height="500px" min-table-width="1800px" search-placeholder="Cari data transaksi..."
        empty-message="Tidak ada detail data untuk ditampilkan" :hoverable="true">
        <!-- Custom Cell: Tanggal -->
        <template #cell-tgl1="{ value }">
          {{ formatDate(value) }}
        </template>

        <!-- Custom Cell: Tipe -->
        <template #cell-tipe="{ value }">
          {{ value || '-' }}
        </template>

        <!-- Custom Cell: Toko -->
        <template #cell-toko="{ value }">
          {{ value || '-' }}
        </template>

        <!-- Custom Cell: Currency Fields -->
        <template #cell-gross_wrc="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-ppn_wrc="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-gross_idm_wrc="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-ppn_idm_wrc="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-gross_store="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-ppn_store="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-gross_idm_store="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #cell-ppn_idm_store="{ value }">
          {{ formatCurrency(value) }}
        </template>

        <!-- Custom Cell: Difference Fields with Highlighting -->
        <template #cell-selisih_gross="{ value }">
          <span class="difference-cell" :style="getDifferenceStyle(value)">
            {{ formatCurrency(value) }}
          </span>
        </template>
        <template #cell-selisih_ppn="{ value }">
          <span class="difference-cell" :style="getDifferenceStyle(value)">
            {{ formatCurrency(value) }}
          </span>
        </template>
        <template #cell-selisih_gross_idm="{ value }">
          <span class="difference-cell" :style="getDifferenceStyle(value)">
            {{ formatCurrency(value) }}
          </span>
        </template>
        <template #cell-selisih_ppn_idm="{ value }">
          <span class="difference-cell" :style="getDifferenceStyle(value)">
            {{ formatCurrency(value) }}
          </span>
        </template>
      </BaseDataTableModal>
    </template>

    <!-- Footer Slot -->
    <template #footer>
      <button type="button" class="btn btn-cancel" @click="$emit('close')">
        <i class="pi pi-times"></i> Tutup
      </button>
    </template>
  </BaseModalDetail>
</template>

<style src="./RekonWtHarianDetailModal.css" scoped></style>
<script setup>
import { ref, watch, onMounted } from 'vue';
import BaseModalDetail from '@/components/common/BaseModalDetail.vue';
import BaseDataTableModal from '@/components/common/BaseDataTableModal.vue';
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
const totalRecords = ref(0);
const storesData = ref([]);
const storeName = ref('');

// Table columns configuration
const tableColumns = [
  {
    field: 'tgl1',
    label: 'Tanggal',
    sortable: true,
    width: '120px'
  },
  {
    field: 'tipe',
    label: 'Tipe',
    sortable: true,
    width: '100px'
  },
  {
    field: 'toko',
    label: 'Toko',
    sortable: true,
    width: '120px',
    minWidth: '120px',
    maxWidth: '120px'
  },
  {
    field: 'gross_wrc',
    label: 'Gross WRC',
    align: 'right',
    sortable: true,
    width: '130px'
  },
  {
    field: 'ppn_wrc',
    label: 'PPN WRC',
    align: 'right',
    sortable: true,
    width: '130px'
  },
  {
    field: 'gross_idm_wrc',
    label: 'Gross IDM WRC',
    align: 'right',
    sortable: true,
    width: '150px'
  },
  {
    field: 'ppn_idm_wrc',
    label: 'PPN IDM WRC',
    align: 'right',
    sortable: true,
    width: '150px'
  },
  {
    field: 'gross_store',
    label: 'Gross Store',
    align: 'right',
    sortable: true,
    width: '130px'
  },
  {
    field: 'ppn_store',
    label: 'PPN Store',
    align: 'right',
    sortable: true,
    width: '130px'
  },
  {
    field: 'gross_idm_store',
    label: 'Gross IDM Store',
    align: 'right',
    sortable: true,
    width: '150px'
  },
  {
    field: 'ppn_idm_store',
    label: 'PPN IDM Store',
    align: 'right',
    sortable: true,
    width: '150px'
  },
  {
    field: 'selisih_gross',
    label: 'Selisih Gross',
    align: 'right',
    sortable: true,
    width: '140px',
    cellClass: 'difference-cell'
  },
  {
    field: 'selisih_ppn',
    label: 'Selisih PPN',
    align: 'right',
    sortable: true,
    width: '140px',
    cellClass: 'difference-cell'
  },
  {
    field: 'selisih_gross_idm',
    label: 'Selisih Gross IDM',
    align: 'right',
    sortable: true,
    width: '160px',
    cellClass: 'difference-cell'
  },
  {
    field: 'selisih_ppn_idm',
    label: 'Selisih PPN IDM',
    align: 'right',
    sortable: true,
    width: '160px',
    cellClass: 'difference-cell'
  }
];

// Methods
async function loadStoreData() {
  try {
    const response = await storeService.getStoresByBranch(props.cab, { limit: 99999 });
    if (response.data && Array.isArray(response.data.stores)) {
      storesData.value = response.data.stores;
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
      limit: 1000,
      sortColumn: 'tgl1',
      sortOrder: 'asc'
    };

    const response = await rekonWtHarianService.getResultDetail(props.periode, props.cab, props.toko, params);

    if (response.data && Array.isArray(response.data.data)) {
      detailData.value = response.data.data || [];
      totalRecords.value = response.data.total || detailData.value.length;
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

function getDifferenceStyle(value) {
  if (value === null || value === undefined || value === '' || value === 0) {
    return {};
  }

  const numValue = Math.abs(parseFloat(value));
  if (isNaN(numValue)) {
    return {};
  }

  let intensity = 0;

  if (numValue <= 100000) {
    intensity = Math.min(numValue / 100000 * 0.3, 0.3);
  } else if (numValue <= 500000) {
    intensity = 0.3 + Math.min((numValue - 100000) / 400000 * 0.3, 0.3);
  } else if (numValue <= 1000000) {
    intensity = 0.6 + Math.min((numValue - 500000) / 500000 * 0.25, 0.25);
  } else {
    intensity = Math.min(0.85 + (numValue - 1000000) / 2000000 * 0.15, 1);
  }

  const redValue = Math.floor(220 + (255 - 220) * intensity);
  const greenBlueValue = Math.floor(255 * (1 - intensity));

  const backgroundColor = `rgb(${redValue}, ${greenBlueValue}, ${greenBlueValue})`;
  const textColor = intensity > 0.5 ? '#ffffff' : '#000000';

  return {
    backgroundColor,
    color: textColor,
    fontWeight: intensity > 0.3 ? '600' : '500',
    transition: 'all 0.2s ease',
    padding: '0.75rem 0.5rem',
    borderRadius: '4px',
    display: 'inline-block',
    width: '100%'
  };
}

// Watch for prop changes
watch(() => props.show, (newValue) => {
  if (newValue) {
    loadStoreData();
    loadDetailData();
  }
});

// Load data when component mounts
onMounted(() => {
  if (props.show) {
    loadStoreData();
    loadDetailData();
  }
});
</script>
