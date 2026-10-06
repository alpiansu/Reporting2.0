<template>
  <div class="prep-closing-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-shield"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Prep Closing System</h1>
          <p class="header-subtitle">
            Sistem monitoring kesiapan closing toko &amp; validasi rule engine WRC
          </p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Active Filter Badge -->
        <div v-if="filters.periode" class="active-filter-badge">
          <i class="pi pi-calendar"></i>
          <span>Periode: <strong>{{ filters.periode }}</strong></span>
          <span v-if="filters.cabang" class="cab-sub-badge">Cabang: {{ filters.cabang }}</span>
        </div>

        <!-- Refresh Button -->
        <button
          type="button"
          class="btn-header-secondary"
          :disabled="isScreening || loading"
          @click="handleRefresh"
          title="Muat ulang data prep closing"
        >
          <i class="pi pi-refresh"></i>
          <span>Refresh</span>
        </button>
      </div>
    </header>

    <div class="content-container">
      <!-- Consolidated Filter & Control Center Panel -->
      <div class="prep-filter-panel">
        <div class="filter-main-bar">
          <!-- Cabang -->
          <div class="filter-item">
            <label class="filter-label">
              <i class="pi pi-building"></i>
              <span>Cabang</span>
              <span class="required-star">*</span>
            </label>
            <Dropdown 
              v-model="filters.cabang" 
              :options="cabangOptions" 
              optionLabel="namacab" 
              optionValue="kdcab" 
              placeholder="Pilih Cabang" 
              :disabled="isScreening || loading"
              class="filter-dropdown" 
            />
          </div>

          <!-- Periode -->
          <div class="filter-item">
            <label class="filter-label">
              <i class="pi pi-calendar"></i>
              <span>Periode</span>
              <span class="required-star">*</span>
            </label>
            <Calendar 
              v-model="periodeDate" 
              view="month" 
              dateFormat="mm/yy" 
              placeholder="Pilih Bulan/Tahun" 
              :maxDate="today" 
              showIcon 
              class="filter-calendar" 
              :disabled="isScreening || loading"
              @date-select="handlePeriodeSelect" 
            />
          </div>

          <!-- Action Buttons -->
          <div class="filter-item filter-item-actions">
            <label class="filter-label filter-label-hidden">&nbsp;</label>
            <button 
              type="button" 
              class="btn-screening-primary"
              :disabled="!filters.periode || isScreening || !isCurrentPeriod || wrcNotSynced" 
              @click="handleStartScreening"
              title="Mulai screening kesiapan closing"
            >
              <i class="pi" :class="isScreening ? 'pi-spin pi-spinner' : 'pi-bolt'"></i>
              <span>{{ isScreening ? 'Memproses...' : 'Mulai Screening' }}</span>
            </button>
          </div>

          <!-- Config Shortcuts -->
          <div class="filter-item filter-item-config">
            <label class="filter-label filter-label-hidden">&nbsp;</label>
            <div class="config-btn-group">
              <button 
                type="button" 
                class="btn-config-btn btn-config-wrc"
                :disabled="isScreening || loading" 
                @click="showWrcConfig = true"
                title="Buka konfigurasi sinkronisasi WRC Engine"
              >
                <i class="pi pi-database"></i>
                <span>Config WRC</span>
              </button>
              <button 
                type="button" 
                class="btn-config-btn btn-config-rule"
                :disabled="isScreening || loading" 
                @click="showRuleConfig = true"
                title="Kelola aturan validasi kesiapan closing"
              >
                <i class="pi pi-cog"></i>
                <span>Rule Engine</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Filter Footer Bar: Force Re-screen & WRC Sync Status Pill -->
        <div class="filter-footer-bar">
          <div class="force-screen-toggle">
            <Checkbox v-model="forceScreening" inputId="forceScreeningPrep" :binary="true" :disabled="isScreening" />
            <label for="forceScreeningPrep" class="force-screen-label">
              <i class="pi pi-bolt"></i>
              <span class="force-title">Force Re-screen</span>
              <span class="force-desc">— Lewati cache screening harian &amp; proses ulang seluruh data</span>
            </label>
          </div>

          <!-- WRC Sync Status Inline Pill -->
          <div v-if="filters.periode" class="wrc-sync-pill" :class="{ 'pill-error': wrcNotSynced, 'pill-warn': !wrcNotSynced && isWrcStale, 'pill-ok': !wrcNotSynced && !isWrcStale }">
            <i :class="wrcNotSynced ? 'pi pi-times-circle' : (!isWrcStale ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle')"></i>
            <span class="pill-text">
              <strong v-if="wrcNotSynced">WRC Belum Di-Sync</strong>
              <strong v-else-if="isWrcStale">WRC Perlu Sync Ulang</strong>
              <strong v-else>WRC Ter-sync</strong>
              <small v-if="lastWrcSyncAt">({{ dayjs(lastWrcSyncAt).tz('Asia/Jakarta').format('DD/MM HH:mm') }})</small>
            </span>
            <button v-if="wrcNotSynced || isWrcStale" type="button" class="pill-sync-btn" @click="showWrcConfig = true">
              <i class="pi pi-sync"></i> Sync WRC
            </button>
          </div>
        </div>
      </div>

      <!-- Processing Loading State -->
      <ProgressBar v-if="isMassScreening" :visible="isScreening" :percentage="progressData?.percentage || 0" :info="currentInfo || 'Memproses...'">
        <template #title>
          Processing Screening...
        </template>

        <template #subtitle>
          Connecting to stores and processing screening query.<br />
          Please wait patiently...
        </template>

        <template #details>
          <small>
            <strong>{{ currentInfo || (isCompleted ? 'Processing completed' : (isFailed ? 'Processing failed' : 'Memproses...')) }}</strong>
          </small>
        </template>
      </ProgressBar>

      <!-- Dashboard Summary -->
      <Dashboard v-if="summary" :summary="summary" :loading="loading" :rulesSummary="rulesSummary" :selectedRuleKeys="selectedRuleKeys" @rule-selected="handleRuleSelected" />

      <!-- Rules Grid moved into Dashboard -->

      <!-- Store List Table -->
      <StoreListTable :data="stores" :loading="loading" :error="error" :pagination="pagination" :searchQuery="searchQuery" :selectedRuleKeys="selectedRuleKeys"
        :periode="filters.periode" :cabang="filters.cabang" :onReScreen="handleReScreenStore" @refresh="handleTableRefresh"
        @page-change="handlePageChange" @items-per-page-change="handleItemsPerPageChange" @search-change="handleSearchChange"
        @sort-change="handleSortChange" @view-details="handleViewDetails"
        @edit-note="handleEditNote" />
    </div>

    <!-- Store Detail Modal -->
    <StoreDetailModal v-model:visible="detailModalVisible" :store="selectedStore" :periode="filters.periode"
      :loading="loading" @close="handleCloseDetail" @edit-note="handleEditNote" />



    <!-- Note Dialog -->
    <NoteDialog v-model:visible="noteDialogVisible" :store="noteStore" :periode="filters.periode"
      :saving="savingNote" @save="handleSaveNote" />

    <!-- Configuration Rules Dialog -->
    <RuleConfigDialog v-model:visible="showRuleConfig" @rules-updated="handleRefresh" />

    <!-- Configuration WRC Dialog -->
    <WrcExtractConfigDialog
      v-model:visible="showWrcConfig"
      :selectedPeriode="filters.periode"
      :selectedCabang="filters.cabang"
      :lastSyncAt="lastWrcSyncAt ? dayjs(lastWrcSyncAt).tz('Asia/Jakarta').format('DD MMM YYYY HH:mm') : null"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useToastService } from '@/utils/toast';
