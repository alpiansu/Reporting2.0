<template>
  <DataTable :data="data" :filteredData="filteredData" :loading="loading" :error="error" :rowClass="getRowClass"
    :loadingMessage="'Memuat data rekonsiliasi...'" :loadingHelpText="'Mohon tunggu sebentar...'"
    :emptyMessage="'Tidak ada data rekonsiliasi untuk ditampilkan.'"
    :emptyHelpText="'Tidak ditemukan data rekonsiliasi untuk cabang dan periode yang dipilih.'" :pagination="pagination"
    :tableTitle="'Nilai Penyesuaian Toko > Rp. 500.000,- atau < -Rp. 500.000,-'" @refresh="$emit('refresh')"
    @reset-filters="resetFilters" @export="exportToExcel" @page-change="handlePageChange"
    @items-per-page-change="handleItemsPerPageChange" @sort-change="handleSortChange">
    <!-- Search Component -->
    <template #filters>
      <div class="search-container">
        <div class="filters-row">
          <form @submit.prevent="handleSearch" class="search-form">
            <div class="search-box">
              <i class="pi pi-search search-icon"></i>
              <input type="text" v-model="searchQuery" @input="handleSearch" placeholder="Cari Data ..."
                class="search-input" />
              <button type="button" v-if="searchQuery" @click="clearSearch" class="clear-button">
                <i class="pi pi-times"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </template>

    <!-- Table Header for Resume Per Shop -->
    <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
      <!-- Cabang -->
      <th class="sortable" :class="getSortClass('CABANG', sortColumn, sortOrder)" @click="handleSort('CABANG')">
        Cabang
        <i v-if="sortColumn === 'CABANG'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>

      <!-- Kode Toko -->
      <th class="sortable" :class="getSortClass('KDTK', sortColumn, sortOrder)" @click="handleSort('KDTK')">
        KDTK
        <i v-if="sortColumn === 'KDTK'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>

      <!-- Nama Toko -->
      <th class="sortable" :class="getSortClass('NAMA', sortColumn, sortOrder)" @click="handleSort('NAMA')">
        Nama Toko
        <i v-if="sortColumn === 'NAMA'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>

      <!-- Nilai SESUAI -->
      <th class="text-right sortable" :class="getSortClass('SESUAI', sortColumn, sortOrder)"
        @click="handleSort('SESUAI')">
        Nilai Sesuai
        <i v-if="sortColumn === 'SESUAI'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>

      <!-- UPDTIME -->
      <th class="sortable" :class="getSortClass('UPDTIME', sortColumn, sortOrder)" @click="handleSort('UPDTIME')">
        Terakhir Update
        <i v-if="sortColumn === 'UPDTIME'" class="pi sort-icon" :class="getSortIcon(sortOrder) "></i>
      </th>

      <!-- Notes (non-sortable) -->
      <th>Notes</th>

      <!-- Actions (non-sortable) -->
      <th>Actions</th>
    </template>


    <!-- Table Row -->
    <template #table-row="{ item }">
      <!-- CABANG -->
      <td class="text-center">{{ item.CABANG }}</td>

      <!-- KDTK -->
      <td class="text-center">{{ item.KDTK }}</td>

      <!-- NAMA TOKO -->
      <td>{{ item.NAMA || '-' }}</td>

      <!-- NILAI SESUAI -->
      <td class="text-right" :class="getAmountClass(item.SESUAI)">
        {{ formatCurrency(item.SESUAI) }}
      </td>

      <!-- TERAKHIR UPDATE -->
      <td class="text-center">{{ formatDateTime(item.UPDTIME) }}</td>

      <!-- NOTES -->
      <td class="text-center note-cell">
        <div class="note-display" v-if="!item.editingNote" @click="startEditingNote(item)">
          <div class="note-category" v-if="item.note && item.note.category"
            :class="getCategoryClass(item.note.category.name)">
            {{ item.note.category.name }}
          </div>
          <div class="note-text" v-if="item.note">
            {{ item.note.noteText }}
          </div>
          <div class="note-placeholder" v-else>
            Add note...
          </div>
          <div class="note-meta-icons" v-if="item.note">
            <i class="pi pi-user note-icon note-icon-pic"
              v-tooltip.top="item.note.fullName || item.note.pic || 'Unknown'"></i>
            <i class="pi pi-clock note-icon note-icon-time"
              v-tooltip.top="item.note.updated_at ? formatDateTime(item.note.updated_at) : 'No update time'"></i>
          </div>
        </div>

        <div class="note-editor" v-else>
          <textarea v-model="item.editingNote.noteText" class="note-textarea" placeholder="Enter note..."
            @keydown.enter.prevent="saveNote(item)"></textarea>
          <div class="note-actions">
            <Button severity="secondary" raised size="small" label="Cancel" @click="cancelEditing(item)" />
            <Button severity="success" raised size="small" label="Save" :loading="isSavingNote(item)" :disabled="isSavingNote(item)" @click="saveNote(item)" />
          </div>
        </div>
      </td>

      <!-- ACTIONS -->
      <td v-if="user.role == 'admin' || user.role == 'superadmin'">
        <div class="action-buttons">
          <Button icon="pi pi-eye" size="small" severity="info" @click="showDetailModal(item)" label="Detail" />
          <Button :icon="isItemAutoUpdating(item) ? `pi pi-spin pi-refresh` : `pi pi-refresh`" size="small"
            @click="refreshStoreData(item)" :disabled="isItemAutoUpdating(item)"
            :label="isItemAutoUpdating(item) ? ` ...` : `Refresh`" />
        </div>
      </td>
    </template>

  </DataTable>

  <PenyesuaianDetailModal :show="detailModalVisible" :periode="periode" :cab="selectedItem?.CABANG"
    :kdtk="selectedItem?.KDTK || ''" :sesuai="formatCurrency(selectedItem?.SESUAI) " @close="closeDetailModal" />
