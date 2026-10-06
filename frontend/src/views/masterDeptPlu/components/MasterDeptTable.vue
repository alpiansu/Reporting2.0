<template>
  <div class="master-dept-table-wrapper">
    <DataTable 
      :data="data" 
      :filtered-data="data" 
      :loading="loading" 
      :error="error"
      :loadingMessage="'Memuat data departemen...'" 
      :loadingHelpText="'Mohon tunggu sebentar...'"
      :emptyMessage="'Tidak ada departemen untuk ditampilkan.'"
      :emptyHelpText="'Tidak ditemukan departemen untuk kriteria yang dipilih.'"
      :pagination="pagination"
      :tableTitle="'Daftar Departemen'"
      :showRowNumbers="false"
      @refresh="$emit('refresh')" 
      @page-change="$emit('page-change', $event)"
      @items-per-page-change="$emit('items-per-page-change', $event)"
      @sort-change="$emit('sort-change', $event)">
      
      <!-- Toolbar Filters Slot -->
      <template #filters>
        <div class="toolbar-section">
          <div class="search-box-compact">
            <i class="pi pi-search search-icon"></i>
            <input 
              type="text" 
              v-model="localSearchQuery" 
              @input="handleSearch"
              placeholder="Cari kode, nama departemen, divisi, manager..." 
              class="search-input-compact"
            />
            <button 
              type="button" 
              v-if="localSearchQuery" 
              @click="clearSearch" 
              class="clear-search-btn"
              title="Hapus pencarian">
              <i class="pi pi-times"></i>
            </button>
          </div>
          
          <div class="table-meta-hint" v-if="localSearchQuery">
            <i class="pi pi-filter"></i>
            <span>Pencarian: <strong>"{{ localSearchQuery }}"</strong></span>
          </div>

          <button 
            type="button" 
            class="btn-toolbar-create" 
            @click="$emit('create')"
            title="Tambah Departemen Baru"
          >
            <i class="pi pi-plus"></i>
            <span>Tambah Dept</span>
          </button>
        </div>
      </template>

      <!-- Table Header with Sorting -->
      <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
        <th 
          class="sortable col-dept-kd" 
          :class="{ 'sort-asc': sortColumn === 'dep_kd' && sortOrder === 'asc', 'sort-desc': sortColumn === 'dep_kd' && sortOrder === 'desc' }" 
          @click="handleSort('dep_kd')">
          <span>Dept Code</span>
          <i 
            v-if="sortColumn === 'dep_kd'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th 
          class="sortable col-dept-nm" 
          :class="{ 'sort-asc': sortColumn === 'dep_nm' && sortOrder === 'asc', 'sort-desc': sortColumn === 'dep_nm' && sortOrder === 'desc' }" 
          @click="handleSort('dep_nm')">
          <span>Department Name</span>
          <i 
            v-if="sortColumn === 'dep_nm'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th 
          class="sortable col-div-kd" 
          :class="{ 'sort-asc': sortColumn === 'div_kd' && sortOrder === 'asc', 'sort-desc': sortColumn === 'div_kd' && sortOrder === 'desc' }" 
          @click="handleSort('div_kd')">
          <span>Div Code</span>
          <i 
            v-if="sortColumn === 'div_kd'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th 
          class="sortable col-dep-mgr" 
          :class="{ 'sort-asc': sortColumn === 'dep_mgr' && sortOrder === 'asc', 'sort-desc': sortColumn === 'dep_mgr' && sortOrder === 'desc' }" 
          @click="handleSort('dep_mgr')">
          <span>Manager</span>
          <i 
            v-if="sortColumn === 'dep_mgr'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th class="col-actions text-center">Actions</th>
      </template>

      <!-- Table Row -->
      <template #table-row="{ item }">
        <td class="text-center">
          <span class="badge-code">#{{ item.dep_kd }}</span>
        </td>
        <td>
          <div class="dept-name-cell">
            <i class="pi pi-building cell-icon"></i>
            <span class="dept-name-text">{{ item.dep_nm }}</span>
          </div>
        </td>
        <td>
          <span class="division-pill" v-if="item.div_kd">
            <i class="pi pi-folder"></i>
            {{ item.div_kd }}
          </span>
          <span class="text-muted" v-else>-</span>
        </td>
        <td>
          <div class="manager-cell" v-if="item.dep_mgr">
            <i class="pi pi-user"></i>
            <span>{{ item.dep_mgr }}</span>
          </div>
          <span class="text-muted" v-else>-</span>
        </td>
        <td class="text-center">
          <div class="action-buttons">
            <button 
              class="btn-action-compact btn-edit" 
              @click="$emit('edit', item)" 
              title="Edit Departemen">
              <i class="pi pi-pencil"></i>
            </button>
            <button 
              class="btn-action-compact btn-delete" 
              @click="$emit('delete', item)" 
              title="Hapus Departemen">
              <i class="pi pi-trash"></i>
            </button>
          </div>
        </td>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import DataTable from '@/components/common/DataTable.vue';

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
    default: ''
  },
  pagination: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'create', 
  'edit', 
  'delete', 
  'search', 
  'refresh', 
  'page-change', 
  'items-per-page-change', 
  'sort-change'
]);

const localSearchQuery = ref(props.searchQuery);

watch(() => props.searchQuery, (newVal) => {
  localSearchQuery.value = newVal;
});

const handleSearch = () => {
  emit('search', localSearchQuery.value);
};

const clearSearch = () => {
  localSearchQuery.value = '';
  emit('search', '');
};
</script>

<style src="./MasterDeptTable.css" scoped />
