<template>
  <div class="note-categories-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-tags"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Note Categories Management</h1>
          <p class="header-subtitle">Kelola kategori catatan dan pemetaan modul sistem secara terpusat</p>
        </div>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="btn-header-secondary"
          :disabled="loading"
          @click="loadCategories()"
          title="Muat ulang data"
        >
          <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i>
          <span>Refresh</span>
        </button>

        <button
          type="button"
          class="btn-header-primary"
          @click="openCreateModal"
          title="Tambah kategori baru"
        >
          <i class="pi pi-plus"></i>
          <span>Tambah Kategori</span>
        </button>
      </div>
    </header>

    <!-- KPI & Summary Strip (Compact) -->
    <section class="kpi-summary-strip">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper total">
          <i class="pi pi-tags"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Total Kategori</span>
          <span class="kpi-value">{{ totalItems || categories.length || 0 }}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrapper module">
          <i class="pi pi-box"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Modul Terdaftar</span>
          <span class="kpi-value">{{ availableModules.length || 0 }}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrapper active-page">
          <i class="pi pi-file"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Halaman Aktif</span>
          <span class="kpi-value">{{ currentPage }} <span class="kpi-subtext-inline">/ {{ pagination.totalPages || 1 }}</span></span>
        </div>
      </div>
    </section>

    <!-- Table Container -->
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
        
        <!-- Search & Filter Controls Slot -->
        <template #filters>
          <div class="toolbar-section">
            <div class="search-box-compact">
              <i class="pi pi-search search-icon"></i>
              <input 
                type="text" 
                v-model="searchQuery" 
                @input="handleSearch"
                placeholder="Cari nama kategori, deskripsi, atau modul..." 
                class="search-input-compact"
              />
              <button 
                type="button" 
                v-if="searchQuery" 
                @click="clearSearch" 
                class="clear-search-btn"
                title="Hapus pencarian">
                <i class="pi pi-times"></i>
              </button>
            </div>
            <div class="table-meta-hint" v-if="searchQuery">
              <i class="pi pi-filter"></i>
              <span>Menampilkan hasil pencarian: <strong>"{{ searchQuery }}"</strong></span>
            </div>
          </div>
        </template>

        <!-- Table Header with Sorting -->
        <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
          <th 
            class="sortable col-id" 
            :class="{ 'sort-asc': sortColumn === 'id' && sortOrder === 'asc', 'sort-desc': sortColumn === 'id' && sortOrder === 'desc' }" 
            @click="handleSort('id')">
            <span>ID</span>
            <i 
              v-if="sortColumn === 'id'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable col-name" 
            :class="{ 'sort-asc': sortColumn === 'name' && sortOrder === 'asc', 'sort-desc': sortColumn === 'name' && sortOrder === 'desc' }" 
            @click="handleSort('name')">
            <span>Name</span>
            <i 
              v-if="sortColumn === 'name'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable col-desc" 
            :class="{ 'sort-asc': sortColumn === 'description' && sortOrder === 'asc', 'sort-desc': sortColumn === 'description' && sortOrder === 'desc' }" 
            @click="handleSort('description')">
            <span>Description</span>
            <i 
              v-if="sortColumn === 'description'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th 
            class="sortable col-module" 
            :class="{ 'sort-asc': sortColumn === 'moduleName' && sortOrder === 'asc', 'sort-desc': sortColumn === 'moduleName' && sortOrder === 'desc' }" 
            @click="handleSort('moduleName')">
            <span>Module Name</span>
            <i 
              v-if="sortColumn === 'moduleName'" 
              class="pi sort-icon" 
              :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
            </i>
          </th>
          <th class="col-actions text-center">Actions</th>
        </template>

        <!-- Table Row -->
        <template #table-row="{ item }">
          <td class="text-center">
            <span class="badge-code">#{{ item.id }}</span>
          </td>
          <td>
            <div class="name-cell">
              <i class="pi pi-tag cell-icon"></i>
              <span class="category-name-text">{{ item.name }}</span>
            </div>
          </td>
          <td class="desc-cell">
            <span :class="{ 'text-muted': !item.description }">{{ item.description || '-' }}</span>
          </td>
          <td>
            <span class="module-tag">
              <i class="pi pi-box"></i>
              {{ getModuleName(item.moduleName) }}
            </span>
          </td>
          <td class="text-center">
            <div class="action-buttons">
              <button 
                class="btn-action-compact btn-edit" 
                @click="openEditModal(item)" 
                title="Edit Kategori">
                <i class="pi pi-pencil"></i>
              </button>
              <button 
                class="btn-action-compact btn-delete" 
                @click="confirmDelete(item)" 
                title="Hapus Kategori">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </td>
        </template>
      </DataTable>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal note-category-modal">
        <div class="dialog-header-modern" :class="{ 'edit-mode': !!editingCategory }">
          <div class="dialog-header-left">
            <div class="dialog-icon-badge" :class="editingCategory ? 'edit' : 'add'">
              <i :class="editingCategory ? 'pi pi-pencil' : 'pi pi-plus'"></i>
            </div>
            <div>
              <h3 class="dialog-title">
                {{ editingCategory ? 'Edit Note Category' : 'Create New Note Category' }}
              </h3>
              <span class="dialog-subtitle" v-if="!editingCategory">
                Tambahkan kategori catatan baru untuk sistem
              </span>
              <span class="dialog-subtitle-badge" v-else>
                ID: #{{ editingCategory.id }} &bull; {{ editingCategory.name }}
              </span>
            </div>
          </div>
          <button type="button" class="dialog-close-btn" @click="closeModal" title="Tutup modal">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="dialog-body-modern">
          <form @submit.prevent="saveCategory" class="category-form-redesign">
            <div class="form-section-card">
              <div class="section-card-title">
                <i class="pi pi-info-circle"></i>
                <span>Informasi Kategori</span>
              </div>

              <!-- Name -->
              <div class="form-group-redesign">
                <label for="cat-name" class="form-label-redesign">
                  Name <span class="required-star">*</span>
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-tag input-icon"></i>
                  <input 
                    type="text" 
                    id="cat-name" 
                    v-model="form.name" 
                    placeholder="Contoh: Selisih Kasir, Masalah Jaringan..."
                    class="form-input-redesign"
                    :class="{ 'invalid': errors.name }"
                    required
                  />
                </div>
                <div v-if="errors.name" class="error-text">{{ errors.name }}</div>
              </div>

              <!-- Module Name -->
              <div class="form-group-redesign">
                <label for="cat-module" class="form-label-redesign">
                  Module Name <span class="required-star">*</span>
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-box input-icon"></i>
                  <select 
                    id="cat-module" 
                    v-model="form.moduleName" 
                    class="form-select-redesign"
                    :class="{ 'invalid': errors.moduleName }"
                    required
                  >
                    <option value="">-- Pilih Modul Terkait --</option>
                    <option 
                      v-for="module in availableModules" 
                      :key="module" 
                      :value="module"
                    >
                      {{ getModuleName(module) }} ({{ module }})
                    </option>
                  </select>
                </div>
                <div v-if="errors.moduleName" class="error-text">{{ errors.moduleName }}</div>
              </div>

              <!-- Description -->
              <div class="form-group-redesign">
                <label for="cat-desc" class="form-label-redesign">
                  Description
                </label>
                <div class="input-with-icon textarea-wrap">
                  <i class="pi pi-align-left input-icon textarea-icon"></i>
                  <textarea 
                    id="cat-desc" 
                    v-model="form.description" 
                    rows="3"
                    placeholder="Deskripsi fungsi kategori ini dalam laporan..."
                    class="form-textarea-redesign"
                    :class="{ 'invalid': errors.description }"
                  ></textarea>
                </div>
                <div v-if="errors.description" class="error-text">{{ errors.description }}</div>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions-redesign">
              <button 
                type="button" 
                class="btn-form-cancel" 
                @click="closeModal" 
                :disabled="saving"
              >
                <i class="pi pi-times"></i>
                <span>Batal</span>
              </button>
              <button 
                type="submit" 
                class="btn-form-submit" 
                :disabled="saving"
              >
                <i v-if="saving" class="pi pi-spin pi-spinner"></i>
                <i v-else :class="editingCategory ? 'pi pi-check' : 'pi pi-plus'"></i>
                <span>{{ editingCategory ? 'Update Category' : 'Create Category' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click.self="closeDeleteDialog">
      <div class="modal confirm-delete-modal">
        <div class="dialog-header-modern delete-mode">
          <div class="dialog-header-left">
            <div class="dialog-icon-badge danger">
              <i class="pi pi-exclamation-triangle"></i>
            </div>
            <div>
              <h3 class="dialog-title">Konfirmasi Hapus</h3>
              <span class="dialog-subtitle">Tindakan ini tidak dapat dibatalkan</span>
            </div>
          </div>
          <button type="button" class="dialog-close-btn" @click="closeDeleteDialog" title="Tutup modal">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body-modern">
          <div class="delete-confirmation-content">
            <p class="delete-msg">
              Apakah Anda yakin ingin menghapus kategori berikut?
            </p>
            <div class="delete-target-card">
              <div class="target-title">
                <i class="pi pi-tag"></i>
                <strong>{{ categoryToDelete?.name }}</strong>
              </div>
              <div class="target-meta">
                <span>ID: #{{ categoryToDelete?.id }}</span> &bull; 
                <span>Modul: {{ getModuleName(categoryToDelete?.moduleName) }}</span>
              </div>
            </div>
            <p class="delete-warning-sub">
              Catatan yang sudah terhubung dengan kategori ini mungkin akan kehilangan referensinya.
            </p>
          </div>
          <div class="form-actions-redesign">
            <button 
              type="button" 
              class="btn-form-cancel" 
              @click="closeDeleteDialog" 
              :disabled="deleting"
            >
              <i class="pi pi-times"></i>
              <span>Batal</span>
            </button>
            <button 
              type="button" 
              class="btn-danger-confirm" 
              @click="deleteCategory" 
              :disabled="deleting"
            >
              <i v-if="deleting" class="pi pi-spin pi-spinner"></i>
              <i v-else class="pi pi-trash"></i>
              <span>{{ deleting ? 'Menghapus...' : 'Ya, Hapus Kategori' }}</span>
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
import DataTable from '../../components/common/DataTable.vue';
import { noteCategoriesService } from '../../services';
import modulesService from '../../services/modules.service.js';

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

// Module state
const availableModules = ref([]);
const moduleNames = ref({});

// Helper function
const getModuleName = (moduleKey) => {
  return moduleNames.value[moduleKey] || moduleKey || '-';
};

// Methods
const loadModules = async () => {
  try {
    const response = await modulesService.getAll();
    const data = response.data;
    availableModules.value = data.modules || [];
    
    // Create mapping of module keys to display names
    const names = {};
    data.modules?.forEach((module, index) => {
      names[module] = data.module_names?.[index] || module;
    });
    moduleNames.value = names;
  } catch (err) {
    console.error('Error loading modules:', err);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load modules',
      life: 3000
    });
  }
};

// Computed properties
const pagination = computed(() => ({
  currentPage: currentPage.value,
  itemsPerPage: itemsPerPage.value,
  total: totalItems.value,
  totalPages: Math.ceil(totalItems.value / itemsPerPage.value)
}));

// Computed property for filtered data
const filteredCategories = computed(() => {
  if (Array.isArray(categories.value)) {
    return categories.value;
  }
  return [];
});

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
      categories.value = response.data.data;
      totalItems.value = response.data.total;
    } else if (response.data && Array.isArray(response.data)) {
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
  }, 400);
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
  loadModules();
});
</script>

<style scoped>
@import './index.css';
</style>