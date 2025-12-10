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
        :totalRecords="pagination.total" @page="onPage" @sort="onSort" scrollable :scrollHeight="'600px'"
        :rowClass="getRowClass" stripedRows>
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

        <Column field="TOTAL_ISSUES" header="Total Issues" sortable :style="{ minWidth: '130px', textAlign: 'center' }">
          <template #body="slotProps">
            <Tag :value="String(slotProps.data.TOTAL_ISSUES ?? 0)"
              :severity="(slotProps.data.TOTAL_ISSUES ?? 0) > 0 ? 'danger' : 'secondary'" rounded />
          </template>
        </Column>

        <Column header="Total SEL NET (GL+CD)" :style="{ minWidth: '180px', textAlign: 'right' }">
          <template #body="slotProps">
            <span :class="['amount-value', amountClass((slotProps.data.TOTAL_SEL_NET_GL ?? 0) + (slotProps.data.TOTAL_SEL_NET_CD ?? 0))]">
              {{ formatNumber((slotProps.data.TOTAL_SEL_NET_GL ?? 0) + (slotProps.data.TOTAL_SEL_NET_CD ?? 0)) }}
            </span>
          </template>
        </Column>

        <Column header="Total SEL PPN (GL+CD)" :style="{ minWidth: '180px', textAlign: 'right' }">
          <template #body="slotProps">
            <span :class="['amount-value', amountClass((slotProps.data.TOTAL_SEL_PPN_GL ?? 0) + (slotProps.data.TOTAL_SEL_PPN_CD ?? 0))]">
              {{ formatNumber((slotProps.data.TOTAL_SEL_PPN_GL ?? 0) + (slotProps.data.TOTAL_SEL_PPN_CD ?? 0)) }}
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
                <i class="pi pi-user" v-tooltip.top="slotProps.data.note?.fullName || slotProps.data.note?.pic || '-'" />
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
  background: #ffffff;
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
  color: #1f2937;
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
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

/* Table Styling */
:deep(.p-datatable) {
  font-size: 0.875rem;
}

:deep(.p-datatable-thead > tr > th) {
  background: #f9fafb;
  color: #374151;
  font-weight: 600;
  padding: 1rem 0.75rem;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 0.875rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

:deep(.p-datatable-tbody > tr:hover) {
  background: #f0f9ff !important;
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
  color: #6b7280;
  font-weight: 500;
}

.link-kdtk {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.link-kdtk:hover {
  color: #2563eb;
  text-decoration: underline;
}

.store-name {
  color: #1f2937;
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
  color: #6b7280;
  font-size: 0.813rem;
}


.notes-cell:hover {
  background: #f3f4f6;
  cursor: pointer;
}

.note-icon {
  color: #9ca3af;
  font-size: 0.875rem;
}

.note-text {
  color: #6b7280;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
