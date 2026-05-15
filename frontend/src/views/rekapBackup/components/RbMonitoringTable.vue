<template>
  <div class="monitoring-table card">
    <!-- Toolbar -->
    <div class="table-toolbar">
      <div class="table-toolbar__title">
        <h3>Monitoring Kelengkapan Backup</h3>
        <span>{{ filteredData.length }} dari {{ data.length }} cabang ditampilkan</span>
      </div>
      <div class="table-search-wrapper">
        <i class="pi pi-search search-icon"></i>
        <InputText
          v-model="searchQuery"
          placeholder="Cari nama / kode cabang..."
          class="search-input"
        />
      </div>
    </div>

    <!-- DataTable -->
    <DataTable
      :value="filteredData"
      :loading="loading"
      responsiveLayout="scroll"
      stripedRows
      emptyMessage="Tidak ada data ditemukan."
      paginator
      :rows="10"
      :rowsPerPageOptions="[10, 25, 50]"
      class="datatable-monitoring"
    >
      <!-- Cabang Column -->
      <Column field="cabang" header="Cabang" sortable style="width: 220px; padding-left: 1.25rem;">
        <template #body="{ data: row }">
          <div class="cabang-cell">
            <div class="cabang-info">
              <strong>{{ getCabangName(row.cabang) }}</strong>
              <small>{{ row.cabang }}</small>
            </div>
          </div>
        </template>
      </Column>

      <!-- Harian Column -->
      <Column style="min-width: 270px;">
        <template #header>
          <div class="col-header">
            <span class="col-badge col-badge--info">H</span>
            <span>Harian</span>
          </div>
        </template>
        <template #body="{ data: row }" >
          <div class="status-cell" @click="$emit('open-detail', row.cabang, 'harian')">
            <div class="status-cell__main">
              <Tag severity="info" :value="`${row.total_harian || 0} Files`" class="status-tag" />
              <div class="status-cell__meta">
                <i class="pi pi-clock"></i>
                <span>{{ row.oldest_harian || '—' }}</span>
                <i class="pi pi-arrow-right"></i>
                <span>{{ row.newest_harian || '—' }}</span>
              </div>
            </div>
            <Button
              icon="pi pi-search-plus"
              class="p-button-rounded p-button-text p-button-sm detail-btn"
              v-tooltip.left="'Lihat History Harian'"
              @click.stop="$emit('open-detail', row.cabang, 'harian')"
            />
          </div>
        </template>
      </Column>

      <!-- Bulanan Column -->
      <Column style="min-width: 270px;">
        <template #header>
          <div class="col-header">
            <span class="col-badge col-badge--warning">B</span>
            <span>Bulanan</span>
          </div>
        </template>
        <template #body="{ data: row }">
          <div class="status-cell" @click="$emit('open-detail', row.cabang, 'bulanan')">
            <div class="status-cell__main">
              <Tag severity="warning" :value="`${row.total_bln || 0} Files (IDT)`" class="status-tag" />
              <div class="status-cell__meta">
                <i class="pi pi-calendar-minus"></i>
                <span>{{ row.oldest_bln || '—' }}</span>
                <i class="pi pi-arrow-right"></i>
                <span>{{ row.newest_bln || '—' }}</span>
              </div>
            </div>
            <Button
              icon="pi pi-search-plus"
              class="p-button-rounded p-button-text p-button-sm detail-btn"
              v-tooltip.left="'Lihat History Bulanan'"
              @click.stop="$emit('open-detail', row.cabang, 'bulanan')"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Tag from 'primevue/tag';
import { useCabangStore } from '@/stores';

const props = defineProps({
  data:    { type: Array,   default: () => [] },
  loading: { type: Boolean, default: false },
});

defineEmits(['open-detail']);

const cabangStore = useCabangStore();
const getCabangName = (kdcab) => cabangStore.getCabangName(kdcab);

const searchQuery = ref('');
const filteredData = computed(() => {
  if (!searchQuery.value) return props.data;
  const q = searchQuery.value.toLowerCase();
  return props.data.filter(d =>
    d.cabang?.toLowerCase().includes(q) ||
    getCabangName(d.cabang)?.toLowerCase().includes(q)
  );
});
</script>

<style scoped>
.monitoring-table {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

/* Toolbar */
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.table-toolbar__title h3 {
  margin: 0 0 0.1rem;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

.table-toolbar__title span {
  font-size: 0.75rem;
  color: #94a3b8;
}

.table-search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 0.825rem;
  pointer-events: none;
}

.search-input {
  height: 38px !important;
  padding-left: 2.25rem !important;
  border: 1.5px solid #e2e8f0 !important;
  border-radius: 8px !important;
  background: #f8fafc !important;
  font-size: 0.875rem !important;
  width: 240px;
}

/* Column header */
.col-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.col-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  flex-shrink: 0;
}

.col-badge--info    { background: #dbeafe; color: #1d4ed8; }
.col-badge--warning { background: #fef3c7; color: #b45309; }

/* Cabang cell */
.cabang-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cabang-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.cabang-info strong {
  font-size: 0.875rem;
  color: #1e293b;
  line-height: 1.3;
}

.cabang-info small {
  font-size: 0.72rem;
  color: #94a3b8;
}

/* Status cell */
.status-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.status-cell:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.status-cell:hover .detail-btn {
  opacity: 1;
}

.status-cell__main {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.status-tag {
  font-size: 0.72rem;
  width: max-content;
}

.status-cell__meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: #64748b;
}

.status-cell__meta .pi {
  font-size: 0.65rem;
}

.detail-btn {
  opacity: 0;
  width: 30px !important;
  height: 30px !important;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

/* DataTable deep overrides */
:deep(.datatable-monitoring .p-datatable-thead > tr > th) {
  background: #f8fafc;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.875rem 1rem;
  border-bottom: 2px solid #e2e8f0;
}

:deep(.datatable-monitoring .p-datatable-tbody > tr > td) {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid #f8fafc;
  vertical-align: middle;
}

:deep(.datatable-monitoring .p-datatable-tbody > tr) {
  transition: background-color 0.15s;
}

:deep(.datatable-monitoring .p-datatable-tbody > tr:hover) {
  background-color: #f8fafc !important;
}

:deep(.datatable-monitoring .p-paginator) {
  border-top: 1px solid #f1f5f9;
  padding: 0.75rem 1rem;
  background: #fafafa;
}

@media (max-width: 768px) {
  .table-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-input {
    width: 100%;
  }
}
</style>
