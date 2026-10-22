<template>
  <div class="store-monitoring-container">
    <!-- Header Controls & Meta Bar -->
    <div class="monitoring-header-bar">
      <div class="monitoring-meta-info">
        <div class="meta-icon-wrapper">
          <i class="pi pi-compass"></i>
        </div>
        <div class="meta-details">
          <div class="meta-title">Status Monitoring Toko (WRC)</div>
          <div class="meta-subtitle">
            <span v-if="meta?.lastSyncedAt">
              Terakhir disinkronkan: <strong>{{ formatDateTime(meta.lastSyncedAt) }}</strong>
              oleh <strong>{{ meta.syncedByFullName || meta.syncedBy }}</strong>
              ({{ meta.successfulCabang || 0 }} cabang aktif)
            </span>
            <span v-else>Memuat informasi sinkronisasi...</span>
          </div>
        </div>
      </div>

      <div class="monitoring-actions">
        <button
          type="button"
          class="btn-monitoring-refresh"
          @click="fetchMonitoringData"
          :disabled="loading || syncing"
          title="Segarkan tampilan"
        >
          <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i>
          <span>Refresh</span>
        </button>

        <button
          type="button"
          class="btn-monitoring-export"
          @click="handleExportExcel"
          :disabled="loading || syncing"
          title="Download laporan lengkap Excel (4 Sheet)"
        >
          <i class="pi pi-file-excel"></i>
          <span>Export Excel</span>
        </button>

        <button
          v-if="canSync"
          type="button"
          class="btn-monitoring-sync"
          @click="handleManualSync"
          :disabled="loading || syncing"
          title="Tarik pembaruan data real-time dari server WRC cabang"
        >
          <i class="pi pi-sync" :class="{ 'pi-spin': syncing }"></i>
          <span>{{ syncing ? 'Menyinkronkan WRC...' : 'Sync Data WRC' }}</span>
        </button>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="monitoring-kpi-grid">
      <!-- KPI Toko Akan Buka & Baru -->
      <div
        class="monitoring-kpi-card"
        :class="{ active: activeCategory === 'akan_buka' }"
        @click="activeCategory = 'akan_buka'"
      >
        <div class="kpi-icon-box buka">
          <i class="pi pi-plus-circle"></i>
        </div>
        <div class="kpi-text-box">
          <span class="kpi-label">Akan Buka / Baru</span>
          <div class="kpi-value-row">
            <span class="kpi-value">{{ summary.totalAkanBuka || 0 }}</span>
            <span v-if="summary.totalBaruBulanIni > 0" class="kpi-sub-badge" title="Toko yang baru buka pada bulan ini">
              {{ summary.totalBaruBulanIni }} baru bulan ini
            </span>
          </div>
        </div>
      </div>

      <!-- KPI Tutup Sementara -->
      <div
        class="monitoring-kpi-card"
        :class="{ active: activeCategory === 'tutup_sementara' }"
        @click="activeCategory = 'tutup_sementara'"
      >
        <div class="kpi-icon-box ts">
          <i class="pi pi-clock"></i>
        </div>
        <div class="kpi-text-box">
          <span class="kpi-label">Tutup Sementara (TS)</span>
          <div class="kpi-value-row">
            <span class="kpi-value">{{ summary.totalTutupSementara || 0 }}</span>
            <span class="kpi-sub-badge warning" v-if="summary.totalTutupSementara > 0">
              Perbaikan / Renovasi
            </span>
          </div>
        </div>
      </div>

      <!-- KPI Akan Tutup -->
      <div
        class="monitoring-kpi-card"
        :class="{ active: activeCategory === 'akan_tutup' }"
        @click="activeCategory = 'akan_tutup'"
      >
        <div class="kpi-icon-box akan-tutup">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <div class="kpi-text-box">
          <span class="kpi-label">Rencana Tutup</span>
          <div class="kpi-value-row">
            <span class="kpi-value">{{ summary.totalAkanTutup || 0 }}</span>
            <span class="kpi-sub-badge warning" v-if="summary.totalAkanTutup > 0">
              Jadwal Akan Tutup
            </span>
          </div>
        </div>
      </div>

      <!-- KPI Sudah Tutup -->
      <div
        class="monitoring-kpi-card"
        :class="{ active: activeCategory === 'sudah_tutup' }"
        @click="activeCategory = 'sudah_tutup'"
      >
        <div class="kpi-icon-box sudah-tutup">
          <i class="pi pi-times-circle"></i>
        </div>
        <div class="kpi-text-box">
          <span class="kpi-label">Sudah Tutup & Saldo</span>
          <div class="kpi-value-row">
            <span class="kpi-value">{{ summary.totalSudahTutup || 0 }}</span>
            <span
              v-if="summary.totalSudahTutupAdaSisa > 0"
              class="kpi-sub-badge warning"
              title="Toko sudah tutup namun masih ada sisa saldo di closing WRC"
            >
              {{ summary.totalSudahTutupAdaSisa }} ada sisa
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Toolbar & Filter Bar -->
    <div class="monitoring-toolbar">
      <div class="category-tab-group">
        <button
          type="button"
          class="tab-pill-btn"
          :class="{ active: activeCategory === 'akan_buka' }"
          @click="activeCategory = 'akan_buka'"
        >
          <i class="pi pi-sparkles"></i>
          <span>Akan Buka & Baru</span>
          <span class="pill-count">{{ filteredAkanBuka.length }}</span>
        </button>

        <button
          type="button"
          class="tab-pill-btn"
          :class="{ active: activeCategory === 'tutup_sementara' }"
          @click="activeCategory = 'tutup_sementara'"
        >
          <i class="pi pi-calendar-times"></i>
          <span>Tutup Sementara</span>
          <span class="pill-count">{{ filteredTutupSementara.length }}</span>
        </button>

        <button
          type="button"
          class="tab-pill-btn"
          :class="{ active: activeCategory === 'akan_tutup' }"
          @click="activeCategory = 'akan_tutup'"
        >
          <i class="pi pi-calendar-minus"></i>
          <span>Rencana Tutup</span>
          <span class="pill-count">{{ filteredAkanTutup.length }}</span>
        </button>

        <button
          type="button"
          class="tab-pill-btn"
          :class="{ active: activeCategory === 'sudah_tutup' }"
          @click="activeCategory = 'sudah_tutup'"
        >
          <i class="pi pi-ban"></i>
          <span>Sudah Tutup</span>
          <span class="pill-count">{{ filteredSudahTutup.length }}</span>
        </button>
      </div>

      <div class="monitoring-filter-controls">
        <!-- Search Field -->
        <div class="search-input-box">
          <i class="pi pi-search"></i>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Cari kode, nama toko, keterangan..."
            class="search-field"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''" title="Hapus">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Filter Cabang -->
        <select v-model="selectedCabang" class="select-filter" title="Filter Cabang">
          <option value="">Semua Cabang</option>
          <option v-for="cab in cabangList" :key="cab" :value="cab">{{ cab }}</option>
        </select>

        <!-- Sub Filter Khusus Akan Buka -->
        <select
          v-if="activeCategory === 'akan_buka'"
          v-model="filterBukaType"
          class="select-filter"
          title="Filter Jenis Buka"
        >
          <option value="all">Semua Tipe Buka</option>
          <option value="baru">Baru Bulan Ini Saja</option>
          <option value="akan_datang">Akan Buka Nanti</option>
        </select>

        <!-- Sub Filter Khusus Sudah Tutup -->
        <select
          v-if="activeCategory === 'sudah_tutup'"
          v-model="filterSaldoStatus"
          class="select-filter"
          title="Filter Status Saldo Akhir"
        >
          <option value="all">Semua Status Saldo</option>
          <option value="ada_sisa">Ada Sisa Saldo Saja</option>
          <option value="nol">Saldo Nol (Clear) Saja</option>
        </select>
      </div>
    </div>

    <!-- Table Container -->
    <div class="monitoring-table-card">
      <!-- 1. TABEL AKAN BUKA & BARU -->
      <DataTable
        v-if="activeCategory === 'akan_buka'"
        :value="filteredAkanBuka"
        :paginator="true"
        :rows="15"
        :rowsPerPageOptions="[15, 30, 50, 100]"
        responsiveLayout="scroll"
        class="p-datatable-sm"
        stripedRows
      >
        <template #empty>
          <div class="p-4 text-center text-muted">
            <i class="pi pi-inbox mr-2"></i> Tidak ada data toko akan buka atau baru yang sesuai kriteria.
          </div>
        </template>
        <Column header="No" :style="{ width: '60px', textAlign: 'center' }">
          <template #body="slotProps">
            {{ slotProps.index + 1 }}
          </template>
        </Column>
        <Column field="cabang" header="Cabang" :style="{ width: '100px' }">
          <template #body="slotProps">
            <span class="branch-tag">{{ slotProps.data.cabang }}</span>
          </template>
        </Column>
        <Column field="kodeToko" header="Kode Toko" :style="{ width: '120px' }">
          <template #body="slotProps">
            <span class="store-code-text">{{ slotProps.data.kodeToko }}</span>
          </template>
        </Column>
        <Column field="namaToko" header="Nama Toko" sortable></Column>
        <Column field="tglBuka" header="Tanggal Buka" sortable :style="{ width: '140px' }">
          <template #body="slotProps">
            <span>{{ formatDate(slotProps.data.tglBuka) }}</span>
          </template>
        </Column>
        <Column header="Status" :style="{ width: '180px' }">
          <template #body="slotProps">
            <span
              v-if="slotProps.data.isNewThisMonth"
              class="table-badge new-store"
              title="Toko baru buka pada bulan berjalan saat ini"
            >
              <i class="pi pi-sparkles"></i> Toko Baru (Bulan Ini)
            </span>
            <span v-else class="table-badge upcoming">
              <i class="pi pi-calendar-plus"></i> Akan Buka
            </span>
          </template>
        </Column>
      </DataTable>

      <!-- 2. TABEL TUTUP SEMENTARA (TS) -->
      <DataTable
        v-if="activeCategory === 'tutup_sementara'"
        :value="filteredTutupSementara"
        :paginator="true"
        :rows="15"
        :rowsPerPageOptions="[15, 30, 50, 100]"
        responsiveLayout="scroll"
        class="p-datatable-sm"
        stripedRows
      >
        <template #empty>
          <div class="p-4 text-center text-muted">
            <i class="pi pi-inbox mr-2"></i> Tidak ada data toko tutup sementara yang sesuai kriteria.
          </div>
        </template>
        <Column header="No" :style="{ width: '60px', textAlign: 'center' }">
          <template #body="slotProps">
            {{ slotProps.index + 1 }}
          </template>
        </Column>
        <Column field="cabang" header="Cabang" :style="{ width: '100px' }">
          <template #body="slotProps">
            <span class="branch-tag">{{ slotProps.data.cabang }}</span>
          </template>
        </Column>
        <Column field="kodeToko" header="Kode Toko" :style="{ width: '120px' }">
          <template #body="slotProps">
            <span class="store-code-text">{{ slotProps.data.kodeToko }}</span>
          </template>
        </Column>
        <Column field="namaToko" header="Nama Toko" sortable></Column>
        <Column field="tglMulai" header="Tgl Mulai" :style="{ width: '130px' }">
          <template #body="slotProps">
            <span>{{ formatDate(slotProps.data.tglMulai) }}</span>
          </template>
        </Column>
        <Column field="tglSelesai" header="Tgl Selesai" :style="{ width: '130px' }">
          <template #body="slotProps">
            <span>{{ formatDate(slotProps.data.tglSelesai) }}</span>
          </template>
        </Column>
        <Column field="totalHari" header="Durasi" :style="{ width: '110px', textAlign: 'center' }" sortable>
          <template #body="slotProps">
            <span class="table-badge warning">
              {{ slotProps.data.totalHari }} Hari
            </span>
          </template>
        </Column>
        <Column field="keterangan" header="Keterangan" sortable></Column>
        <Column header="Detail" :style="{ width: '120px', textAlign: 'center' }">
          <template #body="slotProps">
            <button
              type="button"
              class="btn-detail-link"
              @click="openTsDetails(slotProps.data)"
              title="Lihat daftar rincian tanggal tutup sementara"
            >
              <i class="pi pi-list"></i>
              <span>Rincian</span>
            </button>
          </template>
        </Column>
      </DataTable>

      <!-- 3. TABEL RENCANA TUTUP -->
      <DataTable
        v-if="activeCategory === 'akan_tutup'"
        :value="filteredAkanTutup"
        :paginator="true"
        :rows="15"
        :rowsPerPageOptions="[15, 30, 50, 100]"
        responsiveLayout="scroll"
        class="p-datatable-sm"
        stripedRows
      >
        <template #empty>
          <div class="p-4 text-center text-muted">
            <i class="pi pi-inbox mr-2"></i> Tidak ada data toko rencana tutup yang sesuai kriteria.
          </div>
        </template>
        <Column header="No" :style="{ width: '60px', textAlign: 'center' }">
          <template #body="slotProps">
            {{ slotProps.index + 1 }}
          </template>
        </Column>
        <Column field="cabang" header="Cabang" :style="{ width: '100px' }">
          <template #body="slotProps">
            <span class="branch-tag">{{ slotProps.data.cabang }}</span>
          </template>
        </Column>
        <Column field="kodeToko" header="Kode Toko" :style="{ width: '120px' }">
          <template #body="slotProps">
            <span class="store-code-text">{{ slotProps.data.kodeToko }}</span>
          </template>
        </Column>
        <Column field="namaToko" header="Nama Toko" sortable></Column>
        <Column field="tglBuka" header="Tgl Buka" :style="{ width: '130px' }">
          <template #body="slotProps">
            <span>{{ slotProps.data.tglBuka ? formatDate(slotProps.data.tglBuka) : '-' }}</span>
          </template>
        </Column>
        <Column field="tglTutup" header="Rencana Tutup" sortable :style="{ width: '140px' }">
          <template #body="slotProps">
            <span class="text-danger font-semibold">{{ formatDate(slotProps.data.tglTutup) }}</span>
          </template>
        </Column>
        <Column header="Hitung Hari" :style="{ width: '140px', textAlign: 'center' }">
          <template #body="slotProps">
            <span class="table-badge danger">
              <i class="pi pi-clock"></i> {{ getDaysRemaining(slotProps.data.tglTutup) }} hari lagi
            </span>
          </template>
        </Column>
      </DataTable>

      <!-- 4. TABEL SUDAH TUTUP & SALDO WRC -->
      <DataTable
        v-if="activeCategory === 'sudah_tutup'"
        :value="filteredSudahTutup"
        :paginator="true"
        :rows="15"
        :rowsPerPageOptions="[15, 30, 50, 100]"
        responsiveLayout="scroll"
        class="p-datatable-sm"
        stripedRows
      >
        <template #empty>
          <div class="p-4 text-center text-muted">
            <i class="pi pi-inbox mr-2"></i> Tidak ada data toko sudah tutup yang sesuai kriteria.
          </div>
        </template>
        <Column header="No" :style="{ width: '60px', textAlign: 'center' }">
          <template #body="slotProps">
            {{ slotProps.index + 1 }}
          </template>
        </Column>
        <Column field="cabang" header="Cabang" :style="{ width: '100px' }">
          <template #body="slotProps">
            <span class="branch-tag">{{ slotProps.data.cabang }}</span>
          </template>
        </Column>
        <Column field="kodeToko" header="Kode Toko" :style="{ width: '120px' }">
          <template #body="slotProps">
            <span class="store-code-text">{{ slotProps.data.kodeToko }}</span>
          </template>
        </Column>
        <Column field="namaToko" header="Nama Toko" sortable></Column>
        <Column field="tglTutup" header="Tanggal Tutup" sortable :style="{ width: '140px' }">
          <template #body="slotProps">
            <span>{{ formatDate(slotProps.data.tglTutup) }}</span>
          </template>
        </Column>
        <Column field="statusSaldo" header="Status Saldo WRC" :style="{ width: '160px' }" sortable>
          <template #body="slotProps">
            <span v-if="slotProps.data.statusSaldo === 'NOL'" class="table-badge success">
              <i class="pi pi-check-circle"></i> Saldo Nol (Clear)
            </span>
            <span v-else class="table-badge danger" title="Masih ada saldo akhir di closing WRC">
              <i class="pi pi-exclamation-circle"></i> Ada Sisa Saldo
            </span>
          </template>
        </Column>
        <Column field="periodeSaldo" header="Periode" :style="{ width: '110px', textAlign: 'center' }">
          <template #body="slotProps">
            <span class="text-muted text-sm font-mono">{{ slotProps.data.periodeSaldo || '-' }}</span>
          </template>
        </Column>
        <Column field="saldoQty" header="Qty Saldo" :style="{ width: '120px', textAlign: 'right' }" sortable>
          <template #body="slotProps">
            <span :class="{ 'text-danger font-bold': slotProps.data.saldoQty !== 0 }">
              {{ formatNumber(slotProps.data.saldoQty) }}
            </span>
          </template>
        </Column>
        <Column field="saldoRp" header="Rp Saldo Akhir" :style="{ width: '150px', textAlign: 'right' }" sortable>
          <template #body="slotProps">
            <span :class="{ 'text-danger font-bold': slotProps.data.saldoRp !== 0 }">
              {{ formatCurrency(slotProps.data.saldoRp) }}
            </span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Modal Rincian Tanggal Tutup Sementara (TS) -->
    <Dialog
      v-model:visible="showTsModal"
      modal
      header="Rincian Tanggal Tutup Sementara"
      :style="{ width: '520px' }"
      :closable="true"
    >
      <div v-if="selectedTsStore" class="ts-dates-modal-content">
        <div class="ts-info-summary">
          <div class="ts-info-item">
            <span class="ts-info-label">Toko</span>
            <span class="ts-info-val">{{ selectedTsStore.kodeToko }} - {{ selectedTsStore.namaToko }}</span>
          </div>
          <div class="ts-info-item">
            <span class="ts-info-label">Cabang</span>
            <span class="ts-info-val">{{ selectedTsStore.cabang }}</span>
          </div>
          <div class="ts-info-item">
            <span class="ts-info-label">Total Durasi</span>
            <span class="ts-info-val">{{ selectedTsStore.totalHari }} Hari</span>
          </div>
        </div>

        <div>
          <div class="font-semibold text-sm mb-2">Keterangan:</div>
          <div class="p-2 border rounded text-sm bg-surface-ground">
            {{ selectedTsStore.keterangan || '-' }}
          </div>
        </div>

        <div>
          <div class="font-semibold text-sm mb-2">Daftar Tanggal Tutup ({{ selectedTsStore.daftarTanggal?.length || 0 }}):</div>
          <div class="ts-dates-grid">
            <div
              v-for="d in selectedTsStore.daftarTanggal"
              :key="d"
              class="ts-date-pill"
            >
              {{ formatDate(d) }}
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="showTsModal = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import storeService from '@/services/store.service';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
  canSync: {
    type: Boolean,
    default: false,
  },
});

