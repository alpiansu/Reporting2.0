<template>
  <div class="panduan-ceklist-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-book"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Panduan Ceklist Closing Bulanan</h1>
          <p class="header-subtitle">
            Kelola guide Before Closing Bulanan, akses server &amp; database per cabang
          </p>
        </div>
      </div>

      <div class="header-actions">
        <!-- Statistik Chips Integrated -->
        <div class="stat-chips-group">
          <div class="stat-chip" v-tooltip.top="`${rows.length} panduan cabang terdaftar`">
            <i class="pi pi-building chip-icon"></i>
            <span class="chip-count">{{ rows.length }}</span>
            <span class="chip-label">Cabang</span>
          </div>
          <div class="stat-chip chip-ok" v-tooltip.top="'Semua field inti (IP, remote, DB, tampung) sudah terisi'">
            <i class="pi pi-check-circle chip-icon"></i>
            <span class="chip-count">{{ completeCount }}</span>
            <span class="chip-label">Lengkap</span>
          </div>
          <button
            type="button"
            class="stat-chip chip-warn"
            :class="{ 'chip-active': onlyIncomplete }"
            :disabled="incompleteCount === 0"
            v-tooltip.top="incompleteRowsHint"
            @click="onlyIncomplete = !onlyIncomplete"
          >
            <i class="pi pi-exclamation-triangle chip-icon"></i>
            <span class="chip-count">{{ incompleteCount }}</span>
            <span class="chip-label">Perlu Dilengkapi</span>
            <span v-if="onlyIncomplete" class="chip-filter-badge">filter aktif</span>
          </button>
        </div>

        <!-- Action Buttons -->
        <Button
          icon="pi pi-refresh"
          label="Muat Ulang"
          class="p-button-secondary p-button-sm btn-header"
          :loading="loading"
          @click="loadData"
        />
        <Button
          icon="pi pi-plus"
          label="Tambah Panduan"
          class="p-button-primary p-button-sm btn-header"
          @click="openCreate"
        />
      </div>
    </header>

    <div class="content-container">
      <!-- ===== TOOLBAR: pencarian + filter ===== -->
      <div class="toolbar-panel">
        <div class="toolbar-filters">
          <IconField iconPosition="left" class="search-field">
            <InputIcon><i class="pi pi-search" /></InputIcon>
            <InputText v-model="search" placeholder="Cari KDCAB, nama, atau IP..." />
          </IconField>

          <Dropdown
            v-model="osFilter"
            :options="osOptions"
            showClear
            placeholder="Semua OS"
            class="filter-dd" />

          <Dropdown
            v-model="remoteFilter"
            :options="remoteOptions"
            showClear
            placeholder="Semua Remote"
            class="filter-dd" />

          <Button
            v-if="hasFilter"
            label="Reset Filter"
            icon="pi pi-times"
            class="p-button-text p-button-sm"
            @click="resetFilters" />
        </div>
      </div>

      <!-- ===== MASTER (daftar) + DETAIL ===== -->
      <div class="md-grid">
        <!-- Master list -->
        <aside class="panel master-panel">
          <div class="panel-head">
            <span class="panel-title"><i class="pi pi-bars"></i> Daftar Cabang</span>
            <span class="panel-count">{{ filteredRows.length }}{{ filteredRows.length !== rows.length ? ` / ${rows.length}` : '' }}</span>
          </div>

          <div class="master-list">
            <!-- Loading skeleton -->
            <template v-if="loading && rows.length === 0">
              <div v-for="n in 5" :key="'sk' + n" class="skeleton-item">
                <span class="sk-bar sk-w40"></span>
                <span class="sk-bar sk-w70"></span>
              </div>
            </template>

            <!-- Empty: tanpa data sama sekali -->
            <div v-else-if="rows.length === 0" class="list-empty">
              <i class="pi pi-inbox"></i>
              <span>Belum ada panduan.</span>
              <Button label="Tambah Pertama" icon="pi pi-plus" class="p-button-primary p-button-sm" @click="openCreate" />
            </div>

            <!-- Empty: hasil pencarian/filter kosong -->
            <div v-else-if="filteredRows.length === 0" class="list-empty">
              <i class="pi pi-search"></i>
              <span>Tidak ada cabang yang cocok.</span>
              <Button label="Reset Filter" icon="pi pi-times" class="p-button-text p-button-sm" @click="resetFilters" />
            </div>

            <!-- Items -->
            <template v-else>
            <button
              v-for="row in pagedRows"
              :key="row.KDCAB"
              type="button"
              class="master-item"
              :class="{ active: row.KDCAB === selectedKdcab }"
              @click="selectedKdcab = row.KDCAB">
              <div class="mi-top">
                <span class="mi-code font-mono">{{ formatCode(row.KDCAB) }}</span>
                <span class="mi-name">{{ row.NAMACAB || '—' }}</span>
                <i
                  v-if="missingFields(row).length"
                  class="pi pi-exclamation-triangle mi-warn"
                  v-tooltip.top="'Belum diisi: ' + missingFields(row).join(', ')"></i>
              </div>
              <div class="mi-tags">
                <Tag :value="row.OS || '—'" :severity="row.OS === 'WINDOWS' ? 'info' : 'warning'" />
                <Tag
                  v-for="m in rowRemotes(row)"
                  :key="m"
                  :value="m"
                  :severity="methodSeverity(m)" />
              </div>
              <div v-if="row.IP_BULANAN" class="mi-ip">
                <code>{{ row.IP_BULANAN }}</code>
              </div>
            </button>
            </template>
          </div>

          <div v-if="filteredRows.length > 0" class="master-foot">
            <div class="page-info">Menampilkan {{ pageStart }}–{{ pageEnd }} dari {{ filteredRows.length }}</div>
            <Paginator
              v-if="filteredRows.length > pageRows"
              :first="pageFirst"
              :rows="pageRows"
              :totalRecords="filteredRows.length"
              :rowsPerPageOptions="[10, 25, 50]"
              template="PrevPageLink PageLinks NextPageLink RowsPerPageDropdown"
              @page="onPage" />
          </div>
        </aside>

        <!-- Detail panel -->
        <section class="panel detail-panel" ref="detailPanel">
          <template v-if="selected">
            <div class="detail-head">
              <div class="dh-info">
                <div class="dh-title">
                  <b class="font-mono">{{ formatCode(selected.KDCAB) }}</b>
                  <span class="dh-name">{{ selected.NAMACAB || '—' }}</span>
                  <Tag :value="selected.OS || '—'" :severity="selected.OS === 'WINDOWS' ? 'info' : 'warning'" />
                </div>
                <div class="dh-sub">
                  <template v-if="missingFields(selected).length">
                    <span class="dh-incomplete">
                      <i class="pi pi-exclamation-triangle"></i>
                      Belum: {{ missingFields(selected).join(', ') }}
                    </span>
                  </template>
                  <span v-else class="dh-complete">
                    <i class="pi pi-check-circle"></i> Data lengkap
                  </span>
                </div>
              </div>
              <div class="dh-actions">
                <Button
                  label="Edit"
                  icon="pi pi-pencil"
                  class="p-button-info p-button-sm"
                  @click="openEdit(selected)" />
                <Button
                  label="Hapus"
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger p-button-sm"
                  @click="askDelete(selected)" />
              </div>
            </div>

            <div class="detail-body">
              <PanduanCard :panduan="selected" hide-head />
            </div>
          </template>

          <div v-else class="detail-empty">
            <template v-if="loading">
              <i class="pi pi-spin pi-spinner"></i>
              <span>Memuat data...</span>
            </template>
            <template v-else>
              <i class="pi pi-angle-double-left detail-empty-icon"></i>
              <span>Pilih salah satu cabang di daftar untuk melihat detail panduan.</span>
            </template>
          </div>
        </section>
      </div>
    </div>

    <!-- ===== Form Dialog (bertab) ===== -->
    <Dialog
      v-model:visible="dlgVisible"
      :header="isEdit ? 'Edit Panduan ' + formatCode(form.kdcab) : 'Tambah Panduan'"
      modal
      :draggable="false"
      class="panduan-dialog"
      :style="{ width: '760px', maxWidth: '95vw' }">
      <Tabs v-model:value="activeTab" class="panduan-tabs">
        <TabList>
          <Tab value="identitas">
            Identitas
            <i v-if="tabHasData('identitas')" class="pi pi-check tab-check"></i>
          </Tab>
          <Tab value="bulanan">
            Server Bulanan
            <i v-if="tabHasData('bulanan')" class="pi pi-check tab-check"></i>
          </Tab>
          <Tab value="db">
            Database
            <i v-if="tabHasData('db')" class="pi pi-check tab-check"></i>
          </Tab>
          <Tab value="tampung">
            Server Tampung
            <i v-if="tabHasData('tampung')" class="pi pi-check tab-check"></i>
          </Tab>
          <Tab value="catatan">
            Catatan
            <i v-if="tabHasData('catatan')" class="pi pi-check tab-check"></i>
          </Tab>
        </TabList>

        <TabPanels>
          <!-- Identitas -->
          <TabPanel value="identitas">
            <div class="form-grid">
              <div class="form-field">
                <label>KDCAB <span class="req">*</span></label>
                <InputText
                  v-model="form.kdcab"
                  placeholder="G033"
                  class="w-full"
                  :class="{ 'p-invalid': kdcabInvalid }"
                  :disabled="isEdit"
                  @input="kdcabInvalid = false" />
                <small v-if="kdcabInvalid" class="p-error">KDCAB wajib diisi</small>
              </div>
              <div class="form-field">
                <label>Nama Cabang</label>
                <InputText v-model="form.namacab" placeholder="TANGERANG 2" class="w-full" />
              </div>
              <div class="form-field">
                <label>OS</label>
                <Dropdown v-model="form.os" :options="['WINDOWS', 'LINUX']" placeholder="Pilih OS" class="w-full" />
              </div>
            </div>
          </TabPanel>

          <!-- Server Bulanan -->
          <TabPanel value="bulanan">
            <div class="form-grid">
              <div class="form-field">
                <label>IP Address</label>
                <InputText v-model="form.ip_bulanan" placeholder="192.168.36.100" class="w-full" />
              </div>
              <div class="form-field">
                <label>User</label>
                <InputText v-model="form.user_bulanan" placeholder="root / edp / kosong (VNC)" class="w-full" />
              </div>
              <div class="form-field">
                <label>Password</label>
                <div class="pwd-field">
                  <InputText
                    v-model="form.pass_bulanan"
                    :type="showPwd.bulanan ? 'text' : 'password'"
                    class="w-full"
                    autocomplete="off" />
                  <button type="button" class="pwd-eye" @click="togglePwd('bulanan')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                    <i :class="showPwd.bulanan ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
              </div>
              <div class="form-field">
                <label>Port</label>
                <InputText v-model="form.port_bulanan" placeholder="22 / 2808" class="w-full" />
              </div>
              <div class="form-field">
                <label>Metode Remote</label>
                <Dropdown v-model="form.remote_bulanan" :options="['SSH', 'RDP', 'VNC']" placeholder="Pilih metode" class="w-full" />
              </div>
            </div>
          </TabPanel>

          <!-- Database -->
          <TabPanel value="db">
            <div class="form-grid">
              <div class="form-field">
                <label>DB User</label>
                <InputText v-model="form.db_user" placeholder="root" class="w-full" />
              </div>
              <div class="form-field">
                <label>DB Password</label>
                <div class="pwd-field">
                  <InputText
                    v-model="form.db_pass"
                    :type="showPwd.db ? 'text' : 'password'"
                    class="w-full"
                    autocomplete="off" />
                  <button type="button" class="pwd-eye" @click="togglePwd('db')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                    <i :class="showPwd.db ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
              </div>
              <div class="form-field">
                <label>DB Port</label>
                <InputText v-model="form.db_port" placeholder="3306" class="w-full" />
              </div>
              <div class="form-field form-field-full">
                <label>Cek HDD</label>
                <InputText v-model="form.hdd_check" placeholder="df -h /home, min 50 GB" class="w-full" />
              </div>
            </div>
          </TabPanel>

          <!-- Server Tampung -->
          <TabPanel value="tampung">
            <div class="form-grid">
              <div class="form-field">
                <label>IP Address</label>
                <InputText v-model="form.ip_tampung" placeholder="192.168.36.134" class="w-full" />
              </div>
              <div class="form-field">
                <label>User</label>
                <InputText v-model="form.user_tampung" placeholder="SERVER FTP" class="w-full" />
              </div>
              <div class="form-field">
                <label>Password</label>
                <div class="pwd-field">
                  <InputText
                    v-model="form.pass_tampung"
                    :type="showPwd.tampung ? 'text' : 'password'"
                    class="w-full"
                    autocomplete="off" />
                  <button type="button" class="pwd-eye" @click="togglePwd('tampung')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                    <i :class="showPwd.tampung ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
              </div>
              <div class="form-field">
                <label>Metode Remote</label>
                <Dropdown v-model="form.remote_tampung" :options="['RDP', 'RDP + VNC', 'VNC']" placeholder="Pilih metode" class="w-full" />
              </div>
              <div class="form-field">
                <label>Pass VNC</label>
                <div class="pwd-field">
                  <InputText
                    v-model="form.vnc_pass_tampung"
                    :type="showPwd.vnc ? 'text' : 'password'"
                    class="w-full"
                    autocomplete="off" />
                  <button type="button" class="pwd-eye" @click="togglePwd('vnc')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                    <i :class="showPwd.vnc ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
              </div>
              <div class="form-field form-field-full">
                <label>Path Tampung</label>
                <InputText v-model="form.path_tampung" placeholder="E:\G026\BACKUP\BULANAN" class="w-full" />
              </div>
            </div>
          </TabPanel>

          <!-- Catatan -->
          <TabPanel value="catatan">
            <div class="form-grid">
              <div class="form-field form-field-full">
                <label>Catatan</label>
                <Textarea v-model="form.catatan" rows="4" class="w-full" placeholder="Catatan tambahan..." />
                <small class="field-hint">Catatan ditampilkan di bagian bawah panduan pada halaman Ceklist Prepare Closing.</small>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <template #footer>
        <div class="dialog-footer-hint"><span class="req">*</span> KDCAB wajib diisi, isian lain opsional</div>
        <div class="dialog-footer-actions">
          <Button label="Batal" icon="pi pi-times" class="p-button-text" :disabled="saving" @click="dlgVisible = false" />
          <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :loading="saving" @click="save" />
        </div>
      </template>
    </Dialog>

    <!-- Confirm Delete -->
    <Dialog v-model:visible="confirmDlg.visible" header="Konfirmasi Hapus" modal :draggable="false" :style="{ width: '400px', maxWidth: '95vw' }">
      <div class="confirm-body">
        <i class="pi pi-exclamation-triangle confirm-icon"></i>
        <div>
          <p class="confirm-msg">Hapus panduan untuk <b class="font-mono">{{ formatCode(confirmDlg.row?.KDCAB) }}</b> ({{ confirmDlg.row?.NAMACAB || '—' }})?</p>
          <p class="confirm-sub">Data yang dihapus tidak bisa dikembalikan.</p>
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" :disabled="deleting" @click="confirmDlg.visible = false" />
        <Button label="Hapus" icon="pi pi-trash" class="p-button-danger" :loading="deleting" @click="doDelete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Tag from 'primevue/tag';

