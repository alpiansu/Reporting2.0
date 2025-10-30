<template>
  <DataTable :data="data" :filteredData="filteredData" :loading="loading" :error="error"
    :loadingMessage="'Memuat data rekonsiliasi...'" :loadingHelpText="'Mohon tunggu sebentar...'"
    :emptyMessage="'Tidak ada data rekonsiliasi untuk ditampilkan.'"
    :emptyHelpText="'Tidak ditemukan data rekonsiliasi untuk cabang dan periode yang dipilih.'" :pagination="pagination"
    :tableTitle="'Saldo Virtual Margin Based'" @refresh="$emit('refresh')" @reset-filters="resetFilters"
    @export="exportToExcel" @print="printResults" @page-change="handlePageChange"
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

    <!-- Table Header with Sorting -->
    <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
      <th class="sortable" :class="getSortClass('CABANG', sortColumn, sortOrder)" @click="handleSort('CABANG')">
        Cabang
        <i v-if="sortColumn === 'CABANG'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('SHOP', sortColumn, sortOrder)" @click="handleSort('SHOP')">
        Shop
        <i v-if="sortColumn === 'SHOP'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('TANGGAL', sortColumn, sortOrder)" @click="handleSort('TANGGAL')">
        Tanggal
        <i v-if="sortColumn === 'TANGGAL'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('PRDCD', sortColumn, sortOrder)" @click="handleSort('PRDCD')">
        Kode Produk
        <i v-if="sortColumn === 'PRDCD'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th>Nama Produk</th>
      <th class="text-right sortable" :class="getSortClass('ACOST', sortColumn, sortOrder)"
        @click="handleSort('ACOST')">
        Hpp
        <i v-if="sortColumn === 'ACOST'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('PRICE', sortColumn, sortOrder)"
        @click="handleSort('PRICE')">
        Price
        <i v-if="sortColumn === 'PRICE'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('QTY_MSTRAN', sortColumn, sortOrder)"
        @click="handleSort('QTY_MSTRAN')">
        Qty MSTRAN
        <i v-if="sortColumn === 'QTY_MSTRAN'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('QTY_MTRAN', sortColumn, sortOrder)"
        @click="handleSort('QTY_MTRAN')">
        Qty MTRAN
        <i v-if="sortColumn === 'QTY_MTRAN'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-right sortable" :class="getSortClass('SEL', sortColumn, sortOrder)" @click="handleSort('SEL')">
        Selisih
        <i v-if="sortColumn === 'SEL'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-center sortable" :class="getSortClass('RECID', sortColumn, sortOrder)"
        @click="handleSort('RECID')">
        Adjust
        <i v-if="sortColumn === 'RECID'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="sortable" :class="getSortClass('LASTCATCH', sortColumn, sortOrder)" @click="handleSort('LASTCATCH')">
        Last Catch
        <i v-if="sortColumn === 'LASTCATCH'" class="pi sort-icon" :class="getSortIcon(sortOrder)"></i>
      </th>
      <th class="text-center sortable" :class="getSortClass('note.noteText', sortColumn, sortOrder)"
        @click="handleSort('note.noteText')">Notes
        <i v-if="sortColumn === 'note.noteText'" class="pi sort-icon" :class="getSortIcon(sortOrder) "></i>
      </th>
    </template>

    <!-- Table Row -->
    <template #table-row="{ item }">
      <td class="text-center">{{ item.CABANG }}</td>
      <td class="text-center">{{ item.SHOP }}</td>
      <td class="text-center">{{ formatDate(item.TANGGAL) }}</td>
      <td class="text-center">{{ item.PRDCD }}</td>
      <td>{{ item.SINGKATAN || '-' }}</td>
      <td class="text-right">{{ formatCurrency(item.ACOST) }}</td>
      <td class="text-right">{{ formatCurrency(item.PRICE) }}</td>
      <td class="text-right">{{ formatNumber(item.QTY_MSTRAN) }}</td>
      <td class="text-right">{{ formatNumber(item.QTY_MTRAN) }}</td>
      <td class="text-right" :class="getAmountClass(item.SEL)">
        {{ formatNumber(item.SEL) }}
      </td>
      <td class="text-center">
        <input type="checkbox" :checked="item.RECID === '1'" @change="updateAdjustStatus(item, $event)"
          class="adjust-checkbox" />
      </td>
      <td class="text-center">{{ formatDateTime(item.LASTCATCH) }}</td>
      <td class="text-center note-cell">
        <div class="note-display" v-if="!item.editingNote" @click="startEditingNote(item)">
          <div class="note-category" v-if="item.note && item.note.category">
            {{ item.note.category.name }}
          </div>
          <div class="note-text" v-if="item.note">
            {{ item.note.noteText }}
          </div>
          <div class="note-placeholder" v-else>
            Add note...
          </div>
        </div>
        <div class="note-editor" v-else>
          <select v-model="item.editingNote.categoryId" class="note-category-select" @change="updateNoteCategory(item)">
            <option value="">Select Category</option>
            <option v-for="category in noteCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <textarea v-model="item.editingNote.noteText" class="note-textarea" placeholder="Enter note..."
            @keydown.enter.prevent="saveNote(item)"></textarea>
          <div class="note-actions">
            <button class="btn btn-sm btn-secondary" @click="cancelEditing(item)">Cancel</button>
            <button class="btn btn-sm btn-success" @click="saveNote(item)">Save</button>
          </div>
        </div>
      </td>
    </template>
  </DataTable>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToastService } from '../../utils/toast';
