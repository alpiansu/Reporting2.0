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

      <div v-if="data.length > 0" class="bulk-toolbar">
        <div class="bulk-info">
          <Checkbox v-model="selectAllChecked" :binary="true" @change="toggleSelectAll" />
          <Badge v-if="selectedRows.length > 0" :value="selectedRows.length" severity="info"></Badge>
          <span v-if="selectedRows.length > 0" class="ml-2">{{ selectedRows.length }} data terpilih</span>
          <span v-else class="text-muted ml-2">Pilih data untuk dikirim ke FTP</span>
        </div>
        <div class="bulk-actions" v-if="selectedRows.length > 0">
          <div class="field-checkbox mr-3">
            <Checkbox id="forceSend" v-model="forceSend" :binary="true" />
            <label for="forceSend" class="ml-1">Kirim ulang</label>
          </div>
          <Button
            icon="pi pi-send"
            :label="`Kirim ke FTP (${sendableCount})`"
            class="p-button-primary p-button-sm"
            :disabled="sendableCount === 0 || sending"
            @click="handleSendToFtp"
          />
          <Button
            icon="pi pi-times"
            label="Hapus pilihan"
            class="p-button-text p-button-sm"
            @click="clearSelection"
          />
        </div>
      </div>

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

      <div class="ftp-summary" v-if="ftpSummary && ftpSummary.items && ftpSummary.items.length > 0">
        <div class="ftp-summary-header">
          <h3><i class="pi pi-send"></i> Ringkasan Pengiriman FTP</h3>
          <div class="ftp-summary-totals">
            <span class="total-badge"><strong>{{ ftpSummary.totals.total }}</strong> Total</span>
            <span class="sent-badge"><strong>{{ ftpSummary.totals.sent }}</strong> Terkirim</span>
            <span class="unsent-badge"><strong>{{ ftpSummary.totals.unsent }}</strong> Belum Kirim</span>
          </div>
        </div>
        <div class="ftp-cabang-cards">
          <div
            v-for="item in ftpSummary.items"
            :key="item.cabang"
            class="ftp-cabang-card"
            :class="{ 'all-sent': Number(item.unsent) === 0 }"
          >
            <div class="cabang-code">{{ item.cabang }}</div>
            <div class="cabang-stats">
              <div class="stat">
                <span class="stat-value">{{ item.total }}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat">
                <span class="stat-value sent">{{ item.sent }}</span>
                <span class="stat-label">Terkirim</span>
              </div>
              <div class="stat">
                <span class="stat-value unsent">{{ item.unsent }}</span>
                <span class="stat-label">Tertunda</span>
              </div>
            </div>
            <Button
              v-if="Number(item.unsent) > 0"
              icon="pi pi-send"
              label="Kirim Semua"
              class="p-button-sm p-button-outlined send-all-btn"
              :loading="sendingCabang === item.cabang"
              :disabled="sending"
              @click="handleDispatchUnsent(item.cabang)"
            />
            <Tag v-else severity="success" value="Lengkap" class="complete-tag" />
          </div>
        </div>
      </div>

      <div class="send-result" v-if="lastSendDetails.length > 0">
        <div class="send-result-header">
          <h3><i class="pi pi-file"></i> Hasil Pengiriman</h3>
          <div class="send-result-actions">
            <span class="result-summary">
              {{ lastSendSummary.success }} sukses, {{ lastSendSummary.skipped }} skip, {{ lastSendSummary.failed }} gagal
            </span>
            <Button icon="pi pi-copy" label="Copy" class="p-button-sm p-button-outlined" @click="copySendResult" />
            <Button icon="pi pi-file-excel" label="Export Excel" class="p-button-sm p-button-success" @click="exportSendResult" />
            <Button icon="pi pi-times" class="p-button-sm p-button-text" @click="clearSendResult" />
          </div>
        </div>
        <DataTable :value="lastSendDetails" class="p-datatable-sm" stripedRows :resizableColumns="true"
          columnResizeMode="expand" showGridlines paginator :rows="50" :rowsPerPageOptions="[20,50,100]"
          paginatorPosition="bottom">
          <Column field="no" header="No" style="width:50px">
            <template #body="{ data: row, index }">
              {{ index + 1 }}
            </template>
          </Column>
          <Column field="kdtk" header="KDTK" style="width:80px" />
          <Column field="namaToko" header="Nama Toko" style="min-width:150px" />
          <Column field="tglTransaksi" header="Tanggal" style="width:110px">
            <template #body="{ data: row }">
              {{ formatDate(row.tglTransaksi) }}
            </template>
          </Column>
          <Column field="nama_file" header="Nama File" style="min-width:200px" />
          <Column field="status" header="Status" style="width:100px">
            <template #body="{ data: row }">
              <Tag :severity="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'warn'"
                :value="row.status === 'success' ? 'Sukses' : row.status === 'skipped' ? 'Skip' : 'Gagal'" />
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="table-section">
        <DataTable :value="data" :loading="loading" :lazy="true" :totalRecords="total"
          :rows="tableLimit" :rowsPerPageOptions="[10, 25, 50]" paginator
          :sortField="sortColumn" :sortOrder="sortDir" @sort="handleSort"
          @page="handlePage" paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="Menampilkan {first}-{last} dari {totalRecords}"
          paginatorPosition="bottom" class="p-datatable-sm data-table" stripedRows :resizableColumns="true"
          columnResizeMode="expand" showGridlines :rowClass="rowClass">
          <Column selectionMode="multiple" headerStyle="width:50px" style="width:50px">
            <template #body="{ data: row }">
              <Checkbox
                :value="row"
                :modelValue="selectedRows"
                @update:modelValue="toggleRowSelection($event, row)"
                :disabled="!canSendRow(row)"
              />
            </template>
          </Column>
          <Column field="RECID" header="Status" :sortable="true" style="width:70px">
            <template #body="{ data: row }">
              <Tag :severity="row.RECID === '1' ? 'success' : 'warning'">
                {{ row.RECID === '1' ? 'OK' : '?' }}
              </Tag>
            </template>
          </Column>
          <Column field="KODE_PROMO" header="Kode Promo" :sortable="true" style="min-width:120px" />
          <Column field="KODE_GUDANG" header="Gudang" :sortable="true" style="width:80px" />
          <Column field="JENIS_TOKO" header="Jenis Toko" :sortable="true" style="min-width:120px" />
          <Column field="KODE_TOKO" header="Toko" :sortable="true" style="width:80px" />
          <Column field="TGL_TRANSAKSI" header="Tanggal" :sortable="true" style="width:110px">
            <template #body="{ data: row }">
              {{ formatDate(row.TGL_TRANSAKSI) }}
            </template>
          </Column>
          <Column field="RP_NTB_LHDR" header="Rp NTB LHDR" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.RP_NTB_LHDR) }}
            </template>
          </Column>
          <Column field="RP_GLSLP_LHDR" header="Rp GLSLP LHDR" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.RP_GLSLP_LHDR) }}
            </template>
          </Column>
          <Column field="SELISIH_RP_LHDR" header="Selisih LHDR" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.SELISIH_RP_LHDR) }}
            </template>
          </Column>
          <Column field="RP_NTB_EDP" header="Rp NTB EDP" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.RP_NTB_EDP) }}
            </template>
          </Column>
          <Column field="RP_GLSLP_EDP" header="Rp GLSLP EDP" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              {{ formatNumber(row.RP_GLSLP_EDP) }}
            </template>
          </Column>
          <Column field="SELISIH_RP_EDP" header="Selisih EDP" :sortable="true" style="width:130px">
            <template #body="{ data: row }">
              <span :class="selisihClass(row.SELISIH_RP_EDP)">{{ formatNumber(row.SELISIH_RP_EDP) }}</span>
            </template>
          </Column>
          <Column field="KLASIFIKASI" header="Klasifikasi" :sortable="false" style="width:130px">
            <template #body="{ data: row }">
              <Tag :severity="klasifikasiSeverity(row.KLASIFIKASI)" :value="row.KLASIFIKASI" />
            </template>
          </Column>
          <Column field="HASIL_CEK" header="Hasil Cek" :sortable="true" style="min-width:150px">
            <template #body="{ data: row }">
              <span :class="row.HASIL_CEK ? '' : 'text-muted'">{{ row.HASIL_CEK || '-' }}</span>
            </template>
          </Column>
          <Column field="TGL_CEK" header="Tgl Cek" style="width:100px">
            <template #body="{ data: row }">
              {{ row.TGL_CEK ? formatDate(row.TGL_CEK) : '-' }}
            </template>
          </Column>
          <Column field="IP_CEK" header="IP Cek" style="width:100px">
            <template #body="{ data: row }">
              <span :class="row.IP_CEK ? '' : 'text-muted'">{{ row.IP_CEK || '-' }}</span>
            </template>
          </Column>
          <Column header="Aksi" style="width:100px">
            <template #body="{ data: row }">
              <Button icon="pi pi-check-circle" label="Cek" class="p-button-sm p-button-outlined"
                @click="openCekModal(row)" />
            </template>
          </Column>
          <Column field="status_kirim" header="Status Kirim" style="width:120px">
            <template #body="{ data: row }">
              <Tag v-if="getSentStatus(row) === 'success'" severity="success" value="Sudah" />
              <Tag v-else-if="getSentStatus(row) === 'failed'" severity="danger" value="Gagal" />
              <Tag v-else-if="getSentStatus(row) === 'pending'" severity="warn" value="Proses" />
              <Tag v-else-if="!canSendRow(row)" severity="danger" value="Tdk bisa kirim" />
              <small v-else class="text-muted">Belum</small>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <Dialog
      v-model:visible="progressDialogVisible"
      header="Mengirim DTHR ke FTP Nielsen"
      :modal="true"
      :closable="!sending"
      :style="{ width: '580px' }"
      @hide="cancelProgressTimeout"
    >
      <div class="progress-dialog-body">
        <ProgressBar :value="sendProgress.percentage" class="mb-3"></ProgressBar>
        <div class="progress-info text-center mb-3">
          <strong>{{ sendProgress.completed }} / {{ sendProgress.total }}</strong> item
          <span v-if="sending"> — sedang mengirim...</span>
        </div>
        <div class="progress-timing" v-if="elapsedSeconds > 0">
          <small class="text-muted">Waktu: {{ formatElapsed(elapsedSeconds) }}</small>
        </div>
        <div class="progress-results" v-if="sendResults.length > 0">
          <div
            v-for="r in sendResults"
            :key="r.fileName"
            class="result-row"
            :class="'result-' + r.status"
          >
            <i :class="r.status === 'success' ? 'pi pi-check-circle text-success' : r.status === 'failed' ? 'pi pi-times-circle text-danger' : 'pi pi-info-circle text-warning'"></i>
            <span class="result-file ml-2">{{ r.fileName }}</span>
            <small class="result-status ml-auto">{{ r.status }}</small>
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          v-if="sending"
          label="Batalkan"
          icon="pi pi-times"
          class="p-button-danger p-button-outlined"
          @click="handleCancelSend"
        />
        <Button
          v-if="!sending"
          label="Tutup"
          icon="pi pi-check"
          class="p-button-primary"
          @click="progressDialogVisible = false"
        />
      </template>
    </Dialog>

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
            <label>Jenis Toko:</label>
            <span>{{ cekRecord.JENIS_TOKO || '-' }}</span>
          </div>
          <div class="field-row">
            <label>Tanggal:</label>
            <span>{{ formatDate(cekRecord.TGL_TRANSAKSI) }}</span>
          </div>
          <div class="field-row">
            <label>Rp NTB LHDR:</label>
            <span>{{ formatNumber(cekRecord.RP_NTB_LHDR) }}</span>
          </div>
          <div class="field-row">
            <label>Rp GLSLP LHDR:</label>
            <span>{{ formatNumber(cekRecord.RP_GLSLP_LHDR) }}</span>
          </div>
          <div class="field-row">
            <label>Selisih LHDR:</label>
            <span>{{ formatNumber(cekRecord.SELISIH_RP_LHDR) }}</span>
          </div>
          <div class="field-row">
            <label>Rp NTB EDP:</label>
            <span>{{ formatNumber(cekRecord.RP_NTB_EDP) }}</span>
          </div>
          <div class="field-row">
            <label>Rp GLSLP EDP:</label>
            <span>{{ formatNumber(cekRecord.RP_GLSLP_EDP) }}</span>
          </div>
          <div class="field-row">
            <label>Selisih EDP:</label>
            <span :class="selisihClass(cekRecord.SELISIH_RP_EDP)">{{ formatNumber(cekRecord.SELISIH_RP_EDP) }}</span>
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
import Checkbox from 'primevue/checkbox';
import Badge from 'primevue/badge';
import ProgressBar from 'primevue/progressbar';
import { useCabangStore } from '@/stores';
import { useToast } from 'primevue/usetoast';
import ntbVsGlslpApi from '@/services/ntbVsGlslp.service.js';
import progressApi from '@/services/progress.service.js';
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