import { useAuthStore } from '@/stores';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import { useCabangStore } from '@/stores';
import Dashboard from './components/Dashboard.vue';
import StoreListTable from './components/StoreListTable.vue';
import StoreDetailModal from './components/StoreDetailModal.vue';
import ProgressBar from '@/components/common/ProgressBar.vue';
import NoteDialog from './components/NoteDialog.vue';
import RuleConfigDialog from '@/components/prepClosing/RuleConfigDialog.vue';
import WrcExtractConfigDialog from '@/components/prepClosing/WrcExtractConfigDialog.vue';
import { usePrepClosing } from './composables/usePrepClosing';
import { useScreening } from './composables/useScreening';
import { useProgress } from './composables/useProgress';
import { prepClosingApi } from '@/services/prepClosing.service';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const toast = useToastService();
const cabangStore = useCabangStore();
const authStore = useAuthStore();

// Composables
const {
  loading,
  error,
  summary,
  stores,
  selectedStore,
  rulesSummary,
  selectedRuleKeys,
  pagination,
  fetchStores,
  fetchStoreDetails,
  fetchRulesSummary,
  updateNote,
  refreshAll,
  sortColumn,
  sortOrder,
  searchQuery,
  resetFilters,
} = usePrepClosing();

const {
  isScreening,
  screenStore,
  screenCabang,
  screenAllCabang
} = useScreening();