const toast = useToast();

const loading = ref(false);
const syncing = ref(false);
const activeCategory = ref('akan_buka');

const searchQuery = ref('');
const selectedCabang = ref('');
const filterBukaType = ref('all');
const filterSaldoStatus = ref('all');

const meta = ref(null);
const summary = ref({
  totalAkanBuka: 0,
  totalBaruBulanIni: 0,
  totalTutupSementara: 0,
  totalAkanTutup: 0,
  totalSudahTutup: 0,
  totalSudahTutupAdaSisa: 0,
  totalSudahTutupNol: 0,
});

const rawData = ref({
  akanBuka: [],
  tutupSementara: [],
  akanTutup: [],
  sudahTutup: [],
});

// Modal TS
const showTsModal = ref(false);
const selectedTsStore = ref(null);

// Cabang list unique
const cabangList = computed(() => {
  const set = new Set();
  (rawData.value.akanBuka || []).forEach(x => x.cabang && set.add(x.cabang));
  (rawData.value.tutupSementara || []).forEach(x => x.cabang && set.add(x.cabang));
  (rawData.value.akanTutup || []).forEach(x => x.cabang && set.add(x.cabang));
  (rawData.value.sudahTutup || []).forEach(x => x.cabang && set.add(x.cabang));
  return Array.from(set).sort();
});