const toast = useToast();

const selectedRows = ref([]);
const selectAllChecked = ref(false);
const sentStatusMap = ref({});
const sending = ref(false);
const sendProgress = ref({ completed: 0, total: 0, percentage: 0 });
const sendResults = ref([]);
const progressDialogVisible = ref(false);
const forceSend = ref(false);

const ftpSummary = ref(null);
const sendingCabang = ref(null);
const progressTimeout = ref(null);
const elapsedSeconds = ref(0);
const elapsedTimer = ref(null);
const activeEventSource = ref(null);
const currentTaskId = ref(null);
const lastSendDetails = ref([]);
const lastSendSummary = ref({ success: 0, skipped: 0, failed: 0 });

const cekModalVisible = ref(false);
const cekRecord = ref({});
const cekHasil = ref('');
const saving = ref(false);

const sortDir = computed(() => sortOrder.value === 'ASC' ? 1 : -1);

function canSendRow(row) {
  if (!row.HASIL_CEK) return true;
  const lower = row.HASIL_CEK.toLowerCase();
  return !(lower.includes('file hr') && lower.includes('tidak ada'));
}

function getSentStatus(row) {
  const key = `${row.KODE_TOKO}_${row.TGL_TRANSAKSI}`;
  return sentStatusMap.value[key] || null;
}