// Initialize useProgress composable dengan destructuring lengkap
const username = authStore.user?.username || '';
const {
  progress: progressData,
  currentInfo,
  isCompleted,
  isFailed,
  progressError,
  startMonitoring,
  stopMonitoring,
  resetProgress
} = useProgress(username);

// State
const forceScreening = ref(false);
const filters = reactive({
  periode: '',
  cabang: 'All',
  search: ''
});

const isCurrentPeriod = computed(() => {
  if (!filters.periode) return false;

  const now = dayjs().tz('Asia/Jakarta');
  const currentPeriode = now.format('YYMM');

  return filters.periode === currentPeriode;
});

const lastWrcSyncAt = computed(() => {
  if (!wrcSyncStatus.value.length) return null;
  const syncedItems = wrcSyncStatus.value.filter(s => s.synced && s.last_synced_at);
  if (!syncedItems.length) return null;
  return syncedItems[0].last_synced_at;
});

const requiredWrcCabs = computed(() => {
  if (filters.cabang === 'All') {
    return wrcSyncStatus.value.map(s => s.cab);
  }
  return [filters.cabang];
});

const wrcNotSynced = computed(() => {
  if (!wrcSyncStatus.value.length) return true;
  const required = requiredWrcCabs.value;
  return required.some(cab => {
    const status = wrcSyncStatus.value.find(s => s.cab === cab);
    return !status || !status.synced;
  });
});

const isWrcStale = computed(() => {
  if (!lastWrcSyncAt.value || !filters.periode) return false;
  const now = dayjs().tz('Asia/Jakarta');
  const currentPeriode = now.format('YYMM');
  if (filters.periode !== currentPeriode) return false;
  const lastSync = dayjs(lastWrcSyncAt.value);
  const startOfMonth = now.startOf('month');
  return lastSync.isBefore(startOfMonth);
});

const today = ref(new Date());
const periodeDate = ref(null);
const cabangOptions = ref([]);

const detailModalVisible = ref(false);
const noteDialogVisible = ref(false);
const noteStore = ref(null);
const savingNote = ref(false);
const isMassScreening = ref(false);
const showRuleConfig = ref(false);
const showWrcConfig = ref(false);
const wrcSyncStatus = ref([]);

// Initialize
onMounted(async () => {
  // Set default periode to current month
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  filters.periode = year + month;
  periodeDate.value = now;

  // Load cabang options
  const cabangData = cabangStore.allCabang || [];
  cabangOptions.value = [
    { kdcab: 'All', namacab: 'SEMUA CABANG' },
    ...cabangData
  ];

  // Load initial data
  await loadData();
  await checkWrcSyncStatus();
});

// Watch periode and cabang changes
watch([() => filters.periode, () => filters.cabang], async () => {
  if (filters.periode) {
    resetFilters();
    await loadData();
    await checkWrcSyncStatus();
  }
});

watch(showWrcConfig, async (newVal) => {
  if (!newVal) {
    await checkWrcSyncStatus();
  }
});

// Watch untuk monitoring progress - HANYA untuk mass screening
watch(isScreening, (newVal) => {
  // HANYA jalankan untuk mass screening
  if (!isMassScreening.value) {
    return;
  }

  if (newVal) {
    console.log('🎬 Mass screening started');
    startMonitoring();
  } else {
    console.log('🛑 Mass screening stopped');
    // Don't auto-stop monitoring, let it finish naturally
  }
});

// Watch untuk auto-close dialog saat screening selesai - HANYA untuk mass screening
watch(isCompleted, (newVal) => {
  // HANYA jalankan untuk mass screening
  if (!isMassScreening.value) {
    return;
  }

  if (newVal) {
    console.log('✅ Mass screening completed, auto-closing dialog in 2 seconds');
    setTimeout(() => {
      handleScreeningComplete();
    }, 2000);
  }
});

// Watch untuk handle screening failure - HANYA untuk mass screening
watch(isFailed, (newVal) => {
  // HANYA jalankan untuk mass screening
  if (!isMassScreening.value) {
    return;
  }

  if (newVal) {
    console.log('❌ Mass screening failed');
    toast.showError('Error', progressError.value || 'Screening gagal, silakan coba lagi');
    setTimeout(() => {
      stopMonitoring();
      resetProgress();
      isMassScreening.value = false;
    }, 3000);
  }
});

