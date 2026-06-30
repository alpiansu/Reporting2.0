<template>
  <div class="ntb-vs-glslp-view">
    <PageHeader title="Rekonsiliasi NTB vs GLSLP"
      subtitle="Perbandingan nilai transaksi antara NTB dan GLSLP"
      description="Halaman ini menampilkan data rekonsiliasi selisih antara nilai NTB dan GLSLP per promo-gudang-toko-tanggal." />

    <div class="content-container">
      <Card class="filter-card">
        <template #content>
          <div class="filter-container">
            <div class="filter-group">
              <label class="filter-label"><i class="pi pi-calendar"></i> Periode</label>
              <Calendar v-model="periodeDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun"
                :maxDate="today" showIcon class="w-full" @date-select="handlePeriodeSelect" />
            </div>

            <div class="filter-group">
              <label class="filter-label"><i class="pi pi-building"></i> Cabang</label>
              <Dropdown v-model="activeCabang" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab"
                placeholder="Semua Cabang" class="w-full" @change="loadData" />
            </div>

            <div class="filter-group">
              <label class="filter-label"><i class="pi pi-filter"></i> Tampilkan</label>
              <div class="recid-toggle">
                <SelectButton v-model="recidFilter" :options="recidOptions" optionLabel="label" optionValue="value"
                  @change="loadData" />
              </div>
            </div>

            <div class="filter-group flex-grow">
              <label class="filter-label"><i class="pi pi-search"></i> Pencarian</label>
              <div class="search-box">
                <InputText v-model="searchQuery" placeholder="Cari promo, toko, file..." class="w-full"
                  @input="onSearchInput" />
                <Button v-if="searchQuery" icon="pi pi-times" class="p-button-text p-button-sm clear-btn"
                  @click="clearSearch" />
              </div>
            </div>

            <div class="filter-actions">
              <Button icon="pi pi-refresh" label="Refresh" class="p-button-outlined" @click="loadData" />
              <Button icon="pi pi-file-excel" label="Export Excel" class="p-button-success" :disabled="!data.length"
                @click="exportExcel" />
            </div>
          </div>
        </template>
      </Card>

      <div v-if="summary" class="summary-cards">
        <Card class="summary-card total">
          <template #title>{{ summary.total || 0 }}</template>
          <template #content>Total Records</template>
        </Card>
        <Card class="summary-card sesui">
          <template #title>{{ summary.sesui || 0 }}</template>
          <template #content>SESUAI (Rp 0)</template>
        </Card>
        <Card class="summary-card toleransi">
          <template #title>{{ summary.toleransi || 0 }}</template>
          <template #content>TOLERANSI (≤ Rp 10)</template>
        </Card>
        <Card class="summary-card selisih">
          <template #title>{{ summary.selisih || 0 }}</template>
          <template #content>SELISIH (> Rp 10)</template>
        </Card>
      </div>

      <div class="table-section">
        <DataTable :value="data" :loading="loading" :lazy="true" :totalRecords="total"
          :rows="tableLimit" :rowsPerPageOptions="[10, 25, 50]" paginator
          :sortField="sortColumn" :sortOrder="sortDir" @sort="handleSort"
          @page="handlePage" paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="Menampilkan {first}-{last} dari {totalRecords}"
          paginatorPosition="bottom" class="p-datatable-sm data-table" stripedRows :resizableColumns="true"
          columnResizeMode="expand" showGridlines>
          <Column field="RECID" header="Status" :sortable="true" style="width:70px">
            <template #body="{ data: row }">
              <Tag :severity="row.RECID === '1' ? 'success' : 'warning'">
                {{ row.RECID === '1' ? 'OK' : '?' }}
              </Tag>
            </template>
          </Column>
          <Column field="KODE_PROMO" header="Kode Promo" :sortable="true" style="min-width:120px" />
          <Column field="KODE_GUDANG" header="Gudang" :sortable="true" style="width:80px" />
          <Column field="KODE_TOKO" header="Toko" :sortable="true" style="width:80px" />
          <Column field="TGL_TRANSAKSI" header="Tanggal" :sortable="true" style="width:110px">
            <template #body="{ data: row }">
              {{ formatDate(row.TGL_TRANSAKSI) }}
            </template>
          </Column>
          <Column field="RP_NTB" header="Rp NTB" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.RP_NTB) }}
            </template>
          </Column>
          <Column field="RP_GLSLP" header="Rp GLSLP" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.RP_GLSLP) }}
            </template>
          </Column>
          <Column field="SELISIH_RP" header="Selisih" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              <span :class="selisihClass(row.SELISIH_RP)">{{ formatNumber(row.SELISIH_RP) }}</span>
            </template>
          </Column>
          <Column field="KLASIFIKASI" header="Klasifikasi" :sortable="false" style="width:130px">
            <template #body="{ data: row }">
              <Tag :severity="klasifikasiSeverity(row.KLASIFIKASI)" :value="row.KLASIFIKASI" />
            </template>
          </Column>
          <Column field="HASIL_CEK" header="Hasil Cek" style="min-width:150px">
            <template #body="{ data: row }">
              <span :class="row.HASIL_CEK ? '' : 'text-muted'">{{ row.HASIL_CEK || '-' }}</span>
            </template>
          </Column>
          <Column field="TGL_CEK" header="Tgl Cek" style="width:100px">
            <template #body="{ data: row }">
              {{ row.TGL_CEK ? formatDate(row.TGL_CEK) : '-' }}
            </template>
          </Column>
          <Column header="Aksi" style="width:100px">
            <template #body="{ data: row }">
              <Button icon="pi pi-check-circle" label="Cek" class="p-button-sm p-button-outlined"
                @click="openCekModal(row)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="cekModalVisible" header="Update Hasil Cek" :modal="true" :style="{ width: '500px' }"
      :closable="true">
      <div class="cek-modal-body">
        <div class="field-group">
          <div class="field-row">
            <label>Kode Promo:</label>
            <span>{{ cekRecord.KODE_PROMO }}</span>
          </div>
          <div class="field-row">
            <label>Kode Toko:</label>
            <span>{{ cekRecord.KODE_TOKO }}</span>
          </div>
          <div class="field-row">
            <label>Tanggal:</label>
            <span>{{ formatDate(cekRecord.TGL_TRANSAKSI) }}</span>
          </div>
          <div class="field-row">
            <label>Rp NTB:</label>
            <span>{{ formatNumber(cekRecord.RP_NTB) }}</span>
          </div>
          <div class="field-row">
            <label>Rp GLSLP:</label>
            <span>{{ formatNumber(cekRecord.RP_GLSLP) }}</span>
          </div>
          <div class="field-row">
            <label>Selisih:</label>
            <span :class="selisihClass(cekRecord.SELISIH_RP)">{{ formatNumber(cekRecord.SELISIH_RP) }}</span>
          </div>
          <div class="field-row">
            <label>Klasifikasi:</label>
            <Tag :severity="klasifikasiSeverity(cekRecord.KLASIFIKASI)" :value="cekRecord.KLASIFIKASI" />
          </div>
        </div>
        <div class="field-full">
          <label for="hasilCek">Hasil Pemeriksaan</label>
          <Textarea id="hasilCek" v-model="cekHasil" rows="3" class="w-full"
            placeholder="Masukkan hasil pemeriksaan..." />
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="closeCekModal" />
        <Button label="Simpan" icon="pi pi-check" class="p-button-primary" :loading="saving"
          @click="saveHasilCek" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import PageHeader from '../../components/PageHeader.vue';