function rowClass(data) {
  if (getSentStatus(data) === 'success') return 'row-sent';
  if (!canSendRow(data)) return 'row-cannot-send';
  return '';
}

const sendableCount = computed(() => {
  return selectedRows.value.filter(r => canSendRow(r)).length;
});

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

    await loadSentStatus();
    await loadFtpSummary();
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

function toggleRowSelection(event, row) {
  if (selectedRows.value.includes(row)) {
    selectedRows.value = selectedRows.value.filter(r => r !== row);
  } else {
    selectedRows.value = [...selectedRows.value, row];
  }
}

function toggleSelectAll() {
  if (selectAllChecked.value) {
    selectedRows.value = data.value.filter(r => canSendRow(r));
  } else {
    selectedRows.value = [];
  }
}

function clearSelection() {
  selectedRows.value = [];
  selectAllChecked.value = false;
}

async function loadSentStatus() {
  if (!data.value.length) return;
  const items = data.value.map(r => ({ kodeToko: r.KODE_TOKO, tglTransaksi: r.TGL_TRANSAKSI }));
  try {
    const res = await ntbVsGlslpApi.checkSentStatus(items);
    sentStatusMap.value = res.data || {};
  } catch {
    sentStatusMap.value = {};
  }
}

function startElapsedTimer() {
  elapsedSeconds.value = 0;
  clearInterval(elapsedTimer.value);
  elapsedTimer.value = setInterval(() => { elapsedSeconds.value++; }, 1000);
}

