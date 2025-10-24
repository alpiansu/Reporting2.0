<template>
  <div class="notes-view">
    <PageHeader 
      title="Notes Management" 
      subtitle="Manage application notes" 
      description="View and manage notes used throughout the system."
    />
    
    <div class="content-container">
      <DataTable 
        :data="notes" 
        :filtered-data="filteredNotes" 
        :loading="loading" 
        :error="error"
        :loadingMessage="'Memuat data notes...'" 
        :loadingHelpText="'Mohon tunggu sebentar...'"
        :emptyMessage="'Tidak ada notes untuk ditampilkan.'"
        :emptyHelpText="'Tidak ditemukan notes untuk kriteria yang dipilih.'"
        :pagination="pagination"
        :tableTitle="'Daftar Notes'"
        @refresh="loadNotes" 
        @page-change="handlePageChange"
        @items-per-page-change="handleItemsPerPageChange"
        @sort-change="handleSortChange">
        
        <!-- Search Component -->
        <template #filters>
          <div class="search-container">
            <div class="filters-row">
              <form @submit.prevent="handleSearch" class="search-form">
                <div class="search-box">
                  <i class="pi pi-search search-icon"></i>
                  <input 
                    type="text" 
                    v-model="searchQuery" 
                    @input="handleSearch"
                    placeholder="Cari notes..." 
                    class="search-input"
                  />
                  <button 
                    type="button" 
                    v-if="searchQuery" 
                    @click="clearSearch" 
                    class="clear-button">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </template>

        <!-- Table Header with Sorting -->
        <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'Cabang' && sortOrder === 'asc', 'sort-desc': sortColumn === 'Cabang' && sortOrder === 'desc' }" 
            @click="handleSort('Cabang')">
            Cabang
            <i 
              v-if="sortColumn === 'Cabang'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'tableName' && sortOrder === 'asc', 'sort-desc': sortColumn === 'tableName' && sortOrder === 'desc' }" 
            @click="handleSort('tableName')">
            Table Name
            <i 
              v-if="sortColumn === 'tableName'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'unixKey' && sortOrder === 'asc', 'sort-desc': sortColumn === 'unixKey' && sortOrder === 'desc' }" 
            @click="handleSort('unixKey')">
            Unix Key
            <i 
              v-if="sortColumn === 'unixKey'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'noteText' && sortOrder === 'asc', 'sort-desc': sortColumn === 'noteText' && sortOrder === 'desc' }" 
            @click="handleSort('noteText')">
            Note Text
            <i 
              v-if="sortColumn === 'noteText'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'pic' && sortOrder === 'asc', 'sort-desc': sortColumn === 'pic' && sortOrder === 'desc' }" 
            @click="handleSort('pic')">
            PIC
            <i 
              v-if="sortColumn === 'pic'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'categoryId' && sortOrder === 'asc', 'sort-desc': sortColumn === 'categoryId' && sortOrder === 'desc' }" 
            @click="handleSort('categoryId')">
            Category ID
            <i 
              v-if="sortColumn === 'categoryId'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th class="text-center">Actions</th>
        </template>

        <!-- Table Row -->
        <template #table-row="{ item }">
          <td>{{ item.Cabang }}</td>
          <td>{{ item.tableName }}</td>
          <td>{{ item.unixKey }}</td>
          <td>{{ item.noteText }}</td>
          <td>{{ item.pic }}</td>
          <td>{{ item.categoryId || '-' }}</td>
          <td class="text-center">
            <div class="action-buttons">
              <button class="btn btn-icon btn-danger" @click="confirmDelete(item)" title="Delete">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </td>
        </template>
      </DataTable>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click.self="closeDeleteDialog">
      <div class="modal confirm-dialog">
        <div class="modal-header">
          <h3>Confirm Deletion</h3>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete the note with key "{{ noteToDelete?.unixKey }}"?</p>
          <p class="warning-text">This action cannot be undone.</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeDeleteDialog">Cancel</button>
            <button type="button" class="btn btn-danger" @click="deleteNote" :disabled="deleting">
              <i v-if="deleting" class="pi pi-spin pi-spinner"></i>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import PageHeader from '../../components/PageHeader.vue';
