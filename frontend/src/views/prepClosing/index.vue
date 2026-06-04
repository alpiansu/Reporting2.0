<template>
  <div class="prep-closing-view">
    <PageHeader title="Prep Closing System" subtitle="Sistem Monitoring Kesiapan Closing Toko"
      description="Halaman ini menampilkan status kesiapan closing untuk setiap toko berdasarkan rule validation yang telah ditentukan." />

    <div class="content-container">
      <!-- Filter Form (Seragam dengan Rekon) -->
      <RekonFormComponent :formData="{ cab: filters.cabang, periode: filters.periode }">
        <template #title>
          Filter Prep Closing
        </template>
        <template #description>
          Pilih cabang dan periode untuk melihat status kesiapan closing.
        </template>
        <template #cab>
          <Dropdown v-model="filters.cabang" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab" placeholder="Pilih Cabang" class="w-full" />
        </template>
        <template #periode>
          <Calendar v-model="periodeDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun" :maxDate="today" showIcon class="w-full" @date-select="handlePeriodeSelect" />
        </template>
        <template #actions>
          <Button icon="pi pi-refresh" label="Refresh" class="p-button-outlined" style="margin-right: 4px;" :disabled="isScreening || loading" @click="handleRefresh" />
          <Button icon="pi pi-bolt" label="Mulai Screening" class="p-button-primary" :disabled="!filters.periode || isScreening || !isCurrentPeriod" :loading="isScreening" @click="handleStartScreening" />
        </template>
      </RekonFormComponent>

      <!-- Advanced Config Toolbar -->
      <div class="flex justify-content-end align-items-center mb-4">
        <span class="text-color-secondary mr-3 text-sm" style="margin-top: 5px;">
          <i class="pi pi-info-circle mr-1"></i> Developer & Admin Only:
        </span>
        &nbsp;
        <Button icon="pi pi-database" label="Config WRC Engine" class="p-button-outlined p-button-warning p-button-sm mr-2" :disabled="isScreening || loading" @click="showWrcConfig = true" />
        &nbsp;
        <Button icon="pi pi-cog" label="Rule Management" class="p-button-outlined p-button-secondary p-button-sm" :disabled="isScreening || loading" @click="showRuleConfig = true" />
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
      @save="handleSaveNote" />

    <!-- Configuration Rules Dialog -->
    <RuleConfigDialog v-model:visible="showRuleConfig" @rules-updated="handleRefresh" />

    <!-- Configuration WRC Dialog -->
    <WrcExtractConfigDialog
      v-model:visible="showWrcConfig"
      :selectedPeriode="filters.periode"
      :selectedCabang="filters.cabang"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useToastService } from '@/utils/toast';
import { useAuthStore } from '@/stores';
import PageHeader from '@/components/PageHeader.vue';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import RekonFormComponent from '@/components/common/RekonFormComponent.vue';
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

const today = ref(new Date());
const periodeDate = ref(null);
const cabangOptions = ref([]);

const detailModalVisible = ref(false);
const noteDialogVisible = ref(false);
const noteStore = ref(null);
const isMassScreening = ref(false);
const showRuleConfig = ref(false);
const showWrcConfig = ref(false);

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
});

// Watch periode and cabang changes
watch([() => filters.periode, () => filters.cabang], async () => {
  if (filters.periode) {
    resetFilters();
    await loadData();
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

    // Pastikan ini mass screening
    isMassScreening.value = true;

    // Start screening based on filters.cabang
    if (filters.cabang === 'All') {
      console.log('🌍 Screening all cabang');
      toast.showInfo('Info', 'Memulai screening semua cabang...');
      await screenAllCabang(filters.periode);
    } else {
      console.log(`🏢 Screening cabang: ${filters.cabang}`);
      toast.showInfo('Info', `Memulai screening cabang ${filters.cabang}...`);
      await screenCabang(filters.periode, filters.cabang);
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

<style scoped>
.prep-closing-view {
  padding: 1.5rem;
}

.content-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}


@media (max-width: 768px) {
  .prep-closing-view {
    padding: 1rem;
  }

  .content-container {
    gap: 1rem;
  }
}
</style>