function stopElapsedTimer() {
  clearInterval(elapsedTimer.value);
  elapsedTimer.value = null;
}

function formatElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function cancelProgressTimeout() {
  if (progressTimeout.value) {
    clearTimeout(progressTimeout.value);
    progressTimeout.value = null;
  }
}

async function loadFtpSummary() {
  const periode = getPeriode();
  if (!periode) {
    ftpSummary.value = null;
    return;
  }
  try {
    const res = await ntbVsGlslpApi.getDispatchSummary(activeCabang.value, periode);
    ftpSummary.value = res.data;
  } catch {
    ftpSummary.value = null;
  }
}

async function handleDispatchUnsent(cabang) {
  const periode = getPeriode();
  if (!periode) return;

  sendingCabang.value = cabang;
  sending.value = true;
  progressDialogVisible.value = true;
  sendProgress.value = { completed: 0, total: 0, percentage: 0 };
  sendResults.value = [];
  startElapsedTimer();
  cancelProgressTimeout();

  try {
    const dispatchRes = await ntbVsGlslpApi.dispatchUnsent(cabang, periode, forceSend.value);
    const taskId = dispatchRes.data.taskId;
    currentTaskId.value = taskId;
    const totalItems = dispatchRes.data.total || 0;
    sendProgress.value.total = totalItems;

    if (totalItems === 0) {
      sendProgress.value = { completed: 0, total: 0, percentage: 100 };
      sending.value = false;
      sendingCabang.value = null;
      stopElapsedTimer();
      await loadFtpSummary();
      toast.add({ severity: 'info', summary: 'Semua item sudah terkirim', life: 3000 });
      return;
    }

    const es = progressApi.monitorProgress(
      taskId,
      (data) => {
        sendProgress.value = {
          completed: data.completed || 0,
          total: totalItems,
          percentage: data.percentage || 0,
        };
        if (data.description) {
          const match = data.description.match(/^(.+?) → (\w+)/);
          if (match) {
            const exists = sendResults.value.some(r => r.fileName === match[1]);
            if (!exists) {
              sendResults.value.push({ fileName: match[1], status: match[2] === 'skip' ? 'skipped' : match[2] });
            }
          }
        }
      },
      async (progressData) => {
        es.close();
        activeEventSource.value = null;
        currentTaskId.value = null;
        sending.value = false;
        sendingCabang.value = null;
        stopElapsedTimer();
        cancelProgressTimeout();
        const pinfo = progressData?.info;
        if (pinfo?.details) {
          lastSendDetails.value = pinfo.details;
        }
        lastSendSummary.value = {
          success: pinfo?.success ?? 0,
          skipped: pinfo?.skipped ?? 0,
          failed: pinfo?.failed ?? 0,
        };
        sendProgress.value = {
          completed: progressData?.completed ?? totalItems,
          total: totalItems,
          percentage: 100,
        };
        await loadFtpSummary();
        await loadSentStatus();
        toast.add({ severity: 'success', summary: 'Pengiriman selesai', life: 3000 });
        setTimeout(() => { progressDialogVisible.value = false; }, 1500);
      },
      async (progressData) => {
        es.close();
        activeEventSource.value = null;
        currentTaskId.value = null;
        sending.value = false;
        sendingCabang.value = null;
        stopElapsedTimer();
        cancelProgressTimeout();
        if (progressData) {
          sendProgress.value = {
            completed: progressData.completed || 0,
            total: totalItems,
            percentage: progressData.percentage || 0,
          };
        }
        await loadFtpSummary();
        toast.add({ severity: 'error', summary: 'Pengiriman gagal', life: 5000 });
      },
      async () => {
        es.close();
        activeEventSource.value = null;
        currentTaskId.value = null;
        sending.value = false;
        sendingCabang.value = null;
        stopElapsedTimer();
        cancelProgressTimeout();
        progressDialogVisible.value = false;
        await loadFtpSummary();
        toast.add({ severity: 'warn', summary: 'Pengiriman dibatalkan', life: 3000 });
      },
    );
    activeEventSource.value = es;

    progressTimeout.value = setTimeout(() => {
      if (sending.value) {
        toast.add({ severity: 'warn', summary: 'Pengiriman masih berlangsung...', detail: `Proses berjalan ${formatElapsed(elapsedSeconds.value)}`, life: 10000 });
      }
    }, 30000);
  } catch (err) {
    sending.value = false;
    sendingCabang.value = null;
    currentTaskId.value = null;
    stopElapsedTimer();
    cancelProgressTimeout();
    toast.add({ severity: 'error', summary: 'Gagal memulai pengiriman', detail: err.message, life: 5000 });
  }
}

