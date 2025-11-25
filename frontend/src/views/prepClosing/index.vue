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
import { useAuthStore, useCabangStore } from '@/stores';
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
const cabangStore = useCabangStore();

// Composables
const {
  loading,
  error,
  summary,
  stores,
  selectedStore,
  categories,
  pagination,
  fetchSummary,
  fetchStores,
  fetchStoreDetails,
  fetchCategories,
  updateNote,
  refreshAll
} = usePrepClosing();

const {
  isScreening,
  screenStore,
  screenCabang,
  screenAllCabang
} = useScreening();

const username = authStore.user?.username || '';
const { progress: progressData, startMonitoring, stopMonitoring, resetProgress } = useProgress(username);

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
    await loadData();
  }
});

// Methods
const loadData = async () => {
  await refreshAll(filters.periode, filters.cabang === 'All' ? undefined : filters.cabang);
};

const handleRefresh = async () => {
  await loadData();
  toast.showSuccess('Sukses', 'Data berhasil diperbarui');
};

const handleTableRefresh = async (params) => {
  await fetchStores(filters.periode, filters.cabang === 'All' ? undefined : filters.cabang, params);
};

const handlePageChange = async (data) => {
  pagination.value.currentPage = data.page;
  await fetchStores(filters.periode, filters.cabang === 'All' ? undefined : filters.cabang);
};

const handleItemsPerPageChange = async (data) => {
  pagination.value.itemsPerPage = data.itemsPerPage;
  pagination.value.currentPage = 1;
  await fetchStores(filters.periode, filters.cabang === 'All' ? undefined : filters.cabang);
};

const handleSortChange = async (data) => {
  await fetchStores(filters.periode, filters.cabang === 'All' ? undefined : filters.cabang, {
    sortColumn: data.sortColumn,
    sortOrder: data.sortOrder
  });
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
  progressDialogVisible.value = true;

  try {
    if (data.level === 'store' && data.kdtk) {
      await screenStore(filters.periode, data.kdtk);
    } else if (data.level === 'cabang') {
      await screenCabang(filters.periode, filters.cabang);
    } else {
      await screenAllCabang(filters.periode);
    }

    // Start progress monitoring
    startMonitoring();
  } catch (err) {
    toast.showError('Error', err.message || 'Gagal memulai screening');
    progressDialogVisible.value = false;
  }
};

const handleReScreenStore = async (store) => {
  try {
    toast.showInfo('Info', `Memulai screening untuk toko ${store.KDTK}...`);

    // Await screenStore
    await screenStore(filters.periode, store.KDTK);

    toast.showSuccess('Sukses', `Screening toko ${store.KDTK} selesai`);

    // Refresh data
    await loadData();

    // Penting: tidak ada throw error di sini jika sukses
  } catch (err) {
    console.error('Error re-screening store:', err);
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
  stopMonitoring();
  resetProgress();
  progressDialogVisible.value = false;
  toast.showSuccess('Sukses', 'Screening selesai!');
  await loadData();
};

const handleMinimizeProgress = () => {
  progressDialogVisible.value = false;
  // Progress monitoring continues in background
};

const handleCategoryFilter = (category) => {
  // Filter stores by category
  filters.search = category;
  handleTableRefresh({ searchQuery: category });
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