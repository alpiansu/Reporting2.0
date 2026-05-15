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

    <!-- DataTable dengan grouped header -->
     <!-- {{filteredData}} -->
    <DataTable
      :value="filteredData"
      :loading="loading"
      responsiveLayout="scroll"
      stripedRows
      emptyMessage="Tidak ada data ditemukan."
      class="datatable-monitoring"
      sortMode="single"
    >
      <!-- =============== GROUPED HEADER =============== -->
      <ColumnGroup type="header">
        <!-- Row 1: Group Labels -->
        <Row>
          <Column header="cabang" sortable sortField="cabang" :rowspan="2" style="width: 200px;">
            <template #header>
              <div class="group-label group-label--harian">
                <span class="group-badge">I</span>
                <span>Informasi Cabang</span>
              </div>
            </template>
          </Column>
          <Column header="" :rowspan="2" style="width: 50px;" />
          <!-- Harian group -->
          <Column :colspan="3" class="group-header group-header--harian">
            <template #header>
              <div class="group-label group-label--harian">
                <span class="group-badge">H</span>
                <span>Monitoring Harian</span>
              </div>
            </template>
          </Column>
          <!-- Bulanan group -->
          <Column :colspan="3" class="group-header group-header--bulanan">
            <template #header>
              <div class="group-label group-label--bulanan">
                <span class="group-badge group-badge--warning">B</span>
                <span>Monitoring Bulanan</span>
              </div>
            </template>
          </Column>
        </Row>
        <!-- Row 2: Sub-column labels -->
        <Row>
          <!-- Harian sub-columns -->
          <Column header="Total Files"      sortable sortField="total_harian" style="width: 120px;" />
          <Column header="Periode Awal"     sortable sortField="oldest_harian" style="width: 130px;" />
          <Column header="Periode Terbaru"  sortable sortField="newest_harian" style="width: 130px;" />
          <!-- Bulanan sub-columns -->
          <Column header="Total Files (IDT)" sortable sortField="total_bln"    style="width: 130px;" />
          <Column header="Periode Awal"      sortable sortField="oldest_bln"   style="width: 130px;" />
          <Column header="Periode Terbaru"   sortable sortField="newest_bln"   style="width: 130px;" />
        </Row>
      </ColumnGroup>

      <!-- =============== BODY COLUMNS =============== -->

      <!-- 1. Cabang -->
      <Column field="cabang" style="width: 200px; padding-left: 1.25rem;">
        <template #body="{ data: row }">
          <div class="cabang-info">
            <strong>{{ getCabangName(row.cabang) }}</strong>
            <small>{{ row.cabang }}</small>
          </div>
        </template>
      </Column>

      <!-- 2. Aksi (tombol detail, rowspan via styling di paling kiri setelah cabang) -->
      <Column style="width: 50px; text-align: center;">
        <template #body="{ data: row }">
          <Button
            icon="pi pi-search-plus"
            class="p-button-rounded p-button-text p-button-sm detail-btn-fixed"
            v-tooltip.right="'Lihat History Detail'"
            @click="$emit('open-detail', row.cabang, activeType)"
          />
        </template>
      </Column>

      <!-- 3. Harian: Total Files -->
      <Column field="total_harian" sortField="total_harian" style="width: 120px;">
        <template #body="{ data: row }">
          <div class="num-cell num-cell--harian" @click="$emit('open-detail', row.cabang, 'harian')">
            <span class="num-value">{{ formatNumber(row.total_harian) }}</span>
            <small>files</small>
          </div>
        </template>
      </Column>

      <!-- 4. Harian: Periode Awal -->
      <Column field="oldest_harian" sortField="oldest_harian" style="width: 130px;">
        <template #body="{ data: row }">
          <div class="period-cell period-cell--oldest" @click="$emit('open-detail', row.cabang, 'harian')">
            <i class="pi pi-calendar period-icon"></i>
            <span>{{ row.oldest_harian || '—' }}</span>
          </div>
        </template>
      </Column>

      <!-- 5. Harian: Periode Terbaru -->
      <Column field="newest_harian" sortField="newest_harian" style="width: 130px;">
        <template #body="{ data: row }">
          <div class="period-cell period-cell--newest" @click="$emit('open-detail', row.cabang, 'harian')">
            <i class="pi pi-calendar-plus period-icon"></i>
            <span>{{ row.newest_harian || '—' }}</span>
          </div>
        </template>
      </Column>

      <!-- 6. Bulanan: Total Files -->
      <Column field="total_bln" sortField="total_bln" style="width: 130px;">
        <template #body="{ data: row }">
          <div class="num-cell num-cell--bulanan" @click="$emit('open-detail', row.cabang, 'bulanan')">
            <span class="num-value">{{ formatNumber(row.total_bln) }}</span>
            <small>files (IDT)</small>
          </div>
        </template>
      </Column>

      <!-- 7. Bulanan: Periode Awal -->
      <Column field="oldest_bln" sortField="oldest_bln" style="width: 130px;">
        <template #body="{ data: row }">
          <div class="period-cell period-cell--oldest" @click="$emit('open-detail', row.cabang, 'bulanan')">
            <i class="pi pi-calendar period-icon"></i>
            <span>{{ row.oldest_bln || '—' }}</span>
          </div>
        </template>
      </Column>

      <!-- 8. Bulanan: Periode Terbaru -->
      <Column field="newest_bln" sortField="newest_bln" style="width: 130px;">
        <template #body="{ data: row }">
          <div class="period-cell period-cell--newest" @click="$emit('open-detail', row.cabang, 'bulanan')">
            <i class="pi pi-calendar-plus period-icon"></i>
            <span>{{ row.newest_bln || '—' }}</span>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import ColumnGroup from 'primevue/columngroup';
