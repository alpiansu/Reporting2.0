<template>
  <div class="table-wrapper">
    <div class="table-header">
      <h3 class="table-title">Resume per Toko</h3>
      <div class="header-actions">
        <div class="search-box">
          <i class="pi pi-search search-icon"></i>
          <InputText v-model="localSearch" placeholder="Cari KDTK/Nama/Note..." @input="onSearchInput"
            class="search-input" />
          <Button v-if="localSearch" icon="pi pi-times" text rounded severity="secondary" class="clear-btn"
            @click="clearSearch" />
        </div>
        <Button icon="pi pi-download" label="Export Excel" severity="success" @click="$emit('export')" />
      </div>
    </div>

    <div class="table-container">
      <DataTable :value="data" :loading="loading" dataKey="KDTK" :rows="pagination.limit" :paginator="true"
        :totalRecords="pagination.total" :lazy="true" :first="(pagination.page - 1) * pagination.limit" :showCurrentPageReport="true"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        @page="onPage" @sort="onSort"
        currentPageReportTemplate="Halaman {currentPage} dari {totalPages} · {first}–{last} dari {totalRecords} toko" scrollable
        :scrollHeight="'600px'" :rowClass="getRowClass" stripedRows>
        <template #loading>
          <div class="skeleton-loading">
            <div v-for="i in 5" :key="i" class="skeleton-row">
              <div v-for="j in 7" :key="j" class="skeleton-cell">
                <Skeleton width="80%" :height="'1rem'" />
              </div>
            </div>
          </div>
        </template>
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-inbox empty-icon"></i>
            <p class="empty-text" v-if="!loading">Belum ada data untuk periode ini. Jalankan screening terlebih dahulu.</p>
            <p class="empty-text" v-else>Memuat data...</p>
          </div>
        </template>
        <Column header="No" frozen :style="{ width: '80px', textAlign: 'center' }">
          <template #body="slotProps">
            <span class="row-number">{{ (pagination.page - 1) * pagination.limit + (slotProps.index + 1) }}</span>
          </template>
        </Column>

        <Column field="CABANG" header="Cabang" sortable :style="{ minWidth: '120px' }" />

        <Column field="KDTK" header="KDTK" sortable :style="{ minWidth: '120px' }">
          <template #body="slotProps">
            <a href="#" class="link-kdtk" @click.prevent="$emit('view-details', slotProps.data)">
              {{ slotProps.data.KDTK }}
            </a>
          </template>
        </Column>

        <Column field="NAMA" header="Nama Toko" sortable :style="{ minWidth: '220px' }">
          <template #body="slotProps">
            <span class="store-name">{{ slotProps.data.NAMA }}</span>
          </template>
        </Column>

        <Column field="TOTAL_ISSUES" header="Jumlah Tanggal Selisih" sortable :style="{ minWidth: '130px', textAlign: 'center' }">
          <template #body="slotProps">
            <Tag :value="String((slotProps.data.TOTAL_DATES ?? slotProps.data.TOTAL_ISSUES) ?? 0)"
              :severity="((slotProps.data.TOTAL_DATES ?? slotProps.data.TOTAL_ISSUES) ?? 0) > 0 ? 'danger' : 'secondary'" rounded />
          </template>
        </Column>

        <Column field="TOTAL_SEL_NET" header="Total SEL NET (GL+CD)" sortable :style="{ minWidth: '180px', textAlign: 'right' }">
          <template #body="slotProps">
            <span :class="['amount-value', amountClass(slotProps.data.TOTAL_SEL_NET ?? 0)]">
              {{ formatNumber(slotProps.data.TOTAL_SEL_NET ?? 0) }}
            </span>
          </template>
        </Column>

        <Column field="TOTAL_SEL_PPN" header="Total SEL PPN (GL+CD)" sortable :style="{ minWidth: '180px', textAlign: 'right' }">
          <template #body="slotProps">
            <span :class="['amount-value', amountClass(slotProps.data.TOTAL_SEL_PPN ?? 0)]">
              {{ formatNumber(slotProps.data.TOTAL_SEL_PPN ?? 0) }}
            </span>
          </template>
        </Column>

        <Column field="UPDTIME_LATEST" header="Last Screened" sortable :style="{ minWidth: '180px' }">
          <template #body="slotProps">
            <span v-tooltip.top="formatDateTime(slotProps.data.UPDTIME_LATEST ?? '')" class="last-screened">
              {{ formatRelativeTime(slotProps.data.UPDTIME_LATEST ?? '') }}
            </span>
          </template>
        </Column>

        <Column header="Notes" :style="{ minWidth: '260px' }">
          <template #body="slotProps">
            <div class="notes-cell" @click="$emit('edit-note', slotProps.data)">
              <div class="note-left">
                <i class="pi pi-pencil note-icon" />
                <span class="note-text">
                  {{ slotProps.data.note?.noteText ?? slotProps.data.note ?? 'Tambah catatan...' }}
                </span>
              </div>
              <div class="note-meta-icons" v-if="slotProps.data.note">
                <i class="pi pi-user"
                  v-tooltip.top="slotProps.data.note?.fullName || slotProps.data.note?.pic || '-'" />
                <i class="pi pi-clock" v-tooltip.top="formatDateTime(slotProps.data.note?.updated_at || '')" />
              </div>
            </div>
          </template>
        </Column>

        <Column header="Actions" frozen alignFrozen="right" :style="{ minWidth: '220px' }">
          <template #body="slotProps">
            <div class="action-buttons">
              <Button label="Detail" icon="pi pi-eye" size="small" outlined
                @click="$emit('view-details', slotProps.data)" />
              <Button :label="isLoading(slotProps.data) ? 'Processing...' : 'Re-screen'" icon="pi pi-refresh"
                size="small" severity="secondary" outlined :loading="isLoading(slotProps.data)"
                :disabled="isLoading(slotProps.data)" @click="$emit('re-screen', slotProps.data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import { formatNumber, formatDateTime, formatRelativeTime } from '../utils/formatters';

