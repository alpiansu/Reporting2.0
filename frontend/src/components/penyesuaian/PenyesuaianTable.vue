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
            <!-- Snapshot Badge -->
            <span v-if="getSnapshotInfo(item)" class="snapshot-badge"
              :class="getSnapshotBadgeClass(item)"
              v-tooltip.top="getSnapshotTooltip(item)">
              {{ getSnapshotLabel(item) }}
            </span>
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
            <Button severity="danger" raised size="small" icon="pi pi-trash" v-if="item.note" @click="confirmDeleteNote(item)" :disabled="isDeletingNote(item)" />
            <Button severity="success" raised size="small" label="Save" :loading="isSavingNote(item)" :disabled="isSavingNote(item)" @click="saveNote(item)" />
          </div>
        </div>
      </td>

      <!-- ACTIONS -->
      <td v-if="user.role == 'admin' || user.role == 'superadmin'">
        <div class="action-buttons">
          <Button icon="pi pi-eye" size="small" severity="info" @click="showDetailModal(item)" label="Detail"
            :disabled="isItemBusy(item)" />
          <Button :icon="isItemAutoUpdating(item) ? `pi pi-spin pi-refresh` : `pi pi-refresh`" size="small"
            @click="refreshStoreData(item)" :disabled="isItemBusy(item)"
            :label="isItemAutoUpdating(item) ? ` ...` : `Refresh`" />
          <Button
            :label="isItemAutoNoting(item) ? 'Processing...' : 'Auto Note'"
            @click="hitAutoNote(item)"
            :disabled="isItemBusy(item)"
            :icon="isItemAutoNoting(item) ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
            :class="{ 'btn-processing': isItemAutoNoting(item) }"
            severity="secondary" outlined size="small"
          />
        </div>
      </td>
    </template>

  </DataTable>

  <PenyesuaianDetailModal :show="detailModalVisible" :periode="periode" :cab="selectedItem?.CABANG"
    :kdtk="selectedItem?.KDTK || ''" :sesuai="formatCurrency(selectedItem?.SESUAI)"
    :noteSnapshotData="getSnapshotInfo(selectedItem)" @close="closeDetailModal" />

  <!-- Auto Note Confirmation Dialog -->
  <Dialog v-model:visible="autoNoteDialogVisible" header="Konfirmasi Auto Note" :modal="true" :closable="true"
    class="auto-note-dialog" :style="{ width: '450px' }">
    <div class="confirm-content">
      <i class="pi pi-refresh confirm-icon"></i>
      <p>Catatan sudah ada sebelumnya. Apakah Anda ingin menimpa catatan lama dengan auto note baru?</p>
    </div>
    <template #footer>
      <Button label="Batal" severity="secondary" @click="cancelAutoNote" />
      <Button label="Ya, Timpa!" severity="success" icon="pi pi-check" @click="executeAutoNote()" />
    </template>
  </Dialog>

  <!-- Delete Note Confirmation Dialog -->
  <Dialog v-model:visible="deleteDialogVisible" header="Hapus Note" :modal="true" :closable="true"
    class="delete-note-dialog" :style="{ width: '400px' }">
    <div class="delete-confirm-content">
      <i class="pi pi-exclamation-triangle delete-warning-icon"></i>
      <p>Apakah Anda yakin ingin menghapus note untuk toko <strong>{{ itemToDelete?.KDTK }}</strong>?</p>
      <p class="delete-warning-text">Tindakan ini tidak dapat dibatalkan.</p>
    </div>
    <template #footer>
      <Button label="Batal" severity="secondary" @click="cancelDeleteNote" :disabled="deletingNote" />
      <Button label="Ya, Hapus" severity="danger" icon="pi pi-trash" @click="executeDeleteNote"
        :loading="deletingNote" :disabled="deletingNote" />
    </template>
  </Dialog>
</template>

<style src="./PenyesuaianTable.css" scoped></style>