async function handleCancelSend() {
  if (activeEventSource.value) {
    activeEventSource.value.close();
    activeEventSource.value = null;
  }
  if (progressTimeout.value) {
    clearTimeout(progressTimeout.value);
    progressTimeout.value = null;
  }
  if (currentTaskId.value) {
    try {
      await progressApi.cancelTask(currentTaskId.value);
    } catch { /* ignore if task already gone */ }
    currentTaskId.value = null;
  }
  sending.value = false;
  sendingCabang.value = null;
  stopElapsedTimer();
  progressDialogVisible.value = false;
  toast.add({ severity: 'info', summary: 'Pengiriman dibatalkan', life: 3000 });
}

function clearSendResult() {
  lastSendDetails.value = [];
  lastSendSummary.value = { success: 0, skipped: 0, failed: 0 };
}

async function copySendResult() {
  if (!lastSendDetails.value.length) return;
  const header = 'KDTK\tNama Toko\tTanggal\tNama File\tStatus';
  const rows = lastSendDetails.value.map(r =>
    `${r.kdtk}\t${r.namaToko}\t${r.tglTransaksi}\t${r.nama_file}\t${r.status === 'success' ? 'Sukses' : r.status === 'skipped' ? 'Skip' : 'Gagal'}`
  );
  const text = `No\t${header}\n${rows.map((r, i) => `${i + 1}\t${r}`).join('\n')}`;
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ severity: 'success', summary: 'Hasil pengiriman di-copy ke clipboard', life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Gagal copy ke clipboard', life: 3000 });
  }
}

