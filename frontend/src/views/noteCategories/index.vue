<template>
  <div class="note-categories-view">
    <PageHeader 
      title="Note Categories Management" 
      subtitle="Manage note categories for the application" 
      description="Add, edit, or remove note categories used throughout the system."
    />
    
    <div class="content-container">
      <DataTable 
        :data="categories" 
        :filtered-data="filteredCategories" 
        :loading="loading" 
        :error="error"
        :loadingMessage="'Memuat data kategori...'" 
        :loadingHelpText="'Mohon tunggu sebentar...'"
        :emptyMessage="'Tidak ada kategori untuk ditampilkan.'"
        :emptyHelpText="'Tidak ditemukan kategori untuk kriteria yang dipilih.'"
        :pagination="pagination"
        :tableTitle="'Daftar Kategori'"
        @refresh="loadCategories" 
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
                    placeholder="Cari kategori..." 
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
            :class="{ 'sort-asc': sortColumn === 'id' && sortOrder === 'asc', 'sort-desc': sortColumn === 'id' && sortOrder === 'desc' }" 
            @click="handleSort('id')">
            ID
            <i 
              v-if="sortColumn === 'id'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'name' && sortOrder === 'asc', 'sort-desc': sortColumn === 'name' && sortOrder === 'desc' }" 
            @click="handleSort('name')">
            Name
            <i 
              v-if="sortColumn === 'name'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'description' && sortOrder === 'asc', 'sort-desc': sortColumn === 'description' && sortOrder === 'desc' }" 
            @click="handleSort('description')">
            Description
            <i 
              v-if="sortColumn === 'description'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable" 
            :class="{ 'sort-asc': sortColumn === 'moduleName' && sortOrder === 'asc', 'sort-desc': sortColumn === 'moduleName' && sortOrder === 'desc' }" 
            @click="handleSort('moduleName')">
            Module Name
            <i 
              v-if="sortColumn === 'moduleName'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th class="text-center">Actions</th>
        </template>

        <!-- Table Row -->
        <template #table-row="{ item }">
          <td class="text-center">{{ item.id }}</td>
          <td>{{ item.name }}</td>
          <td>{{ item.description || '-' }}</td>
          <td>{{ item.moduleName }}</td>
          <td class="text-center">
            <div class="action-buttons">
              <button class="btn btn-icon btn-secondary" @click="openEditModal(item)" title="Edit">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn btn-icon btn-danger" @click="confirmDelete(item)" title="Delete">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </td>
        </template>
      </DataTable>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingCategory ? 'Edit Note Category' : 'Create New Note Category' }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveCategory">
            <div class="form-group">
              <label for="name">Name *</label>
              <input 
                type="text" 
                id="name" 
                v-model="form.name" 
                :class="{ 'invalid': errors.name }"
                required
              >
              <div v-if="errors.name" class="error-text">{{ errors.name }}</div>
            </div>
            
            <div class="form-group">
              <label for="description">Description</label>
              <textarea 
                id="description" 
                v-model="form.description" 
                rows="3"
                :class="{ 'invalid': errors.description }"
              ></textarea>
              <div v-if="errors.description" class="error-text">{{ errors.description }}</div>
            </div>
            
            <div class="form-group">
              <label for="moduleName">Module Name *</label>
              <input 
                type="text" 
                id="moduleName" 
                v-model="form.moduleName" 
                :class="{ 'invalid': errors.moduleName }"
                required
              >
              <div v-if="errors.moduleName" class="error-text">{{ errors.moduleName }}</div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <i v-if="saving" class="pi pi-spin pi-spinner"></i>
                {{ editingCategory ? 'Update Category' : 'Create Category' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click.self="closeDeleteDialog">
      <div class="modal confirm-dialog">
        <div class="modal-header">
          <h3>Confirm Deletion</h3>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete the note category "{{ categoryToDelete?.name }}"?</p>
          <p class="warning-text">This action cannot be undone.</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeDeleteDialog">Cancel</button>
            <button type="button" class="btn btn-danger" @click="deleteCategory" :disabled="deleting">
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
import { noteCategoriesService } from '../../services';

// State
const categories = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const error = ref('');
const showModal = ref(false);
const showDeleteDialog = ref(false);
const editingCategory = ref(null);
const categoryToDelete = ref(null);
const searchQuery = ref('');
const sortColumn = ref('id');
const sortOrder = ref('asc');
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalItems = ref(0);

// Form data
const form = ref({
  name: '',
  description: '',
  moduleName: ''
});

// Form errors
const errors = ref({});

// Toast for notifications
const toast = useToast();

// Computed properties
const pagination = computed(() => ({
  currentPage: currentPage.value,
  itemsPerPage: itemsPerPage.value,
  total: totalItems.value,
  totalPages: Math.ceil(totalItems.value / itemsPerPage.value)
}));

// Computed property for filtered data (following the pattern from RekonVirtualMrgTable.vue)
const filteredCategories = computed(() => {
  if (Array.isArray(categories.value)) {
    return categories.value;
  }
  return [];
});

// Methods
const loadCategories = async (params = {}) => {
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
    
    const response = await noteCategoriesService.getAll(queryParams);
    
    // Handle the response format from backend
    if (response.data && response.data.success) {
      // Backend returned data in the format { success: true, data: [...], total: 50, page: 1, limit: 10, totalPages: 5 }
      categories.value = response.data.data;
      totalItems.value = response.data.total;
    } else if (response.data && Array.isArray(response.data)) {
      // Backend returned simple array (fallback)
      categories.value = response.data;
      totalItems.value = response.data.length;
    } else {
      categories.value = [];
      totalItems.value = 0;
    }
  } catch (err) {
    error.value = 'Failed to load note categories. Please try again.';
    console.error('Error loading categories:', err);
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (data) => {
  currentPage.value = data.page;
  itemsPerPage.value = data.itemsPerPage;
  loadCategories({ page: data.page, itemsPerPage: data.itemsPerPage });
};

const handleItemsPerPageChange = (data) => {
  currentPage.value = 1; // Reset to first page
  itemsPerPage.value = data.itemsPerPage;
  loadCategories({ page: 1, itemsPerPage: data.itemsPerPage });
};

const handleSortChange = (data) => {
  sortColumn.value = data.sortColumn;
  sortOrder.value = data.sortOrder;
  currentPage.value = data.page || 1;
  itemsPerPage.value = data.itemsPerPage || itemsPerPage.value;
  loadCategories({
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
    loadCategories({ searchQuery: searchQuery.value, page: 1 });
  }, 500);
};

const clearSearch = () => {
  searchQuery.value = '';
  currentPage.value = 1; // Reset to first page
  loadCategories({ searchQuery: '', page: 1 });
};

const openCreateModal = () => {
  editingCategory.value = null;
  form.value = {
    name: '',
    description: '',
    moduleName: ''
  };
  errors.value = {};
  showModal.value = true;
};

const openEditModal = (category) => {
  editingCategory.value = category;
  form.value = {
    name: category.name || '',
    description: category.description || '',
    moduleName: category.moduleName || ''
  };
  errors.value = {};
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingCategory.value = null;
};

const closeDeleteDialog = () => {
  showDeleteDialog.value = false;
  categoryToDelete.value = null;
};

const validateForm = () => {
  errors.value = {};
  
  if (!form.value.name.trim()) {
    errors.value.name = 'Name is required';
  }
  
  if (!form.value.moduleName.trim()) {
    errors.value.moduleName = 'Module name is required';
  }
  
  return Object.keys(errors.value).length === 0;
};

const saveCategory = async () => {
  if (!validateForm()) return;
  
  saving.value = true;
  
  try {
    if (editingCategory.value) {
      // Update existing category
      await noteCategoriesService.update(editingCategory.value.id, form.value);
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Note category updated successfully',
        life: 3000
      });
    } else {
      // Create new category
      await noteCategoriesService.create(form.value);
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Note category created successfully',
        life: 3000
      });
    }
    
    closeModal();
    await loadCategories();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to save note category: ${err.response?.data?.message || err.message}`,
      life: 5000
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (category) => {
  categoryToDelete.value = category;
  showDeleteDialog.value = true;
};

const deleteCategory = async () => {
  if (!categoryToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await noteCategoriesService.delete(categoryToDelete.value.id);
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Note category deleted successfully',
      life: 3000
    });
    
    closeDeleteDialog();
    await loadCategories();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to delete note category: ${err.response?.data?.message || err.message}`,
      life: 5000
    });
  } finally {
    deleting.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadCategories();
});
</script>

<style scoped>
@import './index.css';
</style>