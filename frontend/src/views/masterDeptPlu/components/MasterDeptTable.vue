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
      
      <template #filters>
        <div class="search-container">
          <div class="filters-row">
            <div class="search-form">
              <div class="search-box">
                <i class="pi pi-search search-icon"></i>
                <input 
                  type="text" 
                  v-model="localSearchQuery" 
                  @input="handleSearch"
                  placeholder="Cari departemen..." 
                  class="search-input"
                />
                <button 
                  type="button" 
                  v-if="localSearchQuery" 
                  @click="clearSearch" 
                  class="clear-button">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>
            <button class="btn btn-primary create-button" @click="$emit('create')">
              <i class="pi pi-plus"></i> Create New
            </button>
          </div>
        </div>
      </template>

      <template #table-header-sortable="{ sortColumn, sortOrder, handleSort }">
        <th 
          class="sortable" 
          :class="{ 'sort-asc': sortColumn === 'dep_kd' && sortOrder === 'asc', 'sort-desc': sortColumn === 'dep_kd' && sortOrder === 'desc' }" 
          @click="handleSort('dep_kd')">
          Dept Code
          <i 
            v-if="sortColumn === 'dep_kd'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th 
          class="sortable" 
          :class="{ 'sort-asc': sortColumn === 'dep_nm' && sortOrder === 'asc', 'sort-desc': sortColumn === 'dep_nm' && sortOrder === 'desc' }" 
          @click="handleSort('dep_nm')">
          Department Name
          <i 
            v-if="sortColumn === 'dep_nm'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th 
          class="sortable" 
          :class="{ 'sort-asc': sortColumn === 'div_kd' && sortOrder === 'asc', 'sort-desc': sortColumn === 'div_kd' && sortOrder === 'desc' }" 
          @click="handleSort('div_kd')">
          Div Code
          <i 
            v-if="sortColumn === 'div_kd'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th 
          class="sortable" 
          :class="{ 'sort-asc': sortColumn === 'dep_mgr' && sortOrder === 'asc', 'sort-desc': sortColumn === 'dep_mgr' && sortOrder === 'desc' }" 
          @click="handleSort('dep_mgr')">
          Manager
          <i 
            v-if="sortColumn === 'dep_mgr'" 
            class="pi sort-icon" 
            :class="sortOrder === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down'">
          </i>
        </th>
        <th class="text-center">Actions</th>
      </template>

      <template #table-row="{ item }">
        <td class="text-center">{{ item.dep_kd }}</td>
        <td>{{ item.dep_nm }}</td>
        <td>{{ item.div_kd || '-' }}</td>
        <td>{{ item.dep_mgr || '-' }}</td>
        <td class="text-center">
          <div class="action-buttons">
             <button class="btn btn-icon btn-secondary" @click="$emit('edit', item)" title="Edit">
               <i class="pi pi-pencil"></i>
             </button>
             <button class="btn btn-icon btn-danger" @click="$emit('delete', item)" title="Delete">
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

<style scoped>
@import './MasterDeptTable.css';
</style>