function exportSendResult() {
  if (!lastSendDetails.value.length) return;
  const exportData = lastSendDetails.value.map((r, i) => ({
    No: i + 1,
    KDTK: r.kdtk,
    'Nama Toko': r.namaToko,
    Tanggal: r.tglTransaksi || '',
    'Nama File': r.nama_file,
    Status: r.status === 'success' ? 'Sukses' : r.status === 'skipped' ? 'Skip' : 'Gagal',
  }));
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, sheet, 'Hasil Kirim');
  XLSX.writeFile(wb, `hasil_kirim_ftp_${Date.now()}.xlsx`);
}

async function handleSendToFtp() {
  const seen = new Set();
  const items = selectedRows.value
    .filter(r => canSendRow(r))
    .map(r => ({ kodeToko: r.KODE_TOKO, tglTransaksi: r.TGL_TRANSAKSI }))
    .filter(i => {
      const key = `${i.kodeToko}_${i.tglTransaksi}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (items.length === 0) {
    toast.add({ severity: 'warn', summary: 'Tidak ada data yang bisa dikirim', life: 3000 });
    return;
  }

  sending.value = true;
  progressDialogVisible.value = true;
  sendProgress.value = { completed: 0, total: items.length, percentage: 0 };
  sendResults.value = [];
  startElapsedTimer();
  cancelProgressTimeout();

  try {
    const dispatchRes = await ntbVsGlslpApi.dispatchToFtp(items, forceSend.value);
    const taskId = dispatchRes.data.taskId;
    currentTaskId.value = taskId;

    const eventSource = progressApi.monitorProgress(
      taskId,
      (data) => {
        sendProgress.value = {
          completed: data.completed || 0,
          total: items.length,
          percentage: data.percentage || 0,
        };
        if (data.description) {
          const match = data.description.match(/^(.+?) → (\w+)/);
          if (match) {
            const exists = sendResults.value.some(r => r.fileName === match[1]);
            if (!exists) {
              sendResults.value.push({ fileName: match[1], status: match[2] === 'skip' ? 'skipped' : match[2] });
            }
          }
        }
      },
      async (progressData) => {
        eventSource.close();
        activeEventSource.value = null;
        currentTaskId.value = null;
        sending.value = false;
        stopElapsedTimer();
        cancelProgressTimeout();
        const pinfo = progressData?.info;
        if (pinfo?.details) {
          lastSendDetails.value = pinfo.details;
        }
        lastSendSummary.value = {
          success: pinfo?.success ?? 0,
          skipped: pinfo?.skipped ?? 0,
          failed: pinfo?.failed ?? 0,
        };
        sendProgress.value = {
          completed: progressData?.completed ?? items.length,
          total: items.length,
          percentage: 100,
        };
        await loadSentStatus();
        toast.add({ severity: 'success', summary: 'Pengiriman selesai', life: 3000 });
        setTimeout(() => { progressDialogVisible.value = false; }, 1500);
      },
      async (progressData) => {
        eventSource.close();
        activeEventSource.value = null;
        currentTaskId.value = null;
        sending.value = false;
        stopElapsedTimer();
        cancelProgressTimeout();
        if (progressData) {
          sendProgress.value = {
            completed: progressData.completed || 0,
            total: items.length,
            percentage: progressData.percentage || 0,
          };
        }
        toast.add({ severity: 'error', summary: 'Pengiriman gagal', life: 5000 });
      },
      async () => {
        eventSource.close();
        activeEventSource.value = null;
        currentTaskId.value = null;
        sending.value = false;
        stopElapsedTimer();
        cancelProgressTimeout();
        progressDialogVisible.value = false;
        toast.add({ severity: 'warn', summary: 'Pengiriman dibatalkan', life: 3000 });
      },
    );
    activeEventSource.value = eventSource;

    progressTimeout.value = setTimeout(() => {
      if (sending.value) {
        toast.add({ severity: 'warn', summary: 'Pengiriman masih berlangsung...', detail: `Proses berjalan ${formatElapsed(elapsedSeconds.value)}`, life: 10000 });
      }
    }, 30000);
  } catch (err) {
    sending.value = false;
    currentTaskId.value = null;
    stopElapsedTimer();
    cancelProgressTimeout();
    toast.add({ severity: 'error', summary: 'Gagal kirim', detail: err.message, life: 5000 });
  }
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
      'Jenis Toko': r.JENIS_TOKO || '',
      Toko: r.KODE_TOKO,
      Tanggal: r.TGL_TRANSAKSI,
      'Rp NTB LHDR': r.RP_NTB_LHDR,
      'Rp GLSLP LHDR': r.RP_GLSLP_LHDR,
      'Selisih LHDR': r.SELISIH_RP_LHDR,
      'Rp NTB EDP': r.RP_NTB_EDP,
      'Rp GLSLP EDP': r.RP_GLSLP_EDP,
      'Selisih EDP': r.SELISIH_RP_EDP,
      Klasifikasi: r.KLASIFIKASI,
      'Nama File': r.NAMA_FILE || '',
      'Hasil Cek': r.HASIL_CEK || '',
      'Tgl Cek': r.TGL_CEK || '',
      'IP Cek': r.IP_CEK || '',
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

.send-result {
  margin-bottom: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
}

.send-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.send-result-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.send-result-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.result-summary {
  font-size: 0.85rem;
  color: #6c757d;
  padding: 0.25rem 0.5rem;
  background: white;
  border-radius: 4px;
}

.table-section {
  margin-top: 0.5rem;
}

.data-table {
  font-size: 0.9rem;
}

:deep(.row-sent) {
  background-color: #e8f5e9 !important;
}

:deep(.row-cannot-send) {
  background-color: #fff3e0 !important;
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

.bulk-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.bulk-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bulk-actions {
  display: flex;
  align-items: center;
}

.progress-dialog-body {
  padding: 0.5rem 0;
}

.ftp-summary {
  margin-bottom: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
}

.ftp-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ftp-summary-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ftp-summary-totals {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
}

.ftp-summary-totals span {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: white;
}

.total-badge { color: #2196f3; }
.sent-badge { color: #4caf50; }
.unsent-badge { color: #ff9800; }

.ftp-cabang-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.65rem;
}

.ftp-cabang-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: box-shadow 0.15s;
}

.ftp-cabang-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}

.ftp-cabang-card.all-sent {
  opacity: 0.65;
}

.ftp-cabang-card.all-sent:hover {
  opacity: 1;
}

.cabang-code {
  font-weight: 700;
  font-size: 1rem;
  color: #343a40;
  background: #e8f4f8;
  padding: 0.15rem 0.75rem;
  border-radius: 4px;
}

.cabang-stats {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  justify-content: center;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.8rem;
}

.stat-value {
  font-weight: 700;
  font-size: 1.1rem;
}

.stat-value.sent { color: #4caf50; }
.stat-value.unsent { color: #ff9800; }
.stat-label { color: #868e96; font-size: 0.7rem; }

.send-all-btn {
  width: 100%;
}

.complete-tag {
  font-size: 0.75rem;
}

.progress-timing {
  text-align: center;
  margin-bottom: 0.5rem;
}

.progress-results {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 0.5rem;
}

.result-row {
  display: flex;
  align-items: center;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
  border-bottom: 1px solid #f0f0f0;
}

.result-row:last-child {
  border-bottom: none;
}

.result-file {
  font-family: monospace;
  flex: 1;
}

.field-checkbox {
  display: flex;
  align-items: center;
}
</style>