</template>

<style src="./PenyesuaianTable.css" scoped></style>
<script setup>
import { ref, computed } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';
import * as XLSX from 'xlsx';
import { penyesuaianService } from '../../services/index.js';
import Button from 'primevue/button';
import { useAuthStore } from '../../stores';
import PenyesuaianDetailModal from './PenyesuaianDetailModal.vue';

const authStore = useAuthStore();
const user = computed(() => authStore.user);
const detailModalVisible = ref(false);

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
  },
  pagination: {
    type: Object,
    default: () => ({
      currentPage: 1,
      itemsPerPage: 10,
      total: 0,
      totalPages: 0
    })
  }
});

const emit = defineEmits(['refresh', 'page-change', 'items-per-page-change', 'sort-change']);
const toast = useToastService();
const autoUpdatingItems = ref(new Set());
const highlightedItems = ref(new Set());
const savingNotes = ref(new Set());
const selectedItem = ref(null);

// Search functionality
const searchQuery = ref('');
const searchTimeout = ref(null);

// Computed properties
const filteredData = computed(() => {
  if (Array.isArray(props.data)) {
     return props.data;
  }
  return [];
});



// Helper function untuk cek apakah item sedang loading
const isItemAutoUpdating = (item) => {
  const itemKey = `${item.CABANG}_${item.KDTK}`;
  return autoUpdatingItems.value.has(itemKey);
};

//  TAMBAHKAN: Helper untuk check apakah item di-highlight
const isItemHighlighted = (item) => {
  const itemKey = `${item.CABANG}_${item.KDTK}`;
  return highlightedItems.value.has(itemKey);
};