import Row from 'primevue/row';
import { useCabangStore } from '@/stores';

const props = defineProps({
  data:    { type: Array,   default: () => [] },
  loading: { type: Boolean, default: false },
});

defineEmits(['open-detail']);

const cabangStore = useCabangStore();
const getCabangName = (kdcab) => cabangStore.getCabangName(kdcab);

// Format angka ribuan tanpa desimal (id-ID: pemisah titik)
const formatNumber = (n) => {
  if (n === null || n === undefined || n === '') return '0';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n));
};

// Default active type untuk tombol detail di kolom aksi
const activeType = ref('bulanan');

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

/* ── Toolbar ───────────────────────────────── */
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

/* ── Grouped header labels ─────────────────── */
.group-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.group-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  background: #dbeafe;
  color: #1d4ed8;
  flex-shrink: 0;
}

.group-badge--warning {
  background: #fef3c7;
  color: #b45309;
}

/* ── Cabang cell ───────────────────────────── */
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

/* ── Detail button (fixed position col) ────── */
.detail-btn-fixed {
  width: 30px !important;
  height: 30px !important;
  opacity: 0.4;
  transition: opacity 0.15s;
}

/* ── Number cell ───────────────────────────── */
.num-cell {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  cursor: pointer;
  padding: 0.25rem 0.375rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.num-cell:hover {
  background: #f1f5f9;
}

.num-value {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.num-cell--harian .num-value  { color: #1d4ed8; }
.num-cell--bulanan .num-value { color: #b45309; }

.num-cell small {
  font-size: 0.68rem;
  color: #94a3b8;
  font-weight: 500;
}

/* ── Period cell ───────────────────────────── */
.period-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 500;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.period-cell:hover {
  background: #f1f5f9;
}

.period-icon {
  font-size: 0.72rem;
  flex-shrink: 0;
}

/* Awal — subtle grey-blue */
.period-cell--oldest {
  color: #64748b;
}

.period-cell--oldest .period-icon {
  color: #94a3b8;
}

/* Terbaru — lebih tegas, hijau tua jika ada data */
.period-cell--newest {
  color: #0f766e;
  font-weight: 600;
}

.period-cell--newest .period-icon {
  color: #14b8a6;
}

/* Kosong / tidak ada data */
.period-cell span:only-child,
.period-cell > span:last-child {
  color: inherit;
}

/* ── DataTable deep overrides ──────────────── */

/* Row 1 group headers */
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th) {
  background: #f1f5f9;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0;              /* hide auto-generated text, use slot */
}

/* Row 1 — Harian group: beri accent biru sangat terang */
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th:nth-child(3)),
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th:nth-child(4)),
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th:nth-child(5)) {
  background: #eff6ff;
  border-left: 2px solid #bfdbfe;
}

/* Row 1 — Bulanan group: beri accent kuning sangat terang */
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th:nth-child(6)),
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th:nth-child(7)),
:deep(.datatable-monitoring .p-datatable-thead > tr:first-child > th:nth-child(8)) {
  background: #fffbeb;
  border-left: 2px solid #fde68a;
}

/* Row 2 sub-column headers */
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th) {
  background: #f8fafc;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.625rem 1rem;
  border-bottom: 2px solid #e2e8f0;
}

/* Sub-cols Harian accent */
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th:nth-child(1)),
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th:nth-child(2)),
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th:nth-child(3)) {
  border-left: 2px solid #bfdbfe;
}

/* Sub-cols Bulanan accent */
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th:nth-child(4)),
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th:nth-child(5)),
:deep(.datatable-monitoring .p-datatable-thead > tr:last-child > th:nth-child(6)) {
  border-left: 2px solid #fde68a;
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

:deep(.datatable-monitoring .p-datatable-tbody > tr:hover .detail-btn-fixed) {
  opacity: 1;
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