const formatCode = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^[#\s]+/, '').trim();
};
import Textarea from 'primevue/textarea';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Paginator from 'primevue/paginator';
import PanduanCard from '@/views/prepClosingServer/components/PanduanCard.vue';
import * as api from '@/services/panduan.service.js';

const toast = useToast();
const rows = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const dlgVisible = ref(false);
const isEdit = ref(false);
const confirmDlg = reactive({ visible: false, row: null });
const showPwd = reactive({ bulanan: false, db: false, tampung: false, vnc: false });
const detailPanel = ref(null);

// ── Pencarian & filter ──────────────────────────────────────────────
const search = ref('');
const osFilter = ref(null);
const remoteFilter = ref(null);
const onlyIncomplete = ref(false);

// ── Pagination ──────────────────────────────────────────────────────
const pageFirst = ref(0);
const pageRows = ref(10);

// ── Selection (master-detail) ───────────────────────────────────────
const selectedKdcab = ref(null);
const activeTab = ref('identitas');
const kdcabInvalid = ref(false);

const form = reactive({
  kdcab: '', namacab: '', os: 'WINDOWS',
  ip_bulanan: '', user_bulanan: '', pass_bulanan: '', port_bulanan: '', remote_bulanan: '',
  db_user: '', db_pass: '', db_port: '', hdd_check: '',
  ip_tampung: '', user_tampung: '', pass_tampung: '', remote_tampung: '', vnc_pass_tampung: '',
  path_tampung: '',
  catatan: '',
});