import DataTable from '../../components/common/DataTable.vue';
import { notesService } from '../../services';

// State
const notes = ref([]);
const loading = ref(false);
const deleting = ref(false);
const error = ref('');
const showDeleteDialog = ref(false);
const noteToDelete = ref(null);
const searchQuery = ref('');
const sortColumn = ref('Cabang');
const sortOrder = ref('asc');
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalItems = ref(0);

// Toast for notifications
const toast = useToast();

// Computed properties
const pagination = computed(() => ({
  currentPage: currentPage.value,
  itemsPerPage: itemsPerPage.value,
  total: totalItems.value,
  totalPages: Math.ceil(totalItems.value / itemsPerPage.value)
}));

// Computed property for filtered data
const filteredNotes = computed(() => {
  if (Array.isArray(notes.value)) {
    return notes.value;
  }
  return [];
});

// Methods
const loadNotes = async (params = {}) => {
  loading.value = true;
  error.value = '';
  
  try {
    const queryParams = {
      page: params.page || currentPage.value,
      limit: params.itemsPerPage || itemsPerPage.value,
      sortColumn: params.sortColumn || sortColumn.value,
      sortOrder: params.sortOrder || sortOrder.value,
      searchQuery: params.searchQuery || searchQuery.value
    };
    
    const response = await notesService.getAll();
    
    // Handle the response format from backend
    if (response.data && response.data.success) {
      // Backend returned data in the format { success: true, data: [...], count: 50 }
      notes.value = response.data.data;
      totalItems.value = response.data.count;
    } else if (response.data && Array.isArray(response.data)) {
      // Backend returned simple array (fallback)
      notes.value = response.data;
      totalItems.value = response.data.length;
    } else {
      notes.value = [];
      totalItems.value = 0;
    }
  } catch (err) {
    error.value = 'Failed to load notes. Please try again.';
    console.error('Error loading notes:', err);
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (data) => {
  currentPage.value = data.page;
  itemsPerPage.value = data.itemsPerPage;
  loadNotes({ page: data.page, itemsPerPage: data.itemsPerPage });
};

const handleItemsPerPageChange = (data) => {
  currentPage.value = 1; // Reset to first page
  itemsPerPage.value = data.itemsPerPage;
  loadNotes({ page: 1, itemsPerPage: data.itemsPerPage });
};

const handleSortChange = (data) => {
  sortColumn.value = data.sortColumn;
  sortOrder.value = data.sortOrder;
  currentPage.value = data.page || 1;
  itemsPerPage.value = data.itemsPerPage || itemsPerPage.value;
  loadNotes({
    sortColumn: data.sortColumn,
    sortOrder: data.sortOrder,
    page: data.page || 1,
    itemsPerPage: data.itemsPerPage || itemsPerPage.value
  });
};

const handleSearch = () => {
  // Debounce search
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(() => {
    currentPage.value = 1; // Reset to first page
    loadNotes({ searchQuery: searchQuery.value, page: 1 });
  }, 500);
};

const clearSearch = () => {
  searchQuery.value = '';
  currentPage.value = 1; // Reset to first page
  loadNotes({ searchQuery: '', page: 1 });
};

const closeDeleteDialog = () => {
  showDeleteDialog.value = false;
  noteToDelete.value = null;
};

const confirmDelete = (note) => {
  noteToDelete.value = note;
  showDeleteDialog.value = true;
};

const deleteNote = async () => {
  if (!noteToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await notesService.delete(noteToDelete.value.unixKey);
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Note deleted successfully',
      life: 3000
    });
    
    closeDeleteDialog();
    await loadNotes();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to delete note: ${err.response?.data?.message || err.message}`,
      life: 5000
    });
  } finally {
    deleting.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadNotes();
});
</script>

<style scoped>
@import './index.css';
</style>