<style scoped>
.confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  text-align: center;
}
.confirm-content p {
  margin: 0;
  font-size: 0.95rem;
  color: #374151;
  line-height: 1.5;
}
.confirm-icon {
  font-size: 2rem;
  color: #3b82f6;
}
.btn-processing {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
<script setup>
import { ref, computed } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';
import * as XLSX from 'xlsx';
import { penyesuaianService } from '../../services/index.js';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
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
const deletingNote = ref(false);
const deleteDialogVisible = ref(false);
const itemToDelete = ref(null);
const selectedItem = ref(null);

// Auto Note state
const autoNoteDialogVisible = ref(false);
const selectedAutoNoteItem = ref(null);
const autoNotingItems = ref(new Set());

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
const isWorsened = (item) => {
  const info = getSnapshotInfo(item);
  if (!info) return false;
  return !info.membaik && info.persen >= 40;
};

const getRowClass = (item) => {
  if (isWorsened(item)) return 'row-worsened';
  if (isItemHighlighted(item)) return 'row-updated';
  return '';
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
      'Note': item.note ? stripSnapshotFromText(item.note.noteText, item.note.snapshot) : '',
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

// ─── Snapshot Helpers ────────────────────────────────────────────────
// Hitung delta antara snapshot SESUAI saat note dibuat vs nilai sekarang
const getSnapshotInfo = (item) => {
  if (!item || !item.note?.snapshot) return null;
  const { sesuaSaatNote } = item.note.snapshot;
  const sesuaSekarang = Number(item.SESUAI) || 0;
  if (!sesuaSaatNote) return null;

  const selisih = sesuaSekarang - sesuaSaatNote;
  const persen = sesuaSaatNote !== 0
    ? Math.round((Math.abs(selisih) / Math.abs(sesuaSaatNote)) * 100)
    : 0;
  const membaik = Math.abs(sesuaSekarang) < Math.abs(sesuaSaatNote);

  return { sesuaSaatNote, sesuaSekarang, selisih, persen, membaik };
};

const getSnapshotBadgeClass = (item) => {
  const info = getSnapshotInfo(item);
  if (!info) return '';
  return info.membaik ? 'snapshot-badge-improved' : 'snapshot-badge-worsened';
};

const getSnapshotLabel = (item) => {
  const info = getSnapshotInfo(item);
  if (!info) return '';
  const arrow = info.membaik ? '\u25BC' : '\u25B2';
  return `${arrow} ${info.persen}%`;
};

const getSnapshotTooltip = (item) => {
  const info = getSnapshotInfo(item);
  if (!info) return 'Tidak ada data histori';
  const arrow = info.membaik ? '\u25BC membaik' : '\u25B2 memburuk';
  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  return [
    `Saat note: ${fmt(info.sesuaSaatNote)}`,
    `Sekarang:  ${fmt(info.sesuaSekarang)}`,
    `Bergerak:  ${info.selisih >= 0 ? '+' : ''}${fmt(info.selisih)} (${arrow})`,
  ].join('\n');
};

// Strip snapshot suffix dari noteText untuk export (safety fallback)
function stripSnapshotFromText(noteText, snapshot) {
  // Jika sudah ada snapshot di response, noteText sudah clean dari backend
  if (snapshot) return noteText;
  // Fallback: manual split dari belakang
  if (!noteText) return '';
  const parts = noteText.split('|');
  if (parts.length < 3) return noteText;
  const ses = parts[parts.length - 2];
  const upd = parts[parts.length - 1];
  if (!/^-?\d+$/.test(ses) || !/^\d{4}-\d{2}-\d{2}/.test(upd)) return noteText;
  return parts.slice(0, -2).join('|');
}

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

// ─── Delete Note ─────────────────────────────────────────────────────

const isDeletingNote = (item) => {
  return deletingNote.value && itemToDelete.value === item;
};

const confirmDeleteNote = (item) => {
  itemToDelete.value = item;
  deleteDialogVisible.value = true;
};

const cancelDeleteNote = () => {
  deleteDialogVisible.value = false;
  itemToDelete.value = null;
};

const executeDeleteNote = async () => {
  if (!itemToDelete.value) return;

  const item = itemToDelete.value;
  deletingNote.value = true;

  try {
    try {
      await penyesuaianService.deleteNote(item.KDTK, props.periode);
    } catch (deleteErr) {
      // Jika 404 (note sudah dihapus user lain), anggap sukses — tetap bersihkan lokal
      if (deleteErr.response?.status !== 404) {
        throw deleteErr;
      }
    }

    // Clear the note from the item
    item.note = null;
    item.editingNote = null;

    toast.showSuccess('Sukses', 'Note berhasil dihapus');
    deleteDialogVisible.value = false;
    itemToDelete.value = null;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Gagal menghapus note';
    toast.showError('Error', errorMessage);
  } finally {
    deletingNote.value = false;
  }
};

const showDetailModal = (item) => {
  selectedItem.value = item;
  detailModalVisible.value = true;
};

const closeDetailModal = () => {
  detailModalVisible.value = false;
  selectedItem.value = null;
};

// Helper: cek apakah item sedang sibuk (auto-note atau refresh)
const isItemBusy = (item) => {
  const key = `${item.CABANG}_${item.KDTK}`;
  return autoUpdatingItems.value.has(key) || autoNotingItems.value.has(key);
};

// ─── Auto Note Methods ──────────────────────────────────────────────
const isItemAutoNoting = (item) => {
  const key = `${item.CABANG}_${item.KDTK}`;
  return autoNotingItems.value.has(key);
};

const hitAutoNote = (item) => {
  // Jika belum ada note, langsung auto-generate
  if (!item.note || !item.note.noteText || item.note.noteText.trim() === '') {
    executeAutoNote(item);
    return;
  }
  // Jika sudah ada note, tampilkan dialog konfirmasi
  selectedAutoNoteItem.value = item;
  autoNoteDialogVisible.value = true;
};

const cancelAutoNote = () => {
  autoNoteDialogVisible.value = false;
  selectedAutoNoteItem.value = null;
};

const executeAutoNote = async (item) => {
  const target = item || selectedAutoNoteItem.value;
  if (!target) return;

  autoNoteDialogVisible.value = false;
  selectedAutoNoteItem.value = null;

  const key = `${target.CABANG}_${target.KDTK}`;
  autoNotingItems.value.add(key);

  try {
    const res = await penyesuaianService.autoUpdateNote(
      target.CABANG,
      target.KDTK,
      props.periode
    );

    target.note = res.data.data;

    // Highlight row
    highlightedItems.value.add(key);
    setTimeout(() => { highlightedItems.value.delete(key); }, 3000);

    toast.showSuccess('Sukses', `Auto note untuk ${target.KDTK} berhasil dibuat`);
  } catch (error) {
    const msg = error.response?.data?.message || error.message || 'Gagal auto note';
    toast.showError('Error', msg);
  } finally {
    autoNotingItems.value.delete(key);
  }
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

