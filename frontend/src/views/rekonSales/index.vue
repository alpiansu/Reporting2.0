<template>
  <div class="rekon-sales-view">
    <PageHeader title="Rekonsiliasi Sales" subtitle="Analisis perbedaan penjualan"
      description="Screening, ringkasan, resume per toko, detail harian, dan catatan." />

    <div class="content-container">
      <div class="filter-card">
        <FilterBar v-model:cabang="filters.cabang" v-model:month="filters.month" v-model:year="filters.year"
          v-model:shops="selectedShops" :cabangOptions="cabangOptions" :loading="isReconciling" @refresh="refreshAll"
          @start-screening="handleStartScreening" />

      </div>

      <ProgressBar v-if="isMassScreening && progressVisible" :visible="progressVisible"
        :percentage="progress.percentage" :info="currentInfo">
        <template #title>
          Processing Screening...
        </template>
        <template #subtitle>
          Connecting to stores and processing screening query.
        </template>
        <template #details>
          <small><strong>{{ currentInfo }}</strong></small>
        </template>
      </ProgressBar>

      <Dashboard :summary="summary" />

      <LastScanInfo moduleName="rekon_sales" :selectedCabang="filters.cabang" v-if="!isReconciling" />

      <StoreListTable :data="stores" :loading="loading" :pagination="pagination" :sortColumn="sortColumn"
        :sortOrder="sortOrder" :searchQuery="searchQuery" :loadingStores="loadingStores"
        :detailLoadingStores="detailLoadingStores" :highlightedItems="highlightedItems"
        @page-change="handlePageChange" @sort-change="handleSortChange"
        @view-details="openDetail" @re-screen="handleReScreen" @edit-note="openNote" @export="exportExcel"
        @search-change="handleSearchChange" />

      <StoreDetailModal v-model:visible="detailVisible" :detail="selectedDetail" :detailLoading="detailLoading"
        :differences="differences" :diffLoading="diffLoading" :kodePesananIssues="kodePesananIssues"
        :kodeLoading="kodeLoading" @open-note="openNote" @view-live-check="handleViewLiveCheck" />

      <MtranVsCdLiveCheckDialog v-model:visible="liveCheckVisible" :items="liveCheckItems"
        :loading="liveCheckLoading" :error="liveCheckError" :shiftInfo="liveCheckShiftInfo" />

      <NoteDialog v-model:visible="noteVisible" :store="noteStore"
        :defaultText="noteStore?.note?.noteText || noteStore?.note || ''"
        :lastUpdate="noteStore?.note?.updated_at ? formatDateTime(noteStore.note.updated_at) : ''"
        :saving="savingNote" @save="saveNote" @delete="deleteNote" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import { useCabangStore } from '@/stores';
import { useToastService } from '@/utils/toast';
import * as XLSX from 'xlsx';
import { formatDateTime } from './utils/formatters';
import { useRekonSales } from './composables/useRekonSales';
import { useScreening } from './composables/useScreening';
import { useProgress } from '@/composables/useProgress';
import Dashboard from './components/Dashboard.vue';
import FilterBar from './components/FilterBar.vue';
import StoreListTable from './components/StoreListTable.vue';
import StoreDetailModal from './components/StoreDetailModal.vue';
import NoteDialog from './components/NoteDialog.vue';
import MtranVsCdLiveCheckDialog from './components/MtranVsCdLiveCheckDialog.vue';
import ProgressBar from '@/components/common/ProgressBar.vue';
import LastScanInfo from '@/components/common/LastScanInfo.vue';
import rekonSalesApi from '@/services/rekonSales.service.js';

const cabangStore = useCabangStore();
const toast = useToastService();

const {
  filters,
  summary,
  stores,
  pagination,
  sortColumn,
  sortOrder,
  searchQuery,
  loading,
  fetchStoreDetails,
  fetchDifferences,
  fetchKodePesananIssues,
  updateNote,
  refreshAll
} = useRekonSales();

const { isReconciling, isMassScreening, currentTaskId, screenCabang, screenStore } = useScreening();