// Watch untuk handle progress error - HANYA untuk mass screening
watch(progressError, (newVal) => {
  // HANYA jalankan untuk mass screening
  if (!isMassScreening.value) {
    return;
  }

  if (newVal) {
    console.error('❌ Progress error:', newVal);
    toast.showError('Error', newVal);
  }
});

// Methods
const loadData = async () => {
  // refreshAll akan otomatis menggunakan state sorting dari usePrepClosing
  await refreshAll(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    {
      sortColumn: sortColumn.value || undefined,
      sortOrder: sortOrder.value || undefined,
      searchQuery: searchQuery.value || undefined
    }
  );
};

const checkWrcSyncStatus = async () => {
  try {
    if (!filters.periode) {
      wrcSyncStatus.value = [];
      return;
    }
    const statusList = await prepClosingApi.getWrcSyncStatus(filters.periode);
    wrcSyncStatus.value = statusList || [];
  } catch (err) {
    console.warn('Failed to fetch WRC sync status:', err.message);
    wrcSyncStatus.value = [];
  }
};

const handleRefresh = async () => {
  await loadData();
  toast.showSuccess('Sukses', 'Data berhasil diperbarui');
};

const handlePeriodeSelect = () => {
  if (periodeDate.value) {
    const year = periodeDate.value.getFullYear().toString().slice(-2);
    const month = (periodeDate.value.getMonth() + 1).toString().padStart(2, '0');
    filters.periode = year + month;
  }
};

const handleTableRefresh = async (params = {}) => {
  console.log('🔄 Table refresh with params:', params);

  // Merge params dengan state sorting yang ada
  const mergedParams = {
    sortColumn: params.sortColumn || sortColumn.value,
    sortOrder: params.sortOrder || sortOrder.value,
    searchQuery: params.searchQuery || searchQuery.value,
    ...params
  };

  const cabParam = filters.cabang === 'All' ? undefined : filters.cabang;

  // Refresh store list DAN rules breakdown secara bersamaan
  await Promise.all([
    fetchStores(filters.periode, cabParam, mergedParams),
    fetchRulesSummary(filters.periode, cabParam),
  ]);
};

const handleRuleSelected = async (keys) => {
  selectedRuleKeys.value = keys;
  pagination.value.currentPage = 1;
  await fetchStores(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    { ruleKeys: keys, sortColumn: sortColumn.value, sortOrder: sortOrder.value, searchQuery: searchQuery.value || undefined }
  );
};

const handlePageChange = async (data) => {
  pagination.value.currentPage = data.page;

  // fetchStores akan otomatis gunakan state sorting
  await fetchStores(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    {
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value,
      searchQuery: searchQuery.value || undefined
    }
  );
};

const handleItemsPerPageChange = async (data) => {
  pagination.value.itemsPerPage = data.itemsPerPage;
  pagination.value.currentPage = 1;

  // fetchStores akan otomatis gunakan state sorting
  await fetchStores(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    {
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value,
      searchQuery: searchQuery.value || undefined
    }
  );
};

const handleSortChange = async (data) => {
  console.log('🔀 Sort changed:', data);

  // fetchStores akan otomatis update state sorting internal
  await fetchStores(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    {
      sortColumn: data.sortColumn,
      sortOrder: data.sortOrder,
      searchQuery: searchQuery.value || undefined
    }
  );
};

const handleSearchChange = async (q) => {
  searchQuery.value = q || '';
  pagination.value.currentPage = 1;
  await fetchStores(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    {
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value,
      searchQuery: searchQuery.value,
      ruleKeys: selectedRuleKeys.value
    }
  );
};

const handleViewDetails = async (store) => {
  await fetchStoreDetails(store.KDTK, filters.periode);
  detailModalVisible.value = true;
};

const handleCloseDetail = () => {
  detailModalVisible.value = false;
  selectedStore.value = null;
};