const COL_MAP = {
  kdcab: 'KDCAB', namacab: 'NAMACAB', os: 'OS',
  ip_bulanan: 'IP_BULANAN', user_bulanan: 'USER_BULANAN', pass_bulanan: 'PASS_BULANAN', port_bulanan: 'PORT_BULANAN', remote_bulanan: 'REMOTE_BULANAN',
  db_user: 'DB_USER', db_pass: 'DB_PASS', db_port: 'DB_PORT', hdd_check: 'HDD_CHECK',
  ip_tampung: 'IP_TAMPUNG', user_tampung: 'USER_TAMPUNG', pass_tampung: 'PASS_TAMPUNG', remote_tampung: 'REMOTE_TAMPUNG', vnc_pass_tampung: 'VNC_PASS_TAMPUNG',
  path_tampung: 'PATH_TAMPUNG',
  catatan: 'CATATAN',
};

// Field inti yang menentukan status "lengkap"
const REQUIRED_FIELDS = [
  ['IP_BULANAN', 'IP Bulanan'],
  ['REMOTE_BULANAN', 'Remote Bulanan'],
  ['DB_USER', 'DB User'],
  ['IP_TAMPUNG', 'IP Tampung'],
];

function missingFields(row) {
  if (!row) return [];
  return REQUIRED_FIELDS.filter(([f]) => !String(row[f] ?? '').trim()).map(([, label]) => label);
}