// Initialize useProgress dengan destructuring lengkap
const {
  progress,
  isCompleted,
  isFailed,
  progressError,
  currentInfo,
  startMonitoring,
  stopMonitoring,
  isVisible: progressVisible
} = useProgress({ maxRetry: 60, retryInterval: 1000 });

const cabangOptions = ref([]);
const selectedShops = ref([]);
const detailVisible = ref(false);
const selectedDetail = ref(null);
const detailLoading = ref(false);
const detailLoadingStores = ref(new Set());
let detailRequestToken = 0;
const differences = ref([]);
const diffLoading = ref(false);
const kodePesananIssues = ref([]);
const kodeLoading = ref(false);
const noteVisible = ref(false);
const noteStore = ref(null);
const savingNote = ref(false);
const liveCheckLoading = ref(false);
const liveCheckItems = ref([]);
const liveCheckError = ref('');
const liveCheckVisible = ref(false);
const liveCheckShiftInfo = ref(null);
const loadingStores = ref(new Set());
const highlightedItems = ref(new Set());

onMounted(async () => {
  try {
    const cabangData = await cabangStore.fetchCabang();
    cabangOptions.value = [{ kdcab: 'All', namacab: 'SEMUA CABANG' }, ...(Array.isArray(cabangData) ? cabangData : [])];
  } catch {
    cabangOptions.value = [{ kdcab: 'All', namacab: 'SEMUA CABANG' }];
  }
  await refreshAll();
});

watch([() => filters.month, () => filters.year, () => filters.cabang], async () => {
  if (filters.month && filters.year) {
    pagination.page = 1;
    await refreshAll();
  }
});

const handleStartScreening = async (options = {}) => {
  console.log('🎬 Trigger mass screening:', { cabang: filters.cabang, periode: `${filters.year}-${filters.month}`, force: options.force, shops: options.shops });

  await screenCabang({ cabang: filters.cabang, periode: `${filters.year}-${filters.month}`, force: options.force, shops: options.shops });
};

// Cleanup saat component unmount
onUnmounted(() => {
  console.log('🧹 Component unmounting, stopping monitoring');
  stopMonitoring();
});

// Watch isReconciling untuk memulai monitoring saat mass screening dimulai
watch(isReconciling, async (newVal) => {
  // HANYA untuk mass screening
  if (!isMassScreening.value) {
    return;
  }

  if (newVal) {
    const taskId = currentTaskId.value;

    if (!taskId) {
      console.error('❌ No taskId available for monitoring');
      toast.showError('Error', 'Task ID tidak tersedia untuk monitoring');
      return;
    }

    console.log(`🎬 Mass screening started, monitoring task: ${taskId}`);

    // Start monitoring dengan callbacks
    await startMonitoring(taskId, {
      onComplete: async (progressData) => {
        console.log('✅ Screening completed:', progressData);

        // Refresh data
        await refreshAll();

        // Reset state
        isReconciling.value = false;

        // Show success message
        toast.showSuccess('Sukses', 'Screening selesai! Data telah diperbarui.');
      },
      onError: async (errorData) => {
        console.error('❌ Screening error:', errorData);

        // Reset state
        isReconciling.value = false;

        // Show error message
        toast.showError('Error', errorData?.description || 'Screening gagal, silakan coba lagi');
      },
      onCancel: (cancelData) => {
        console.log('ℹ️ Screening cancelled by user:', cancelData);

        // Reset state without showing error
        isReconciling.value = false;
      }
    });
  } else {
    console.log('🛑 Mass screening stopped');
  }
});

// Watch untuk handle completion (backup jika callback tidak dipanggil)
watch(isCompleted, async (newVal) => {
  if (!isMassScreening.value) return;

  if (newVal) {
    console.log('✅ Mass screening completed (via watch)');

    // Delay untuk memberikan waktu callback selesai
    setTimeout(async () => {
      if (isReconciling.value) {
        await refreshAll();
        isReconciling.value = false;
        toast.showSuccess('Sukses', 'Screening selesai');
      }
    }, 1000);
  }
});

