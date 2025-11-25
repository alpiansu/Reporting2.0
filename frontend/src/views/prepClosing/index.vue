<template>
  <div class="prep-closing-view">
    <PageHeader title="Prep Closing System" subtitle="Sistem Monitoring Kesiapan Closing Toko"
      description="Halaman ini menampilkan status kesiapan closing untuk setiap toko berdasarkan rule validation yang telah ditentukan." />

    <div class="content-container">
      <!-- Filter Bar -->
      <FilterBar v-model:periode="filters.periode" v-model:cabang="filters.cabang" v-model:search="filters.search"
        @refresh="handleRefresh" @start-screening="handleStartScreening" />

      <!-- Dashboard Summary -->
      <Dashboard v-if="summary" :summary="summary" :loading="loading" :categories="categories"
        @category-click="handleCategoryFilter" />

      <!-- Store List Table -->
      <StoreListTable :data="stores" :loading="loading" :error="error" :pagination="pagination"
        :periode="filters.periode" :onReScreen="handleReScreenStore" @refresh="handleTableRefresh"
        @page-change="handlePageChange" @items-per-page-change="handleItemsPerPageChange"
        @sort-change="handleSortChange" @view-details="handleViewDetails"
        @edit-note="handleEditNote" />
    </div>

    <!-- Store Detail Modal -->
    <StoreDetailModal v-model:visible="detailModalVisible" :store="selectedStore" :periode="filters.periode"
      :loading="loading" @close="handleCloseDetail" @re-screen="handleReScreenFromModal" @edit-note="handleEditNote" />

    <!-- Screening Dialog -->
    <ScreeningDialog v-model:visible="screeningDialogVisible" :periode="filters.periode" :cabang="filters.cabang"
      :level="screeningLevel" @start="handleConfirmScreening" />

    <!-- Progress Dialog -->
    <ProgressDialog v-model:visible="progressDialogVisible" :progress="progressData" @complete="handleScreeningComplete"
      @minimize="handleMinimizeProgress" />

    <!-- Note Dialog -->
    <NoteDialog v-model:visible="noteDialogVisible" :store="noteStore" :periode="filters.periode"
      @save="handleSaveNote" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useToastService } from '@/utils/toast';
import { useAuthStore } from '@/stores';
import PageHeader from '@/components/PageHeader.vue';
import FilterBar from './components/FilterBar.vue';
import Dashboard from './components/Dashboard.vue';
import StoreListTable from './components/StoreListTable.vue';
import StoreDetailModal from './components/StoreDetailModal.vue';
import ScreeningDialog from './components/ScreeningDialog.vue';
import ProgressDialog from './components/ProgressDialog.vue';
import NoteDialog from './components/NoteDialog.vue';
import { usePrepClosing } from './composables/usePrepClosing';
import { useScreening } from './composables/useScreening';
import { useProgress } from './composables/useProgress';

const toast = useToastService();
const authStore = useAuthStore();

// Composables
const {
  loading,
  error,
  summary,
  stores,
  selectedStore,
  categories,
  pagination,
  fetchStores,
  fetchStoreDetails,
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

const detailModalVisible = ref(false);
const screeningDialogVisible = ref(false);
const progressDialogVisible = ref(false);
const noteDialogVisible = ref(false);
const screeningLevel = ref('all');
const noteStore = ref(null);
const isMassScreening = ref(false);

// Initialize
onMounted(async () => {
  // Set default periode to current month
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  filters.periode = year + month;

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
    console.log('🎬 Mass screening started, showing progress dialog');
    progressDialogVisible.value = true;
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
      progressDialogVisible.value = false;
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

const handleTableRefresh = async (params = {}) => {
  console.log('🔄 Table refresh with params:', params);

  // Merge params dengan state sorting yang ada
  const mergedParams = {
    sortColumn: params.sortColumn || sortColumn.value,
    sortOrder: params.sortOrder || sortOrder.value,
    searchQuery: params.searchQuery || searchQuery.value,
    ...params
  };

  await fetchStores(
    filters.periode,
    filters.cabang === 'All' ? undefined : filters.cabang,
    mergedParams
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

const handleViewDetails = async (store) => {
  await fetchStoreDetails(store.KDTK, filters.periode);
  detailModalVisible.value = true;
};

const handleCloseDetail = () => {
  detailModalVisible.value = false;
  selectedStore.value = null;
};

const handleStartScreening = () => {
  screeningDialogVisible.value = true;
};

const handleConfirmScreening = async (data) => {
  screeningDialogVisible.value = false;

  try {
    // Reset progress sebelum memulai screening baru
    resetProgress();

    // Tentukan apakah ini mass screening atau single store
    const isSingleStore = data.level === 'store' && data.kdtk;
    isMassScreening.value = !isSingleStore;

    // Show progress dialog HANYA untuk mass screening
    if (isMassScreening.value) {
      progressDialogVisible.value = true;
    }

    // Start screening based on level
    if (data.level === 'cabang') {
      console.log(`🏢 Screening cabang: ${filters.cabang}`);
      toast.showInfo('Info', `Memulai screening cabang ${filters.cabang}...`);
      await screenCabang(filters.periode, filters.cabang);

    } else {
      console.log('🌍 Screening all cabang');
      toast.showInfo('Info', 'Memulai screening semua cabang...');
      await screenAllCabang(filters.periode);
    }

    // Progress monitoring akan dimulai otomatis oleh watch isScreening (jika mass screening)

  } catch (err) {
    console.error('❌ Error starting screening:', err);
    toast.showError('Error', err.message || 'Gagal memulai screening');
    progressDialogVisible.value = false;
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

const handleReScreenFromModal = async () => {
  if (selectedStore.value) {
    await handleReScreenStore(selectedStore.value);
    await fetchStoreDetails(selectedStore.value.KDTK, filters.periode);
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

  // Close dialog
  progressDialogVisible.value = false;

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

const handleMinimizeProgress = () => {
  console.log('📦 Minimizing progress dialog, monitoring continues in background');
  progressDialogVisible.value = false;
  // Progress monitoring continues in background
  toast.showInfo('Info', 'Progress monitoring berjalan di background');
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