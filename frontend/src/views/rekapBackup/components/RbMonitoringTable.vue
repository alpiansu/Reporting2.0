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

<style scoped src="./RbMonitoringTable.style.css"></style>