// Watch untuk handle failure (backup jika callback tidak dipanggil)
watch(isFailed, (newVal) => {
  if (!isMassScreening.value) return;

  if (newVal) {
    console.log('❌ Mass screening failed (via watch)');

    if (isReconciling.value) {
      isReconciling.value = false;
      toast.showError('Error', progressError.value || 'Screening gagal');
    }
  }
});

// Watch untuk handle progress error
watch(progressError, (newVal) => {
  if (!isMassScreening.value) return;

  if (newVal) {
    console.error('❌ Progress error:', newVal);
    // Error sudah ditangani di callback onError
  }
});

const openDetail = async (row) => {
  const kdtk = row.KDTK;
  if (!kdtk) return;
  const key = `${row.CABANG || row.CAB || 'Unknown'}_${kdtk}`;
  // Guard: cegah request berulang untuk toko yang sedang dimuat detailnya
  if (detailLoadingStores.value.has(key)) return;
  detailLoadingStores.value.add(key);
  // Token untuk menghindari race condition bila user membuka toko lain saat load belum selesai
  const token = ++detailRequestToken;

  // Buka dialog langsung agar user mendapat feedback instan tanpa menunggu response backend
  detailVisible.value = true;
  detailLoading.value = true;
  selectedDetail.value = null;
  differences.value = [];
  kodePesananIssues.value = [];

  try {
    const det = await fetchStoreDetails({ kdtk });
    if (token !== detailRequestToken) return;
    selectedDetail.value = det.data || det;
    diffLoading.value = true; kodeLoading.value = true;
    try { const diffRes = await fetchDifferences({ kdtk, page: 1, limit: 100 }); if (token !== detailRequestToken) return; differences.value = diffRes.data || diffRes; } catch { if (token !== detailRequestToken) return; differences.value = []; } finally { if (token === detailRequestToken) diffLoading.value = false; }
    try { const kodeRes = await fetchKodePesananIssues({ kdtk }); if (token !== detailRequestToken) return; kodePesananIssues.value = kodeRes.data || kodeRes; } catch { if (token !== detailRequestToken) return; kodePesananIssues.value = []; } finally { if (token === detailRequestToken) kodeLoading.value = false; }
  } catch (err) {
    if (token !== detailRequestToken) return;
    toast.showError('Error', err.message || 'Gagal mengambil detail');
    detailVisible.value = false;
  } finally {
    detailLoading.value = false;
    detailLoadingStores.value.delete(key);
  }
};

const openNote = (rowOrDetail) => {
  const kdtk = rowOrDetail.KDTK || rowOrDetail.SHOP;
  const tanggal = rowOrDetail.TANGGAL || rowOrDetail.DATES?.[0] || '';
  noteStore.value = { KDTK: kdtk, NAMA: rowOrDetail.NAMA || '-', note: rowOrDetail.note || null, CAB: rowOrDetail.CAB || rowOrDetail.CABANG || filters.cabang, TANGGAL: tanggal };
  noteVisible.value = true;
};

const saveNote = async ({ text }) => {
  savingNote.value = true;
  try {
    const tanggal = noteStore.value.TANGGAL;
    await updateNote({ cabang: filters.cabang, kdtk: noteStore.value.KDTK, tanggal, noteText: text });
    toast.showSuccess('Sukses', 'Catatan disimpan');
    noteVisible.value = false;
    highlightedItems.value.add(`${filters.cabang}_${noteStore.value.KDTK}`);
    setTimeout(() => highlightedItems.value.delete(`${filters.cabang}_${noteStore.value.KDTK}`), 2000);
    await refreshAll();
  } catch (err) {
    toast.showError('Error', err.message || 'Gagal menyimpan catatan');
  } finally {
    savingNote.value = false;
  }
};

const deleteNote = async () => {
  savingNote.value = true;
  try {
    const tanggal = noteStore.value.TANGGAL;
    await updateNote({ cabang: filters.cabang, kdtk: noteStore.value.KDTK, tanggal, noteText: '' });
    toast.showSuccess('Sukses', 'Catatan dihapus');
    noteVisible.value = false;
    highlightedItems.value.add(`${filters.cabang}_${noteStore.value.KDTK}`);
    setTimeout(() => highlightedItems.value.delete(`${filters.cabang}_${noteStore.value.KDTK}`), 2000);
    await refreshAll();
  } catch (err) {
    toast.showError('Error', err.message || 'Gagal menghapus catatan');
  } finally {
    savingNote.value = false;
  }
};

