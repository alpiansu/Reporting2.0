<template>
  <div class="master-dept-view">
    <PageHeader 
      title="Master Dept Management" 
      subtitle="Manage department master data" 
      description="Add, edit, or remove departments used throughout the system."
    />
    
    <div class="content-container">
      <MasterDeptTable
        :data="filteredDepartments"
        :loading="loading"
        :error="error"
        :pagination="pagination"
        :searchQuery="searchQuery"
        @create="openCreateModal"
        @edit="openEditModal"
        @delete="confirmDelete"
        @search="handleSearch"
        @refresh="loadDepartments" 
        @page-change="handlePageChange"
        @items-per-page-change="handleItemsPerPageChange"
        @sort-change="handleSortChange"
      />
    </div>

    <MasterDeptDialog
      :show="showModal"
      :initial-data="editingDept"
      :saving="saving"
      :errors="errors"
      @close="closeModal"
      @save="saveDepartment"
    />

    <MasterDeptConfirmDialog
      :show="showDeleteDialog"
      :dept="deptToDelete"
      :deleting="deleting"
      @close="closeDeleteDialog"
      @confirm="deleteDepartment"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import MasterDeptTable from './components/MasterDeptTable.vue';
import MasterDeptDialog from './components/MasterDeptDialog.vue';
import MasterDeptConfirmDialog from './components/MasterDeptConfirmDialog.vue';
import mDeptService from '@/services/mDept.service';

// State
const departments = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const error = ref('');
const showModal = ref(false);
const showDeleteDialog = ref(false);
const editingDept = ref(null);
const deptToDelete = ref(null);
const searchQuery = ref('');
const sortColumn = ref('dep_kd');
const sortOrder = ref('asc');
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalItems = ref(0);

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

// Filtered data computed property
const filteredDepartments = computed(() => {
  if (Array.isArray(departments.value)) {
    let filtered = departments.value;
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(item => 
        (item.dep_kd && item.dep_kd.toLowerCase().includes(query)) ||
        (item.dep_nm && item.dep_nm.toLowerCase().includes(query)) ||
        (item.dep_mgr && item.dep_mgr.toLowerCase().includes(query)) ||
        (item.div_kd && item.div_kd.toLowerCase().includes(query))
      );
    }
    
    if (sortColumn.value) {
      filtered = [...filtered].sort((a, b) => {
        const valA = a[sortColumn.value] || '';
        const valB = b[sortColumn.value] || '';
        if (sortOrder.value === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
    }
    
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return filtered.slice(start, end);
  }
  return [];
});

// Methods
const loadDepartments = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await mDeptService.getAll({});
    
    if (response.data && response.data.success) {
      departments.value = response.data.data;
      totalItems.value = departments.value.length;
    } else {
      departments.value = [];
      totalItems.value = 0;
    }
  } catch (err) {
    error.value = 'Failed to load departments. Please try again.';
    console.error('Error loading departments:', err);
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (data) => {
  currentPage.value = data.page;
  itemsPerPage.value = data.itemsPerPage;
};

const handleItemsPerPageChange = (data) => {
  currentPage.value = 1;
  itemsPerPage.value = data.itemsPerPage;
};

const handleSortChange = (data) => {
  sortColumn.value = data.sortColumn;
  sortOrder.value = data.sortOrder;
  currentPage.value = data.page || 1;
};

const handleSearch = (query) => {
  // If query is an Event object, we take the default value or ignore it
  if (typeof query === 'string') {
    searchQuery.value = query;
  }
  currentPage.value = 1; 
};

const openCreateModal = () => {
  editingDept.value = null;
  errors.value = {};
  showModal.value = true;
};

const openEditModal = (dept) => {
  editingDept.value = dept;
  errors.value = {};
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingDept.value = null;
};

const closeDeleteDialog = () => {
  showDeleteDialog.value = false;
  deptToDelete.value = null;
};

const validateForm = (formValue) => {
  errors.value = {};
  
  if (!formValue.dep_kd?.trim()) {
    errors.value.dep_kd = 'Department code is required';
  }
  
  if (!formValue.dep_nm?.trim()) {
    errors.value.dep_nm = 'Department name is required';
  }
  
  return Object.keys(errors.value).length === 0;
};

const saveDepartment = async (formValue) => {
  if (!validateForm(formValue)) return;
  
  saving.value = true;
  
  try {
    const payload = {
      dep_kd: formValue.dep_kd,
      dep_nm: formValue.dep_nm,
      div_kd: formValue.div_kd,
      dep_mgr: formValue.dep_mgr
    };
    
    // Note: Backend expects kddept, namadept
    if(payload.dep_kd) { payload.kddept = payload.dep_kd; }
    if(payload.dep_nm) { payload.namadept = payload.dep_nm; }

    if (editingDept.value) {
      await mDeptService.update(editingDept.value.dep_kd, payload);
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Department updated successfully',
        life: 3000
      });
    } else {
      await mDeptService.create(payload);
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Department created successfully',
        life: 3000
      });
    }
    
    closeModal();
    await loadDepartments();
  } catch (err) {
    let msg = err.response?.data?.message || err.message;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to save department: ${msg}`,
      life: 5000
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (dept) => {
  deptToDelete.value = dept;
  showDeleteDialog.value = true;
};

const deleteDepartment = async () => {
  if (!deptToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await mDeptService.delete(deptToDelete.value.dep_kd);
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Department deleted successfully',
      life: 3000
    });
    
    closeDeleteDialog();
    await loadDepartments();
  } catch (err) {
    let msg = err.response?.data?.message || err.message;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to delete department: ${msg}`,
      life: 5000
    });
  } finally {
    deleting.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadDepartments();
});
</script>

<style src="./index.css" scoped />