// Filter helper
const matchesSearchAndCabang = (item) => {
  if (selectedCabang.value && item.cabang !== selectedCabang.value) {
    return false;
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim();
    const code = (item.kodeToko || '').toLowerCase();
    const name = (item.namaToko || '').toLowerCase();
    const cab = (item.cabang || '').toLowerCase();
    const ket = (item.keterangan || '').toLowerCase();
    if (!code.includes(q) && !name.includes(q) && !cab.includes(q) && !ket.includes(q)) {
      return false;
    }
  }
  return true;
};

// Filtered lists
const filteredAkanBuka = computed(() => {
  let list = (rawData.value.akanBuka || []).filter(matchesSearchAndCabang);
  if (filterBukaType.value === 'baru') {
    list = list.filter(x => x.isNewThisMonth);
  } else if (filterBukaType.value === 'akan_datang') {
    list = list.filter(x => !x.isNewThisMonth);
  }
  return list;
});

const filteredTutupSementara = computed(() => {
  return (rawData.value.tutupSementara || []).filter(matchesSearchAndCabang);
});

const filteredAkanTutup = computed(() => {
  return (rawData.value.akanTutup || []).filter(matchesSearchAndCabang);
});

const filteredSudahTutup = computed(() => {
  let list = (rawData.value.sudahTutup || []).filter(matchesSearchAndCabang);
  if (filterSaldoStatus.value === 'ada_sisa') {
    list = list.filter(x => x.statusSaldo === 'ADA_SISA');
  } else if (filterSaldoStatus.value === 'nol') {
    list = list.filter(x => x.statusSaldo === 'NOL');
  }
  return list;
});