function methodSeverity(method = '') {
  const m = String(method).toLowerCase();
  if (m.includes('ssh')) return 'contrast';
  if (m.includes('vnc')) return 'warn';
  if (m.includes('rdp')) return 'info';
  return 'secondary';
}

function rowRemotes(row) {
  return [row.REMOTE_BULANAN, row.REMOTE_TAMPUNG].filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}

// ── Statistik ───────────────────────────────────────────────────────
const completeCount = computed(() => rows.value.filter(r => missingFields(r).length === 0).length);
const incompleteCount = computed(() => rows.value.length - completeCount.value);
const incompleteRowsHint = computed(() => {
  if (incompleteCount.value === 0) return 'Semua data sudah lengkap';
  return onlyIncomplete.value
    ? 'Klik untuk menampilkan semua cabang'
    : `Klik untuk menyaring ${incompleteCount.value} cabang yang belum lengkap`;
});

// ── Filter & pencarian ──────────────────────────────────────────────
const osOptions = computed(() =>
  [...new Set(rows.value.map(r => r.OS).filter(Boolean))].sort());

const remoteOptions = computed(() =>
  [...new Set(rows.value.flatMap(r => [r.REMOTE_BULANAN, r.REMOTE_TAMPUNG]).filter(Boolean))].sort());