import Card from 'primevue/card';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import SelectButton from 'primevue/selectbutton';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import { useCabangStore } from '@/stores';
import ntbVsGlslpApi from '@/services/ntbVsGlslp.service.js';
import * as XLSX from 'xlsx';

const cabangStore = useCabangStore();

const today = ref(new Date());
const periodeDate = ref(null);
const activeCabang = ref('All');
const cabangOptions = ref([]);
const recidFilter = ref('1');
const recidOptions = ref([
  { label: 'Hanya Masalah', value: '1' },
  { label: 'Semua Data', value: '0' },
]);
const searchQuery = ref('');
const searchTimer = ref(null);
const loading = ref(false);

const data = ref([]);
const total = ref(0);
const currentPage = ref(1);
const tableLimit = ref(10);
const sortColumn = ref('TGL_TRANSAKSI');
const sortOrder = ref('DESC');
const summary = ref(null);

const cekModalVisible = ref(false);
const cekRecord = ref({});
const cekHasil = ref('');
const saving = ref(false);

const sortDir = computed(() => sortOrder.value === 'ASC' ? 1 : -1);

onMounted(async () => {
  try {
    const cabangData = await cabangStore.fetchCabang();
    cabangOptions.value = [
      { kdcab: 'All', namacab: 'SEMUA CABANG' },
      ...(Array.isArray(cabangData) ? cabangData : []),
    ];
  } catch {
    cabangOptions.value = [{ kdcab: 'All', namacab: 'SEMUA CABANG' }];
  }
});

function getPeriode() {
  if (!periodeDate.value) return null;
  const year = periodeDate.value.getFullYear().toString().slice(-2);
  const month = (periodeDate.value.getMonth() + 1).toString().padStart(2, '0');
  return `${year}${month}`;
}