const handlePageChange = async ({ page }) => { pagination.page = page; await refreshAll(); };
const handleSortChange = async ({ sortColumn: sc, sortOrder: so }) => { sortColumn.value = sc; sortOrder.value = so; await refreshAll(); };
const handleSearchChange = async (q) => { searchQuery.value = q; pagination.page = 1; await refreshAll(); };

const exportExcel = async () => {
  try {
    const res = await rekonSalesApi.getExportData({ cabang: filters.cabang, month: filters.month, year: filters.year, searchQuery: searchQuery.value || undefined });
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet([res.summary || {}]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    const storesSheet = XLSX.utils.json_to_sheet(res.stores || []);
    XLSX.utils.book_append_sheet(wb, storesSheet, 'Stores');
    if (res.issues) { const issuesSheet = XLSX.utils.json_to_sheet(res.issues); XLSX.utils.book_append_sheet(wb, issuesSheet, 'Issues'); }
    XLSX.writeFile(wb, `rekon_sales_${filters.year}_${filters.month}.xlsx`);
    toast.showSuccess('Sukses', 'Export Excel selesai');
  } catch (err) {
    toast.showError('Error', err.message || 'Gagal export data');
  }
};

const handleViewLiveCheck = async ({ kdtk, month, year, tanggal, station, shift }) => {
  liveCheckShiftInfo.value = { TANGGAL: tanggal, STATION: station, SHIFT: shift };
  liveCheckLoading.value = true;
  liveCheckError.value = '';
  liveCheckItems.value = [];
  liveCheckVisible.value = true;
  try {
    const res = await rekonSalesApi.getLiveCheck({ kdtk, month, year, tanggal, station, shift });
    const data = res?.data || res || {};
    liveCheckItems.value = data.items || [];
    if (data.error) {
      liveCheckError.value = data.error;
    }
  } catch (err) {
    liveCheckError.value = err.message || 'Gagal mengambil data live';
  } finally {
    liveCheckLoading.value = false;
  }
};

const handleReScreen = async (row) => {
  const tanggal = row.DATES?.[0] || row.TANGGAL || row.tanggal;
  if (!tanggal) { toast.showInfo('Peringatan', 'Tidak ada tanggal tersedia untuk toko ini'); return; }
  const key = `${row.CABANG || row.CAB || 'Unknown'}_${row.KDTK || 'Unknown'}`;
  loadingStores.value.add(key);
  highlightedItems.value.add(key);

  try {
    // console.log(`🔄 Re-screening store: ${row.KDTK}`);
    await screenStore({ kdtk: row.KDTK, periode: `${filters.year}-${filters.month}` });
    toast.showSuccess('Sukses', `Re-screen ${row.KDTK} selesai`);
    await refreshAll();
  }
  catch (err) {
    toast.showError('Error', err.message || 'Gagal re-screen toko');
  }
  finally {
    loadingStores.value.delete(key);
    // Keep it highlighted for a bit for visual feedback
    setTimeout(() => {
      highlightedItems.value.delete(key);
    }, 3000);
  }
};
</script>

<style scoped>
.rekon-sales-view {
  padding: 1.5rem;
}

.content-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: contentFadeIn 0.3s ease-out;
}

@keyframes contentFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .rekon-sales-view {
    padding: 1rem;
  }

  .content-container {
    gap: 1rem;
  }
}

.table-footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: .75rem;
}

.filter-card {
  top: 0;
  background: var(--surface-color);
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
  backdrop-filter: saturate(180%) blur(6px);
}

.row-updated {
  animation: highlightFade 2s ease-out;
  border-left: 3px solid #3b82f6;
}

@keyframes highlightFade {
  0% {
    background: #dbeafe;
    transform: scale(1.005);
  }

  50% {
    background: #eff6ff;
  }

  100% {
    background: #f0f9ff;
    transform: scale(1);
  }
}
</style>