const hasFilter = computed(() =>
  !!(search.value.trim() || osFilter.value || remoteFilter.value || onlyIncomplete.value));

const filteredRows = computed(() => {
  let list = rows.value;
  if (onlyIncomplete.value) list = list.filter(r => missingFields(r).length > 0);
  if (osFilter.value) list = list.filter(r => (r.OS || '') === osFilter.value);
  if (remoteFilter.value) {
    list = list.filter(r => r.REMOTE_BULANAN === remoteFilter.value || r.REMOTE_TAMPUNG === remoteFilter.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(r =>
      [r.KDCAB, r.NAMACAB, r.IP_BULANAN, r.IP_TAMPUNG]
        .some(v => String(v ?? '').toLowerCase().includes(q)));
  }
  return list;
});

const pagedRows = computed(() =>
  filteredRows.value.slice(pageFirst.value, pageFirst.value + pageRows.value));

const pageStart = computed(() => filteredRows.value.length ? pageFirst.value + 1 : 0);
const pageEnd = computed(() => Math.min(pageFirst.value + pageRows.value, filteredRows.value.length));

const selected = computed(() =>
  rows.value.find(r => r.KDCAB === selectedKdcab.value) || null);

function resetFilters() {
  search.value = '';
  osFilter.value = null;
  remoteFilter.value = null;
  onlyIncomplete.value = false;
}

function onPage(e) {
  pageFirst.value = e.first;
  pageRows.value = e.rows;
}

// Seleksi selalu valid terhadap hasil filter yang sedang aktif
function normalizeSelection() {
  const list = filteredRows.value;
  if (pageFirst.value >= list.length) pageFirst.value = 0;
  if (!list.length) {
    selectedKdcab.value = null;
    return;
  }
  if (!list.some(r => r.KDCAB === selectedKdcab.value)) {
    selectedKdcab.value = list[0].KDCAB;
  }
}

watch([search, osFilter, remoteFilter, onlyIncomplete], () => {
  pageFirst.value = 0;
  normalizeSelection();
});

watch(filteredRows, () => normalizeSelection());

// ── Data ────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true;
  try {
    const data = await api.getPanduan();
    rows.value = [...(data || [])].sort((a, b) =>
      String(a.KDCAB ?? '').localeCompare(String(b.KDCAB ?? '')));
    normalizeSelection();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  Object.keys(form).forEach(k => { form[k] = ''; });
  form.os = 'WINDOWS';
  Object.keys(showPwd).forEach(k => { showPwd[k] = false; });
  kdcabInvalid.value = false;
}

function fillFromRow(row) {
  resetForm();
  Object.entries(COL_MAP).forEach(([k, c]) => { form[k] = row[c] ?? ''; });
}

function openCreate() {
  isEdit.value = false;
  resetForm();
  activeTab.value = 'identitas';
  dlgVisible.value = true;
}

function openEdit(row) {
  isEdit.value = true;
  fillFromRow(row);
  activeTab.value = 'identitas';
  dlgVisible.value = true;
}

function togglePwd(section) { showPwd[section] = !showPwd[section]; }

// ── Tab indicator ───────────────────────────────────────────────────
const TAB_FIELDS = {
  identitas: ['kdcab', 'namacab'],
  bulanan: ['ip_bulanan', 'user_bulanan', 'pass_bulanan', 'port_bulanan', 'remote_bulanan'],
  db: ['db_user', 'db_pass', 'db_port', 'hdd_check'],
  tampung: ['ip_tampung', 'user_tampung', 'pass_tampung', 'remote_tampung', 'vnc_pass_tampung', 'path_tampung'],
  catatan: ['catatan'],
};

function tabHasData(tab) {
  return (TAB_FIELDS[tab] || []).some(k => String(form[k] ?? '').trim() !== '');
}

// ── Simpan ──────────────────────────────────────────────────────────
function toBody() {
  const body = {};
  Object.entries(COL_MAP).forEach(([k, c]) => { body[c] = (form[k] ?? '').trim(); });
  return body;
}

async function save() {
  if (!form.kdcab.trim()) {
    kdcabInvalid.value = true;
    activeTab.value = 'identitas';
    toast.add({ severity: 'warn', summary: 'Validasi', detail: 'KDCAB wajib diisi', life: 3000 });
    return;
  }
  saving.value = true;
  try {
    const body = toBody();
    if (isEdit.value) await api.updatePanduan(form.kdcab, body);
    else await api.createPanduan(body);
    dlgVisible.value = false;
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Panduan tersimpan', life: 3000 });

    // Pastikan panduan yang baru tersimpan terlihat & terpilih
    if (!filteredRows.value.some(r => r.KDCAB === body.KDCAB)) resetFilters();
    await loadData();
    selectedKdcab.value = body.KDCAB;
    const idx = filteredRows.value.findIndex(r => r.KDCAB === body.KDCAB);
    if (idx >= 0) pageFirst.value = Math.floor(idx / pageRows.value) * pageRows.value;
    normalizeSelection();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally {
    saving.value = false;
  }
}

// ── Hapus ───────────────────────────────────────────────────────────
function askDelete(row) { confirmDlg.row = row; confirmDlg.visible = true; }

async function doDelete() {
  deleting.value = true;
  try {
    await api.deletePanduan(confirmDlg.row.KDCAB);
    confirmDlg.visible = false;
    selectedKdcab.value = null;
    toast.add({ severity: 'success', summary: 'Dihapus', detail: 'Panduan dihapus', life: 3000 });
    await loadData();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally {
    deleting.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
/* ── View Container ───────────────────────────────────────────────── */
.panduan-ceklist-view {
  padding: 1rem 1.25rem;
  background-color: var(--surface-ground, #f8fafc);
  min-height: calc(100vh - 65px);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-sizing: border-box;
}

.content-container {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

/* ── 1. Compact Header ────────────────────────────────────────────── */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: var(--surface-card, #ffffff);
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  border: 1px solid var(--surface-border, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #ffffff;
  font-size: 1.25rem;
  box-shadow: 0 2px 6px rgba(14, 165, 233, 0.25);
  flex-shrink: 0;
}

.header-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-color, #0f172a);
  margin: 0;
  line-height: 1.2;
}

.header-subtitle {
  font-size: 0.8rem;
  color: var(--text-color-secondary, #64748b);
  margin: 0.15rem 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn-header {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.42rem 0.85rem;
}

/* ── Statistik Chips ──────────────────────────────────────────────── */
.stat-chips-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--surface-border, #e2e8f0);
  background: var(--surface-card, #ffffff);
  font-size: 0.785rem;
  color: var(--text-color, #334155);
  cursor: default;
}

button.stat-chip {
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

button.stat-chip:disabled {
  opacity: 0.55;
  cursor: default;
}

.chip-icon {
  color: var(--primary-color, #0284c7);
  font-size: 0.85rem;
}

.chip-count {
  font-weight: 700;
  font-size: 0.85rem;
}

.chip-label {
  color: var(--text-color-secondary, #64748b);
  font-size: 0.75rem;
}

.chip-ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.chip-ok .chip-icon {
  color: #16a34a;
}

.chip-ok .chip-count {
  color: #15803d;
}

.chip-warn {
  background: #fffbeb;
  border-color: #fde68a;
}

.chip-warn .chip-icon {
  color: #d97706;
}

.chip-warn .chip-count {
  color: #b45309;
}

.chip-warn.chip-active {
  background: rgba(245, 158, 11, 0.2);
  border-color: #f59e0b;
}

.chip-warn.chip-active .chip-label {
  color: #92400e;
  font-weight: 600;
}

.chip-filter-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  background: var(--warning-color, #f59e0b);
  color: #fff;
  border-radius: 4px;
  padding: 1px 5px;
}

/* ── 2. Toolbar Panel ─────────────────────────────────────────────── */
.toolbar-panel {
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 10px;
  padding: 0.65rem 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.search-field {
  flex: 1;
  max-width: 320px;
  min-width: 180px;
}

.search-field :deep(.p-inputtext) {
  width: 100%;
  padding: 0.42rem 0.75rem 0.42rem 2.2rem;
  font-size: 0.825rem;
}

.filter-dd {
  min-width: 140px;
}

:deep(.filter-dd .p-inputtext) {
  padding: 0.42rem 0.75rem;
  font-size: 0.825rem;
}

.btn-reset {
  font-size: 0.785rem;
  padding: 0.42rem 0.65rem;
}

/* ── Panel master + detail ────────────────────────────────────────── */
.md-grid {
  display: grid;
  grid-template-columns: minmax(270px, 350px) minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}
.panel {
  display: flex;
  flex-direction: column;
  background: var(--surface-card, #fff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  min-width: 0;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--surface-border, #e2e8f0);
  background: var(--surface-50, #f8f9fa);
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.85rem;
  font-weight: 600;
}
.panel-count {
  font-size: 0.78rem;
  color: var(--text-color-secondary);
  background: var(--surface-ground, #eef1f6);
  border-radius: 10px;
  padding: 2px 8px;
}

/* Master list */
.master-list {
  flex: 1;
  overflow-y: auto;
  max-height: min(62vh, 640px);
  min-height: 220px;
}
.master-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--surface-border, #eef1f6);
  border-left: 3px solid transparent;
  padding: 10px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}
.master-item:hover { background: var(--surface-50, #f8f9fa); }
.master-item.active {
  background: rgba(79, 70, 229, 0.08);
  border-left-color: var(--primary-color, #4f46e5);
}
.mi-top {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
}
.mi-code {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--primary-color, #4f46e5);
}
.mi-name {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mi-warn {
  color: var(--warning-color, #f59e0b);
  font-size: 0.78rem;
  flex-shrink: 0;
}
.mi-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 5px;
}
.mi-tags :deep(.p-tag) { font-size: 0.68rem; }
.mi-ip code {
  font-family: 'Consolas', monospace;
  font-size: 0.75rem;
  background: #d4edda;
  border: 1px solid #a9dcb8;
  color: #155724;
  border-radius: 4px;
  padding: 1px 6px;
}

/* Skeleton */
.skeleton-item {
  padding: 12px 14px;
  border-bottom: 1px solid var(--surface-border, #eef1f6);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.sk-bar {
  display: block;
  height: 11px;
  border-radius: 6px;
  background: linear-gradient(90deg, #eef1f6 25%, #e2e8f0 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s infinite;
}
.sk-w40 { width: 40%; }
.sk-w70 { width: 70%; }
@keyframes sk-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty state list */
.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 16px;
  color: var(--text-color-secondary);
  font-size: 0.87rem;
  text-align: center;
}
.list-empty i.pi { font-size: 1.6rem; opacity: 0.6; }

/* Footer list (pagination) */
.master-foot {
  border-top: 1px solid var(--surface-border, #e2e8f0);
  padding: 6px 10px 8px;
  background: var(--surface-50, #f8f9fa);
}
.page-info {
  font-size: 0.74rem;
  color: var(--text-color-secondary);
  text-align: center;
  margin-bottom: 4px;
}
.master-foot :deep(.p-paginator) {
  background: transparent;
  border: none;
  padding: 0;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
}

/* Detail panel */
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border, #e2e8f0);
  background: var(--surface-50, #f8f9fa);
}
.dh-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  flex-wrap: wrap;
}
.dh-title b { color: var(--primary-color, #4f46e5); }
.dh-name { color: var(--text-color); }
.dh-sub { margin-top: 3px; font-size: 0.78rem; }
.dh-complete { color: var(--success-color, #10b981); }
.dh-incomplete { color: var(--warning-color, #f59e0b); }
.dh-sub i { margin-right: 3px; }
.dh-actions { display: flex; gap: 6px; flex-shrink: 0; }

.detail-body {
  flex: 1;
  overflow-y: auto;
  max-height: min(62vh, 640px);
  padding: 12px 16px;
}
/* Rapikan kartu agar tidak "kartu dalam kartu" */
.detail-body :deep(.panduan-card) {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
}

.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 240px;
  max-height: min(62vh, 640px);
  padding: 24px;
  color: var(--text-color-secondary);
  font-size: 0.88rem;
  text-align: center;
}
.detail-empty-icon { font-size: 1.4rem; opacity: 0.5; }

/* ── Dialog form bertab ───────────────────────────────────────────── */
:deep(.panduan-dialog .p-dialog-content) {
  max-height: 72vh;
  overflow-y: auto;
  padding: 1.1rem 1.25rem;
}
.panduan-tabs { width: 100%; }
.tab-check {
  font-size: 0.66rem;
  color: var(--success-color, #10b981);
  margin-left: 4px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  padding-top: 6px;
}
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field-full { grid-column: 1 / -1; }
.form-field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}
.req { color: #dc2626; }
.field-hint { font-size: 0.74rem; color: var(--text-color-secondary); }
.p-error { font-size: 0.75rem; }
.pwd-field { position: relative; }
.pwd-eye {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
}
.pwd-eye:hover { color: var(--primary-color, #4f46e5); }

:deep(.panduan-dialog .p-dialog-footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.dialog-footer-hint {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}
.dialog-footer-actions { display: flex; gap: 6px; margin-left: auto; }

/* ── Confirm dialog ───────────────────────────────────────────────── */
.confirm-body { display: flex; align-items: flex-start; gap: 12px; }
.confirm-icon { color: #f59e0b; font-size: 1.5rem; margin-top: 2px; }
.confirm-msg { margin: 0 0 4px 0; }
.confirm-sub { margin: 0; font-size: 0.8rem; color: var(--text-color-secondary); }

/* ── Responsive ───────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .md-grid { grid-template-columns: 1fr; }
  .master-list { max-height: 45vh; }
  .detail-body,
  .detail-empty { max-height: none; }
  .detail-empty { min-height: 160px; }
}

@media (max-width: 640px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-actions { justify-content: flex-end; }
  .search-field { max-width: none; }
  .filter-dd { flex: 1; min-width: 120px; }
  .dh-actions { width: 100%; justify-content: flex-end; }
}
</style>
