<template>
  <div class="rekon-persediaan-table-container mt-4">
    <DataTable :value="records" :lazy="true" :paginator="true" :rows="limit" :totalRecords="totalRecords"
      :loading="loading" @page="onPage($event)" @sort="onSort($event)"
      responsiveLayout="scroll" class="p-datatable-sm" filterDisplay="menu"
      paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      :rowsPerPageOptions="[10, 20, 50, 100]"
      currentPageReportTemplate="Showing {first} to {last} of {totalRecords}">
      
      <template #header>
        <div class="flex justify-content-between align-items-center gap-3">
          <div class="search-container">
            <span class="p-input-icon-left">
              <i class="pi pi-search" />
              <InputText v-model="searchQuery" placeholder="Cari Toko atau Cabang..." @input="onSearch" class="search-input" />
            </span>
          </div>
        </div>
      </template>

      <Column field="CABANG" header="CAB" sortable></Column>
      <Column field="SHOP" header="SHOP" sortable></Column>
      <Column field="TANGGAL" header="TGL" sortable>
        <template #body="slotProps">
          {{ formatDate(slotProps.data.TANGGAL) }}
        </template>
      </Column>

      <!-- DRY -->
      <Column header="DRY (Store vs WRC)">
        <template #body="slotProps">
          <div class="hpp-grid">
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_DRY_STORE) }}</span>
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_DRY_WRC) }}</span>
            <span :class="getDiffClass(slotProps.data.SELISIH_DRY)">
              {{ formatCurrency(slotProps.data.SELISIH_DRY) }}
            </span>
          </div>
        </template>
      </Column>

      <!-- ISTORE -->
      <Column header="ISTORE">
        <template #body="slotProps">
          <div class="hpp-grid">
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_ISTORE_STORE) }}</span>
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_ISTORE_WRC) }}</span>
            <span :class="getDiffClass(slotProps.data.SELISIH_ISTORE)">
              {{ formatCurrency(slotProps.data.SELISIH_ISTORE) }}
            </span>
          </div>
        </template>
      </Column>

      <!-- RESTO -->
      <Column header="RESTO">
        <template #body="slotProps">
          <div class="hpp-grid">
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_RESTO_STORE) }}</span>
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_RESTO_WRC) }}</span>
            <span :class="getDiffClass(slotProps.data.SELISIH_RESTO)">
              {{ formatCurrency(slotProps.data.SELISIH_RESTO) }}
            </span>
          </div>
        </template>
      </Column>

      <!-- VIRTUAL -->
      <Column header="VIRTUAL">
        <template #body="slotProps">
          <div class="hpp-grid">
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_VIRTUAL_STORE) }}</span>
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_VIRTUAL_WRC) }}</span>
            <span :class="getDiffClass(slotProps.data.SELISIH_VIRTUAL)">
              {{ formatCurrency(slotProps.data.SELISIH_VIRTUAL) }}
            </span>
          </div>
        </template>
      </Column>

      <!-- SPC -->
      <Column header="SPC">
        <template #body="slotProps">
          <div class="hpp-grid">
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_SPC_STORE_STORE) }}</span>
            <span class="hpp-value">{{ formatCurrency(slotProps.data.HPP_SPC_STORE_WRC) }}</span>
            <span :class="getDiffClass(slotProps.data.SELISIH_SPC)">
              {{ formatCurrency(slotProps.data.SELISIH_SPC) }}
            </span>
          </div>
        </template>
      </Column>

      <Column field="LASTCATCH" header="Last Updated">
        <template #body="slotProps">
          <small>{{ formatDateTime(slotProps.data.LASTCATCH) }}</small>
        </template>
      </Column>

      <template #empty>
        <div class="p-4 text-center">Belum ada data untuk periode dan filter yang dipilih.</div>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import rekonPersediaanService from '@/services/rekonPersediaan.service';

const records = ref([]);
const totalRecords = ref(0);
const loading = ref(false);
const page = ref(1);
const limit = ref(10);
const searchQuery = ref('');
const sortColumn = ref('TANGGAL');
const sortOrder = ref('DESC');
const currentFilters = ref({ cab: 'All', periode: '' });

const loadRecords = async () => {
  if (!currentFilters.value.periode) return;
  
  loading.value = true;
  try {
    const response = await rekonPersediaanService.getAllRecords({
      page: page.value,
      limit: limit.value,
      cabang: currentFilters.value.cab,
      periode: currentFilters.value.periode,
      searchQuery: searchQuery.value,
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value
    });
    
    records.value = response.data.data;
    totalRecords.value = response.data.total;
  } catch (error) {
    console.error('Failed to load records:', error);
  } finally {
    loading.value = false;
  }
};

const onPage = (event) => {
  page.value = event.page + 1;
  limit.value = event.rows;
  loadRecords();
};

const onSort = (event) => {
  sortColumn.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'ASC' : 'DESC';
  loadRecords();
};

const onSearch = () => {
    // Debounce search ideally
    page.value = 1;
    loadRecords();
};

const refresh = (filters) => {
  if (filters) currentFilters.value = filters;
  page.value = 1;
  loadRecords();
};

defineExpose({ refresh });

// Formatters
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

const getDiffClass = (value) => {
  if (!value || Math.abs(value) < 0.01) return 'hpp-value diff-zero';
  return value > 0 ? 'hpp-value diff-positive' : 'hpp-value diff-negative';
};
</script>

<style scoped>
:deep(.p-datatable-header) {
  background: #f8fafc;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.search-container {
  position: relative;
  width: 300px;
}

.search-input {
  width: 100%;
  padding-left: 2.5rem !important; /* Ensure space for icon */
}

/* Fix for floating icon position */
.p-input-icon-left {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
}

.p-input-icon-left > i {
  position: absolute;
  left: 0.75rem;
  color: #94a3b8;
  z-index: 1;
  pointer-events: none;
}

.hpp-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.hpp-value {
    font-family: 'Inter', monospace;
    font-size: 0.8rem;
    text-align: right;
    display: block;
}

.diff-positive {
    color: #ef4444;
    font-weight: bold;
    border-top: 1px dashed #cbd5e1;
    margin-top: 2px;
}

.diff-negative {
    color: #3b82f6;
    font-weight: bold;
    border-top: 1px dashed #cbd5e1;
    margin-top: 2px;
}

.diff-zero {
    color: #10b981;
    border-top: 1px dashed #cbd5e1;
    margin-top: 2px;
}
</style>