// Fetch data
const fetchMonitoringData = async () => {
  loading.value = true;
  try {
    const res = await storeService.getStoreMonitoring();
    if (res.success) {
      meta.value = res.meta || null;
      summary.value = res.rawSummary || res.summary || summary.value;
      rawData.value = res.data || {
        akanBuka: [],
        tutupSementara: [],
        akanTutup: [],
        sudahTutup: [],
      };
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal Memuat Data',
      detail: err.response?.data?.message || err.message,
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
};

// Manual Sync
const handleManualSync = async () => {
  syncing.value = true;
  try {
    toast.add({
      severity: 'info',
      summary: 'Sinkronisasi Dimulai',
      detail: 'Menghubungkan ke server WRC cabang secara paralel...',
      life: 3000,
    });
    const res = await storeService.syncStoreMonitoring();
    if (res.success) {
      meta.value = res.meta || null;
      summary.value = res.summary || summary.value;
      rawData.value = res.data || rawData.value;
      toast.add({
        severity: 'success',
        summary: 'Sinkronisasi Berhasil',
        detail: `Berhasil menarik data WRC dalam ${(res.meta?.durationMs / 1000).toFixed(1)} detik.`,
        life: 5000,
      });
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Sinkronisasi Gagal',
      detail: err.response?.data?.message || err.message,
      life: 5000,
    });
  } finally {
    syncing.value = false;
  }
};

// Export Excel
const handleExportExcel = async () => {
  try {
    toast.add({
      severity: 'info',
      summary: 'Mengunduh Laporan',
      detail: 'Menyiapkan workbook Excel 4 sheet...',
      life: 3000,
    });
    const blob = await storeService.exportStoreMonitoringExcel({
      cabang: selectedCabang.value,
      search: searchQuery.value,
    });
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `store-monitoring-${dateStr}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Export Gagal',
      detail: err.message,
      life: 4000,
    });
  }
};

// Open TS Details Modal
const openTsDetails = (store) => {
  selectedTsStore.value = store;
  showTsModal.value = true;
};

// Formatters
const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const formatDateTime = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('id-ID').format(Number(num) || 0);
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
};

const getDaysRemaining = (targetDateStr) => {
  if (!targetDateStr) return 0;
  const target = new Date(targetDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

onMounted(() => {
  fetchMonitoringData();
});
</script>

<style scoped>
@import './StoreMonitoringTab.style.css';
</style>