const handleStartScreening = async () => {
  try {
    // Reset progress sebelum memulai screening baru
    resetProgress();

    // === WRC GUARD: hard-block jika ada cabang yang belum sync ===
    if (wrcNotSynced.value) {
      const unsynced = requiredWrcCabs.value.filter(cab => {
        const status = wrcSyncStatus.value.find(s => s.cab === cab);
        return !status || !status.synced;
      });
      if (filters.cabang === 'All') {
        toast.showError('Error', `Data WRC belum di-sync untuk cabang: ${unsynced.join(', ')}. Silakan buka Config WRC Engine dan lakukan Sync terlebih dahulu.`);
      } else {
        toast.showError('Error', `Data WRC cabang ${filters.cabang} belum di-sync. Silakan buka Config WRC Engine dan lakukan Sync terlebih dahulu.`);
      }
      return;
    }

    if (isWrcStale.value && lastWrcSyncAt.value) {
      const lastSyncFormatted = dayjs(lastWrcSyncAt.value).tz('Asia/Jakarta').format('DD MMM YYYY HH:mm');
      toast.showWarn('Peringatan', `WRC terakhir di-sync pada ${lastSyncFormatted}. Jika ada data update di WRC setelah itu, disarankan untuk melakukan sync ulang.`);
    }

    // Pastikan ini mass screening
    isMassScreening.value = true;

    // Start screening based on filters.cabang
    if (filters.cabang === 'All') {
      console.log('🌍 Screening all cabang');
      toast.showInfo('Info', 'Memulai screening semua cabang...');
      await screenAllCabang(filters.periode, forceScreening.value);
    } else {
      console.log(`🏢 Screening cabang: ${filters.cabang}`);
      toast.showInfo('Info', `Memulai screening cabang ${filters.cabang}...`);
      await screenCabang(filters.periode, filters.cabang, forceScreening.value);
    }

    // Progress monitoring akan dimulai otomatis oleh watch isScreening
  } catch (err) {
    console.error('❌ Error starting screening:', err);
    toast.showError('Error', err.message || 'Gagal memulai screening');
    stopMonitoring();
    resetProgress();
    isMassScreening.value = false;
  }
};

const handleReScreenStore = async (store) => {
  try {
    const cabStatus = wrcSyncStatus.value.find(s => s.cab === store.CAB);
    if (!cabStatus || !cabStatus.synced) {
      toast.showError('Error', `Data WRC cabang ${store.CAB} belum di-sync. Silakan buka Config WRC Engine dan lakukan Sync terlebih dahulu.`);
      return;
    }

    // Set flag bahwa ini BUKAN mass screening
    isMassScreening.value = false;

    // JANGAN show progress dialog untuk single store
    // progressDialogVisible.value = true; // <-- HAPUS ini

    toast.showInfo('Info', `Memulai screening untuk toko ${store.KDTK}...`);

    // Start screening
    await screenStore(filters.periode, store.KDTK);

    // Langsung success untuk single store
    toast.showSuccess('Sukses', `Screening toko ${store.KDTK} selesai`);

    // Refresh data
    await loadData();

  } catch (err) {
    console.error('❌ Error re-screening store:', err);
    toast.showError('Error', err.message || 'Gagal melakukan screening');

    // Re-throw error agar bisa ditangkap di child component
    throw err;
  }
};

const handleEditNote = (store) => {
  noteStore.value = store;
  noteDialogVisible.value = true;
};

const handleSaveNote = async (noteText) => {
  if (!noteStore.value) return;

  savingNote.value = true;
  try {
    await updateNote(
      noteStore.value.CAB,
      noteStore.value.KDTK,
      filters.periode,
      noteText
    );
    toast.showSuccess('Sukses', 'Note berhasil disimpan');
    noteDialogVisible.value = false;

    // Refresh if modal is open
    if (detailModalVisible.value && selectedStore.value) {
      await fetchStoreDetails(selectedStore.value.KDTK, filters.periode);
    }
  } catch (err) {
    toast.showError('Error', err.message || 'Gagal menyimpan note');
  } finally {
    savingNote.value = false;
  }
};

const handleScreeningComplete = async () => {
  console.log('🎉 Handling screening completion');

  // Stop monitoring
  stopMonitoring();

  // Show success message
  toast.showSuccess('Sukses', 'Screening selesai! Data sedang diperbarui...');

  // Refresh all data
  await loadData();

  // Reset progress state
  resetProgress();

  // Reset mass screening flag
  isMassScreening.value = false;

  console.log('✅ Screening complete, data refreshed');
};

const handleCategoryFilter = (category) => {
  console.log('📊 Category filter clicked:', category);

  // Set search filter
  filters.search = category;

  // Reset ke page 1
  pagination.value.currentPage = 1;

  // Refresh dengan filter baru (sorting tetap terjaga)
  handleTableRefresh({
    searchQuery: category,
    sortColumn: sortColumn.value,
    sortOrder: sortOrder.value
  });
};

// severity icon moved to RulesGrid component
</script>

<style scoped src="./index.style.css"></style>