import DataTable from '../common/DataTable.vue';
import * as XLSX from 'xlsx';
import { noteCategoriesService, rekonVirtualMrgService } from '../../services/index.js';
import './RekonVirtualMrgTable.css';

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

// Search functionality
const searchQuery = ref('');
const searchTimeout = ref(null);

// Note categories
const noteCategories = ref([]);

// Computed properties
const filteredData = computed(() => {
  if (Array.isArray(props.data)) {
    return props.data;
  }
  return [];
});

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

// Update adjust status
const updateAdjustStatus = async (item, event) => {
  try {
    const newRecid = event.target.checked ? '1' : '*';
    
    await rekonVirtualMrgService.updateRecid(
      item.CABANG,
      item.SHOP,
      item.TANGGAL,
      item.PRDCD,
      newRecid
    );
    
    toast.showSuccess('Sukses', `Status adjust untuk ${item.SHOP} ${item.PRDCD} berhasil diperbarui`);
    
    // Refresh the table to show updated data
    // emit('refresh');
  } catch (error) {
    console.error('Error updating adjust status:', error);
    toast.showError('Error', 'Gagal memperbarui status adjust');
    
    // Revert the checkbox state if update failed
    event.target.checked = !event.target.checked;
  }
};

// Export to Excel
const exportToExcel = () => {
  if (!props.data || props.data.length === 0) {
    toast.showWarning('Perhatian', 'Tidak ada data untuk diekspor');
    return;
  }

  try {
    // Prepare data for export
    const exportData = props.data.map(item => ({
      'Cabang': item.CABANG,
      'Shop': item.SHOP,
      'Tanggal': formatDate(item.TANGGAL),
      'Kode Produk': item.PRDCD,
      'Nama Produk': item.SINGKATAN || '-',
      'Cost': item.ACOST,
      'Price': item.PRICE,
      'Qty MSTRAN': item.QTY_MSTRAN,
      'Qty MTRAN': item.QTY_MTRAN,
      'Selisih': item.SEL,
      'Adjust': item.RECID === '1' ? 'Sudah' : 'Belum',
      'Last Catch': formatDateTime(item.LASTCATCH)
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Rekon Virtual');

    // Generate filename
    const filename = `rekon_virtual_margin_${props.cab}_${props.periode}_${new Date().getTime()}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);

    toast.showSuccess('Sukses', 'Data berhasil diekspor ke Excel');
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.showError('Error', 'Gagal mengekspor data ke Excel');
  }
};

// Print functionality
const printResults = () => {
  window.print();
};

// Load note categories
const loadNoteCategories = async () => {
  try {
    const response = await noteCategoriesService.getAllByModule({
      module: 'rekonVirtualMrg'
    });
    noteCategories.value = response.data.data || [];
  } catch (error) {
    console.error('Error loading note categories:', error);
    toast.showError('Error', 'Failed to load note categories');
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

const updateNoteCategory = (item) => {
  // This function is called when category is changed
  // We could update the category name display here if needed
};

const saveNote = async (item) => {
  try {
    // Update note through the service
    const response = await rekonVirtualMrgService.updateNote(
      item.CABANG,
      item.SHOP,
      item.TANGGAL,
      item.PRDCD,
      {
        noteText: item.editingNote.noteText,
        categoryId: item.editingNote.categoryId || null,
      }
    );

    // Update the item with the new note data
    item.note = response.data;
    item.editingNote = null;
    
    toast.showSuccess('Success', 'Note saved successfully');
  } catch (error) {
    console.error('Error saving note:', error);
    toast.showError('Error', `Failed to save note: ${error}`);
  }
};

const cancelEditing = (item) => {
  item.editingNote = null;
};

// Lifecycle
onMounted(() => {
  loadNoteCategories();
});
</script>
