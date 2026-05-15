<template>
  <div class="rekap-backup-view">
    <PageHeader
      title="Rekap Status Backup Data"
      subtitle="Harian & Bulanan"
      description="Pantau status kelengkapan data backup harian dan bulanan per cabang secara cepat dengan visualisasi yang intuitif."
    />

    <div class="content-container">
      <!-- Stats Summary -->
      <RbStatsBar
        :total-cabang="summaryData.length"
        :latest-harian="latestHarianInfo"
        :latest-bulanan="latestBulananInfo"
      />

      <!-- Filter & Actions -->
      <RbFilterBar
        v-model:start-year="selectedStartYear"
        v-model:end-year="selectedEndYear"
        v-model:cabang="selectedCabang"
        :is-exporting="exporting"
        :start-year-options="startYearOptions"
        :end-year-options="endYearOptions"
        @export-clicked="exportExcel"
        @staging-sync-clicked="showStagingSyncDialog = true"
      />

      <!-- Monitoring Table -->
      <RbMonitoringTable
        :data="summaryData"
        :loading="loading"
        @open-detail="openDialog"
      />
    </div>

    <!-- Detail Dialog -->
    <DetailDialog
      v-model:visible="dialogVisible"
      :cabang="dialogCabang"
      :type="dialogType"
    />

    <!-- Staging Sync Confirmation Dialog -->
    <RbStagingSyncDialog
      v-model:visible="showStagingSyncDialog"
      :loading="stagingSyncing"
      @confirm="doStagingSync"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import { rekapBackupService } from '@/services';

import RbStatsBar          from './components/RbStatsBar.vue';
import RbFilterBar         from './components/RbFilterBar.vue';
import RbMonitoringTable   from './components/RbMonitoringTable.vue';
import RbStagingSyncDialog from './components/RbStagingSyncDialog.vue';
import DetailDialog        from './components/DetailDialog.vue';

const toast = useToast();

// ─── Data ────────────────────────────────────────────────────────────
const loading     = ref(false);
const summaryData = ref([]);

// ─── Filter ──────────────────────────────────────────────────────────
const startYearOptions  = ref(['All']);
const selectedStartYear = ref('All');
const selectedEndYear   = ref('');
const selectedCabang    = ref(null);
const exporting         = ref(false);

const endYearOptions = computed(() => {
  if (selectedStartYear.value === 'All') return [];
  return startYearOptions.value.filter(y => y !== 'All' && y >= selectedStartYear.value);
});

// ─── Stats ───────────────────────────────────────────────────────────
const latestHarianInfo = computed(() => {
  const sorted = [...summaryData.value]
    .filter(d => d.newest_harian)
    .sort((a, b) => b.newest_harian.localeCompare(a.newest_harian));
  return sorted[0]?.newest_harian || '-';
});

const latestBulananInfo = computed(() => {
  const sorted = [...summaryData.value]
    .filter(d => d.newest_bln)
    .sort((a, b) => b.newest_bln.localeCompare(a.newest_bln));
  return sorted[0]?.newest_bln || '-';
});

// ─── Detail Dialog ───────────────────────────────────────────────────
const dialogVisible = ref(false);
const dialogCabang  = ref('');
const dialogType    = ref('harian');

const openDialog = (cabang, type) => {
  dialogCabang.value  = cabang;
  dialogType.value    = type;
  dialogVisible.value = true;
};

// ─── Staging Sync ────────────────────────────────────────────────────
const showStagingSyncDialog = ref(false);
const stagingSyncing        = ref(false);

const doStagingSync = async () => {
  stagingSyncing.value = true;
  try {
    await rekapBackupService.triggerStagingSync();
    toast.add({ severity: 'success', summary: 'Sinkronisasi Selesai', detail: 'Data JSON berhasil disinkronkan ke database', life: 4000 });
    showStagingSyncDialog.value = false;
    // Refresh semua data setelah sync
    await Promise.all([fetchSummary(), fetchYears()]);
  } catch (err) {
    const msg = err?.response?.data?.message || 'Gagal melakukan sinkronisasi data';
    toast.add({ severity: 'error', summary: 'Sinkronisasi Gagal', detail: msg, life: 5000 });
  } finally {
    stagingSyncing.value = false;
  }
};

// ─── API Calls ───────────────────────────────────────────────────────
const fetchSummary = async () => {
  loading.value = true;
  try {
    const data = await rekapBackupService.getSummary();
    summaryData.value = Array.isArray(data) ? data : [];
  } catch {
    summaryData.value = [];
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data summary', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const fetchYears = async () => {
  try {
    const data = await rekapBackupService.getYears();
    if (data?.length > 0) {
      const { oldest_year, newest_year } = data[0];
      if (oldest_year && newest_year) {
        const years = [];
        for (let y = parseInt(oldest_year); y <= parseInt(newest_year); y++) years.push(y.toString());
        startYearOptions.value = ['All', ...years];
      }
    }
  } catch (err) {
    console.error('Error fetching years:', err);
  }
};

const exportExcel = async () => {
  exporting.value = true;
  try {
    const params = {};
    if (selectedCabang.value) params.cabang = selectedCabang.value;
    if (selectedStartYear.value !== 'All') {
      params.startYear = selectedStartYear.value;
      params.endYear   = selectedEndYear.value || selectedStartYear.value;
    }

    const response = await rekapBackupService.exportExcel(params);
    const url  = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href  = url;

    let filename = 'RekapBackup.xlsx';
    const disposition = response.headers['content-disposition'];
    if (disposition?.includes('filename=')) {
      const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (m?.[1]) filename = m[1].replace(/['"]/g, '');
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Report berhasil diunduh', life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal export file excel', life: 3000 });
  } finally {
    exporting.value = false;
  }
};

// ─── Lifecycle ───────────────────────────────────────────────────────
onMounted(() => {
  fetchSummary();
  fetchYears();
});
</script>

<style src="./index.css" scoped />