const props = defineProps({
  data: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  pagination: { type: Object, required: true },
  sortColumn: { type: String, default: 'KDTK' },
  sortOrder: { type: String, default: 'ASC' },
  searchQuery: { type: String, default: '' },
  loadingStores: { type: Object, default: () => new Set() },
  highlightedItems: { type: Object, default: () => new Set() }
});

const emit = defineEmits([
  'refresh',
  'page-change',
  'sort-change',
  'view-details',
  're-screen',
  'edit-note',
  'export',
  'search-change'
]);

const localSearch = ref(props.searchQuery);
let searchTimer = null;

watch(() => props.searchQuery, (newVal) => {
  localSearch.value = newVal;
});

const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    emit('search-change', localSearch.value);
  }, 500);
};

const clearSearch = () => {
  localSearch.value = '';
  emit('search-change', '');
};

const onPage = (ev) => emit('page-change', { page: ev.page + 1 });

const onSort = (ev) => emit('sort-change', {
  sortColumn: ev.sortField || 'KDTK',
  sortOrder: ev.sortOrder === 1 ? 'ASC' : 'DESC'
});

const isLoading = (row) => props.loadingStores.has(`${row.CABANG || row.CAB}_${row.KDTK}`);

const amountClass = (n) => Number(n || 0) >= 0 ? 'positive' : 'negative';

const getRowClass = (row) => {
  const key = `${row.CABANG || row.CAB || 'Unknown'}_${row.KDTK || 'Unknown'}`;
  return props.highlightedItems.has(key) ? 'row-highlighted' : '';
};
</script>

<style scoped>
.table-wrapper {
  background: var(--surface-color);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 1024px) {
  .table-header {
    flex-wrap: wrap;
  }
}

.table-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .header-actions {
    flex-wrap: wrap;
    width: 100%;
  }
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 280px;
  max-width: 400px;
}

@media (max-width: 1024px) {
  .search-box {
    flex: 1 1 100%;
    max-width: 100%;
  }
}

.search-input {
  width: 100%;
  padding-left: 2.5rem !important;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: #6b7280;
  pointer-events: none;
  z-index: 1;
}

.notes-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}
.note-left { display: inline-flex; align-items: center; gap: .5rem; }
.note-meta-icons { display: inline-flex; align-items: center; gap: .5rem; color: #6b7280; }
.note-meta-icons i { cursor: pointer; }
.clear-btn {
  position: absolute;
  right: 0.25rem;
}

.table-container {
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

/* Table Styling */
:deep(.p-datatable) {
  font-size: 0.875rem;
}

:deep(.p-datatable-thead > tr > th) {
  background: var(--background-color);
  color: var(--text-color);
  font-weight: 600;
  padding: 1rem 0.75rem;
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 0.875rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

:deep(.p-datatable-tbody > tr:hover) {
  background: color-mix(in srgb, var(--primary-color) 8%, var(--surface-color)) !important;
  transition: background-color 0.2s ease;
}

:deep(.p-datatable-tbody > tr.row-highlighted) {
  background: #fef3c7 !important;
  animation: highlight-fade 2s ease-in-out;
}

@keyframes highlight-fade {
  0% {
    background: #fde047 !important;
  }

  100% {
    background: #fef3c7 !important;
  }
}

/* Cell Content */
.row-number {
  color: var(--text-color-secondary);
  font-weight: 500;
}

.link-kdtk {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.link-kdtk:hover {
  color: var(--primary-color-darken);
  text-decoration: underline;
}

.store-name {
  color: var(--text-color);
  font-weight: 500;
}

.amount-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.amount-value.positive {
  color: #059669;
}

.amount-value.negative {
  color: #dc2626;
}

.last-screened {
  color: var(--text-color-secondary);
  font-size: 0.813rem;
}

.notes-cell:hover {
  background: color-mix(in srgb, var(--text-color) 6%, var(--surface-color));
  cursor: pointer;
  border-radius: 4px;
}

.note-icon {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.note-text {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--text-color-secondary);
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}
.empty-text {
  font-size: 1rem;
  text-align: center;
  margin: 0;
}

.skeleton-loading {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.skeleton-row {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
}
.skeleton-cell {
  flex: 1;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* Responsive */
@media (max-width: 768px) {
  .table-wrapper {
    padding: 1rem;
  }

  .table-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    flex-direction: column;
  }

  .search-box {
    max-width: 100%;
  }
}
</style>