// Fungsi untuk mendapatkan kelas CSS berdasarkan nama kategori
const getCategoryClass = (categoryName) => {
  if (!categoryName) return '';
  // Normalisasi nama kategori untuk digunakan sebagai kelas CSS
  return `category-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
};

//  TAMBAHKAN: Method untuk get row class
const getRowClass = (item) => {
  return isItemHighlighted(item) ? 'row-updated' : '';
};

// Formatting methods
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getAmountClass = (amount) => {
  if (!amount || amount === 0) return '';
  return amount < 0 ? 'negative-amount' : 'positive-amount';
};

const getSortClass = (column, currentColumn, currentOrder) => {
  if (column !== currentColumn) return '';
  return currentOrder === 'asc' ? 'sort-asc' : 'sort-desc';
};

const getSortIcon = (sortOrder) => {
  return sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down';
};

// Search methods
const handleSearch = () => {
  clearTimeout(searchTimeout.value);
  searchTimeout.value = setTimeout(() => {
    emit('refresh', { 
      searchQuery: searchQuery.value,
      page: 1
    });
  }, 500);
};

const clearSearch = () => {
  searchQuery.value = '';
  emit('refresh', { 
    searchQuery: '',
    page: 1
  });
};

const resetFilters = () => {
  searchQuery.value = '';
  emit('refresh', { 
    searchQuery: '',
    page: 1
  });
};

// Pagination methods
const handlePageChange = (data) => {
  emit('page-change', data);
};

const handleItemsPerPageChange = (data) => {
  emit('items-per-page-change', data);
};

const handleSortChange = (data) => {
  emit('sort-change', data);
};

// Export to Excel
const exportToExcel = async () => {
  try {
    toast.showInfo('Proses', 'Sedang mengambil data lengkap untuk ekspor...');

    const response = await penyesuaianService.getData(props.cab, props.periode);

    const data = Array.isArray(response?.data) ? response.data : response;
    if (!data || data.length === 0) {
      toast.showWarning('Perhatian', 'Tidak ada data untuk diekspor');
      return;
    }

    const exportData = data.map(item => ({
      'Cabang': item.CABANG,
      'KDTK': item.KDTK,
      'Periode': item.PERIODE,
      'Nilai Sesuai': item.SESUAI,
      'Terakhir Update': formatDateTime(item.UPDTIME),
      'Note': item.note ? item.note.noteText : '',
      'PIC Note': item.note ? (item.note.fullName || item.note.pic || '') : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Penyesuaian');

    const filename = `penyesuaian_resume_${props.cab}_${props.periode}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast.showSuccess('Sukses', `Data lengkap berhasil diekspor ke Excel (${exportData.length} baris)`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.showError('Error', 'Gagal mengekspor data ke Excel');
  }
};

// Note editing functionality
const startEditingNote = (item) => {
  // Create a copy of the note for editing
  item.editingNote = {
    noteText: item.note ? item.note.noteText : '',
    categoryId: item.note && item.note.categoryId ? item.note.categoryId : ''
  };
};

const isSavingNote = (item) => {
  return savingNotes.value.has(`${item.CABANG}_${item.KDTK}`);
};

const saveNote = async (item) => {
  const itemKey = `${item.CABANG}_${item.KDTK}`;
  savingNotes.value.add(itemKey);
  try {
    // Update note through the service
    const response = await penyesuaianService.updateNote({
      cabang: item.CABANG,
      kdtk: item.KDTK,
      periode: props.periode,
      noteText: item.editingNote.noteText,
    });

    // Update the item with the new note data
    item.note = response.data;
    item.editingNote = null;
    
    toast.showSuccess('Success', 'Note saved successfully');
  } catch (error) {
    console.error('Error saving note:', error);
    toast.showError('Error', `Failed to save note: ${error}`);
  } finally {
    savingNotes.value.delete(itemKey);
  }
};

const cancelEditing = (item) => {
  item.editingNote = null;
};

const showDetailModal = (item) => {
  selectedItem.value = item;
  detailModalVisible.value = true;
};

const closeDetailModal = () => {
  detailModalVisible.value = false;
  selectedItem.value = null;
};

const refreshStoreData = async (item) => {
  const itemKey = `${item.CABANG}_${item.KDTK}`;
  try {
    autoUpdatingItems.value.add(itemKey);
    
    await penyesuaianService.refreshStore(item.KDTK, props.periode);
    
    const res = await penyesuaianService.getSingleResumeKdtk(props.periode, item.KDTK);
    const newDataArray = res?.data;
    
    // ➜ JIKA HASILNYA NULL / KOSONG → HAPUS ROW
    if (!newDataArray || newDataArray.length === 0) {
      toast.showInfo('Info', `Toko ${item.KDTK} sudah sesuai, menghapus baris...`);
      emit('refresh'); // Refresh parent to remove row
      return;
    }

    // ➜ JIKA ADA DATA BARU → UPDATE FIELD-NYA
    const newData = newDataArray[0];
    item.UPDTIME = newData.UPDTIME;
    item.SESUAI = newData.SESUAI;
    if (newData.note) item.note = newData.note;

    highlightedItems.value.add(itemKey);
    toast.showSuccess('Sukses', `Data toko ${item.KDTK} berhasil diperbarui`);
    
    // Keep highlight for visual feedback (3 seconds)
    setTimeout(() => { highlightedItems.value.delete(itemKey); }, 3000);
  } catch (error) {
    console.error('Error refreshing store data:', error);
    toast.showError('Error', `Gagal memperbarui data toko ${item.KDTK}`);
  } finally {
    autoUpdatingItems.value.delete(itemKey);
  }
};
</script>