async function loadData() {
  const periode = getPeriode();
  if (!periode) return;

  loading.value = true;
  try {
    const res = await ntbVsGlslpApi.getRecords(activeCabang.value, periode, {
      page: currentPage.value,
      limit: tableLimit.value,
      recidFilter: recidFilter.value,
      searchQuery: searchQuery.value || undefined,
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value,
    });
    data.value = res.data?.data || [];
    total.value = res.data?.total || 0;

    const sumRes = await ntbVsGlslpApi.getSummary(activeCabang.value, periode, recidFilter.value);
    summary.value = sumRes.data;
  } catch (err) {
    console.error('Error loading data:', err);
    data.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function handlePeriodeSelect() {
  currentPage.value = 1;
  loadData();
}

function handleSort(event) {
  sortColumn.value = event.sortField || 'TGL_TRANSAKSI';
  sortOrder.value = event.sortOrder === 1 ? 'ASC' : 'DESC';
  loadData();
}

function handlePage(event) {
  currentPage.value = event.page + 1;
  tableLimit.value = event.rows;
  loadData();
}

function onSearchInput() {
  clearTimeout(searchTimer.value);
  searchTimer.value = setTimeout(() => {
    currentPage.value = 1;
    loadData();
  }, 400);
}

function clearSearch() {
  searchQuery.value = '';
  currentPage.value = 1;
  loadData();
}

function openCekModal(row) {
  cekRecord.value = row;
  cekHasil.value = row.HASIL_CEK || '';
  cekModalVisible.value = true;
}

function closeCekModal() {
  cekModalVisible.value = false;
  cekRecord.value = {};
  cekHasil.value = '';
}

async function saveHasilCek() {
  saving.value = true;
  try {
    await ntbVsGlslpApi.updateRecord({
      kodePromo: cekRecord.value.KODE_PROMO,
      kodeToko: cekRecord.value.KODE_TOKO,
      kodeGudang: cekRecord.value.KODE_GUDANG,
      tglTransaksi: cekRecord.value.TGL_TRANSAKSI,
      hasilCek: cekHasil.value,
      periode: getPeriode(),
    });
    closeCekModal();
    await loadData();
  } catch (err) {
    console.error('Error saving:', err);
  } finally {
    saving.value = false;
  }
}

async function exportExcel() {
  const periode = getPeriode();
  if (!periode || !data.value.length) return;

  try {
    const res = await ntbVsGlslpApi.getAllRecords(activeCabang.value, periode, recidFilter.value);
    const rows = res.data || [];

    const wb = XLSX.utils.book_new();
    const exportData = rows.map(r => ({
      Status: r.RECID === '1' ? 'OK' : 'Belum',
      'Kode Promo': r.KODE_PROMO,
      Gudang: r.KODE_GUDANG,
      Toko: r.KODE_TOKO,
      Tanggal: r.TGL_TRANSAKSI,
      'Rp NTB': r.RP_NTB,
      'Rp GLSLP': r.RP_GLSLP,
      Selisih: r.SELISIH_RP,
      Klasifikasi: r.KLASIFIKASI,
      'Hasil Cek': r.HASIL_CEK || '',
      'Tgl Cek': r.TGL_CEK || '',
    }));
    const sheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, sheet, 'Data');
    XLSX.writeFile(wb, `ntb_vs_glslp_${periode}_${activeCabang.value}_${Date.now()}.xlsx`);
  } catch (err) {
    console.error('Export error:', err);
  }
}

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('id-ID');
}

function selisihClass(val) {
  const n = Number(val);
  if (n === 0) return 'text-success';
  if (Math.abs(n) <= 10) return 'text-warning';
  return 'text-danger font-bold';
}

function klasifikasiSeverity(klas) {
  if (klas === 'SESUAI') return 'success';
  if (klas === 'TOLERANSI') return 'warn';
  return 'danger';
}
</script>

<style scoped>
.ntb-vs-glslp-view {
  padding: 1.5rem;
}

.content-container {
  margin-top: 1rem;
}

.filter-card {
  margin-bottom: 1rem;
}

.filter-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.filter-group {
  min-width: 180px;
}

.filter-group.flex-grow {
  flex: 1;
  min-width: 200px;
}

.filter-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: #495057;
}

.recid-toggle {
  display: flex;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.clear-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  padding-bottom: 1px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.summary-card :deep(.p-card-title) {
  font-size: 1.8rem;
  text-align: center;
}

.summary-card :deep(.p-card-content) {
  text-align: center;
  padding-top: 0;
  font-size: 0.9rem;
}

.summary-card.total :deep(.p-card) {
  border-left: 4px solid #2196f3;
}

.summary-card.sesui :deep(.p-card) {
  border-left: 4px solid #4caf50;
}

.summary-card.toleransi :deep(.p-card) {
  border-left: 4px solid #ff9800;
}

.summary-card.selisih :deep(.p-card) {
  border-left: 4px solid #f44336;
}

.table-section {
  margin-top: 0.5rem;
}

.data-table {
  font-size: 0.9rem;
}

.text-success {
  color: #4caf50;
}

.text-warning {
  color: #ff9800;
}

.text-danger {
  color: #f44336;
}

.font-bold {
  font-weight: 700;
}

.text-muted {
  color: #adb5bd;
  font-style: italic;
}

.cek-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.field-row label {
  min-width: 110px;
  font-weight: 600;
  font-size: 0.9rem;
  color: #495057;
}

.field-row span {
  font-size: 0.9rem;
}

.field-full {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-full label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #495057;
}
</style>
