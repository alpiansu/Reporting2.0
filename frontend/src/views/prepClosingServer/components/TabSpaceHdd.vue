<template>
  <div class="tab-content">
    <!-- Streamlined 1-Row Toolbar -->
    <div class="tab-toolbar">
      <div class="toolbar-left">
        <Button icon="pi pi-bolt" label="Init Semua" class="p-button-warning p-button-sm"
          :loading="initLoading" :disabled="!periode" @click="handleInit"
          v-tooltip.top="'Generate skeleton record & otomatis cek sisa storage SSH server Linux'" />
        <Button icon="pi pi-server" label="Cek SSH Linux" class="p-button-help p-button-sm"
          :loading="batchLoading" :disabled="!periode || loading" @click="handleBatchSsh"
          v-tooltip.top="'Cek sisa storage via SSH otomatis untuk semua cabang Linux'" />
        <Button icon="pi pi-plus" label="Tambah" class="p-button-primary p-button-sm"
          :disabled="!periode" @click="openDialog(null)" />
      </div>

      <div class="toolbar-right">
        <!-- Compact Status Filter Pills -->
        <div class="compact-pills">
          <button
            type="button"
            class="mini-pill"
            :class="{ active: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
            v-tooltip.top="'Semua cabang'"
          >
            Semua <span class="mini-badge">{{ totalCount }}</span>
          </button>
          <button
            type="button"
            class="mini-pill pill-danger"
            :class="{ active: statusFilter === 'critical' }"
            @click="statusFilter = 'critical'"
            v-tooltip.top="'Kritis: Free space < 10 GB'"
          >
            Kritis <span class="mini-badge badge-danger">{{ criticalCount }}</span>
          </button>
          <button
            type="button"
            class="mini-pill pill-warn"
            :class="{ active: statusFilter === 'warning' }"
            @click="statusFilter = 'warning'"
            v-tooltip.top="'Warning: Free space 10 - 30 GB'"
          >
            Warning <span class="mini-badge badge-warn">{{ warningCount }}</span>
          </button>
          <button
            type="button"
            class="mini-pill pill-success"
            :class="{ active: statusFilter === 'ok' }"
            @click="statusFilter = 'ok'"
            v-tooltip.top="'Aman: Free space >= 30 GB'"
          >
            Aman <span class="mini-badge badge-success">{{ okCount }}</span>
          </button>
        </div>

        <!-- Live Search -->
        <IconField iconPosition="left" class="search-field">
          <InputIcon class="pi pi-search" />
          <InputText v-model="searchQuery" placeholder="Cari cabang/IP..." class="p-inputtext-sm search-input" />
        </IconField>
      </div>
    </div>

    <DataTable :value="filteredRows" :loading="loading" class="ceklist-table" stripedRows
      responsiveLayout="scroll" :rowClass="rowClass">
      <template #empty>
        <div class="table-empty">
          <i class="pi pi-search-minus" v-if="searchQuery || statusFilter !== 'all'"></i>
          <i class="pi pi-inbox" v-else></i>
          <span v-if="searchQuery || statusFilter !== 'all'">
            Tidak ada data yang sesuai filter/pencarian.
            <Button label="Reset Filter" class="p-button-link p-button-sm p-0 ml-1" @click="resetFilters" />
          </span>
          <span v-else>Belum ada data untuk periode ini</span>
        </div>
      </template>

      <Column header="Cabang" sortable sortField="KDCAB" style="width:125px">
        <template #body="{ data }">
          <div class="cabang-cell">
            <span class="cabang-code font-mono">{{ formatCode(data.KDCAB) }}</span>
            <span class="cabang-name">{{ getCabangName(data.KDCAB) }}</span>
          </div>
        </template>
      </Column>
      <Column field="IP" header="IP Address" sortable style="width:125px">
        <template #body="{ data }">
          <span class="font-mono text-sm">{{ data.IP || '—' }}</span>
        </template>
      </Column>
      <Column field="freeSpaceGb" header="Free Space" sortable style="width:110px">
        <template #body="{ data }">
          <span :class="['space-badge', spaceClass(data.freeSpaceGb)]">
            <i :class="spaceIcon(data.freeSpaceGb)" class="mr-1"></i>
            {{ data.FREE_SPACE || '—' }}
          </span>
        </template>
      </Column>
      <Column field="freeSpaceLastMonthGb" header="Bulan Lalu" sortable style="width:105px">
        <template #body="{ data }">
          <span v-if="data.freeSpaceLastMonthGb !== null && data.freeSpaceLastMonthGb !== undefined" class="font-mono text-sm">
            {{ data.freeSpaceLastMonthGb?.toFixed(1) }} GB
          </span>
          <span v-else class="text-color-secondary text-sm">—</span>
        </template>
      </Column>
      <Column field="usageDiskSpace" header="Usage Disk" sortable style="width:115px">
        <template #body="{ data }">
          <span v-if="data.usageDiskSpace !== null && data.usageDiskSpace !== undefined"
            :class="['usage-badge', data.usageDiskSpace < 0 ? 'usage-neg' : 'usage-pos']">
            <i :class="data.usageDiskSpace < 0 ? 'pi pi-arrow-down' : 'pi pi-arrow-up'" class="mr-1 text-xs"></i>
            {{ data.usageDiskSpace >= 0 ? '+' : '' }}{{ data.usageDiskSpace?.toFixed(1) }} GB
          </span>
          <span v-else class="text-color-secondary text-sm">—</span>
        </template>
      </Column>
      <Column field="predictedUsage" header="Prediksi Bln Depan" sortable style="width:130px">
        <template #body="{ data }">
          <div v-if="data.predictedUsage !== null && data.predictedUsage !== undefined" class="flex align-items-center gap-1">
            <span :class="['space-badge', spaceClass(data.predictedUsage)]">
              {{ data.predictedUsage?.toFixed(1) }} GB
            </span>
            <Tag v-if="data.predictedUsage < 10" value="Kritis" severity="danger" class="text-xs" />
          </div>
          <span v-else class="text-color-secondary text-sm">—</span>
        </template>
      </Column>
      <Column field="TGL_CHECK" header="Tgl Check" sortable style="width:105px">
        <template #body="{ data }">
          <span class="text-sm font-mono">{{ formatDateShort(data.TGL_CHECK) }}</span>
        </template>
      </Column>
      <Column field="OS" header="OS" sortable style="width:90px">
        <template #body="{ data }">
          <Tag :value="data.OS || '—'" :severity="data.OS === 'WINDOWS' ? 'info' : 'warning'" />
        </template>
      </Column>
      <Column field="FU" header="Follow Up" style="min-width:140px">
        <template #body="{ data }">
          <span class="fu-text">{{ data.FU || '—' }}</span>
        </template>
      </Column>
      <Column field="FREE_AFTER" header="Free After FU" style="width:105px">
        <template #body="{ data }">{{ data.FREE_AFTER || '—' }}</template>
      </Column>
      <Column header="Capture" style="width:80px">
        <template #body="{ data }">
          <img v-if="data.CAPTURE_PATH" :src="api.getAssetUrl(data.CAPTURE_PATH)" alt="capture"
            class="capture-thumb-mini"
            @click="openPreview(api.getAssetUrl(data.CAPTURE_PATH))" />
          <i v-else class="pi pi-image text-color-secondary opacity-40 text-lg" />
        </template>
      </Column>
      <Column header="Aksi" style="width:120px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button v-if="isLinux(data)" icon="pi pi-server" class="p-button-text p-button-sm p-button-success"
              :loading="checkingKdcab === data.KDCAB"
              v-tooltip.top="'Cek Storage SSH (Buka Opsi / Eksekusi)'" @click="openSshDialog(data)" />
            <Button v-else icon="pi pi-server" class="p-button-text p-button-sm p-button-secondary opacity-40 cursor-not-allowed"
              disabled v-tooltip.top="'Khusus server Linux (Windows cek manual)'" />
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-info"
              v-tooltip.top="'Edit'" @click="openDialog(data)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
              v-tooltip.top="'Hapus'" @click="$emit('delete', data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Upsert Dialog -->
    <Dialog v-model:visible="dlgVisible" :header="isEdit ? 'Edit Space HDD' : 'Tambah Space HDD'"
      modal class="ceklist-dialog" :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="form-field">
          <label>KDCAB <span class="req">*</span></label>
          <Dropdown v-model="form.kdcab" :options="kdcabOptions" optionLabel="label" optionValue="kdcab"
            placeholder="Pilih Kode Cabang" class="w-full" :disabled="isEdit" filter
            :showClear="!isEdit" @change="onKdcabChange" />
        </div>
        <div class="form-field">
          <label>IP Address <span class="req">*</span></label>
          <InputText v-model="form.ip" placeholder="192.168.1.1" class="w-full" />
        </div>
        <div class="form-field">
          <label>Free Space</label>
          <InputText v-model="form.freeSpace" placeholder="37.1 GB" class="w-full" />
        </div>
        <div class="form-field">
          <label>OS</label>
          <Dropdown v-model="form.os" :options="['WINDOWS','LINUX']" placeholder="Pilih OS" class="w-full" />
        </div>
        <div class="form-field">
          <label>Tgl Check</label>
          <Calendar v-model="form.tglCheck" dateFormat="yy-mm-dd" class="w-full" showIcon />
        </div>
        <div class="form-field form-field-full">
          <label>Follow Up (FU)</label>
          <Textarea v-model="form.fu" rows="2" class="w-full" placeholder="Tindakan..." />
        </div>
        <div class="form-field form-field-full">
          <label>Free After FU</label>
          <InputText v-model="form.freeAfter" placeholder="120 GB" class="w-full" />
        </div>

        <!-- Info Panduan (auto-fill dari guide) -->
        <div class="form-field form-field-full" v-if="form.kdcab && panduan[form.kdcab]">
          <label>Panduan Cabang <span style="color:var(--text-color-secondary);font-weight:400;font-size:0.8rem">(dari JUKLAK)</span></label>
          <PanduanCard :panduan="panduan[form.kdcab]" />
        </div>

        <!-- ─── Compact Capture Upload ─── -->
        <div class="form-field form-field-full capture-section">
          <div class="flex align-items-center justify-content-between mb-2">
            <label class="m-0 font-medium">Capture <span style="color:var(--text-color-secondary);font-weight:400;font-size:0.8rem">(opsional)</span></label>
            <span class="paste-badge-small"><i class="pi pi-copy mr-1"></i>Bisa <strong>Ctrl + V</strong> screenshot di sini</span>
          </div>
          <div
            class="capture-upload-row"
            :class="{ 'drag-over': isDragging }"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <div class="capture-preview-box">
              <img v-if="uploadPreview || capturePath" :src="uploadPreview || api.getAssetUrl(capturePath)" alt="capture"
                style="max-width:120px;max-height:80px;width:auto;height:auto;object-fit:contain;border-radius:4px"
                @click="openPreview(uploadPreview || api.getAssetUrl(capturePath))" class="cursor-pointer" />
              <i v-else class="pi pi-image" style="font-size:2rem;color:var(--text-color-secondary)" />
            </div>
            <div class="capture-upload-actions">
              <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
              <div class="flex gap-2 flex-wrap">
                <Button :label="uploadPreview || capturePath ? 'Ganti File' : 'Pilih File'" icon="pi pi-folder-open"
                  class="p-button-outlined p-button-sm" @click="fileInput.click()" />
                <Button label="Paste Clipboard" icon="pi pi-clipboard"
                  class="p-button-outlined p-button-secondary p-button-sm" @click="pasteFromClipboard"
                  v-tooltip.top="'Paste screenshot dari clipboard OS'" />
              </div>
              <div v-if="captureFile" class="capture-file-info">
                <span class="capture-filename"><i class="pi pi-paperclip mr-1"></i>{{ captureFile.name }}</span>
                <Button label="Upload Gambar" icon="pi pi-upload" class="p-button-success p-button-sm mt-1"
                  :loading="uploading" @click="doUpload" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="dlgVisible = false" />
        <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :loading="saving" @click="save" />
      </template>
    </Dialog>

    <!-- Image Preview Dialog -->
    <ImagePreviewDialog v-model:visible="previewVisible" :src="previewSrc" title="Capture" />

    <!-- SSH Dynamic Check Dialog -->
    <Dialog v-model:visible="sshDlgVisible"
      :header="`Cek Storage SSH: ${formatCode(sshTarget.kdcab)} - ${panduan[sshTarget.kdcab]?.NAMACAB || ''}`"
      modal class="ceklist-dialog" :style="{ width: '560px' }">
      <div class="ssh-dialog-content">
        <!-- Server Details Summary -->
        <div class="ssh-server-summary mb-3 p-3 surface-50 border-round">
          <div class="grid text-sm">
            <div class="col-6"><strong>IP Server:</strong> <code>{{ sshTarget.ip || '—' }}</code></div>
            <div class="col-6"><strong>User:</strong> <code>{{ sshTarget.user || 'root' }}</code></div>
            <div class="col-12 mt-1" v-if="sshTarget.hddCheck">
              <strong>Panduan:</strong> <span class="text-color-secondary">{{ sshTarget.hddCheck }}</span>
            </div>
          </div>
        </div>

        <!-- Target Mount Path configuration -->
        <div class="form-field mb-3">
          <label class="block font-medium mb-1">
            Target Mount Path / Partisi
            <span class="text-color-secondary font-normal text-xs">(Dapat diubah dinamis)</span>
          </label>
          <div class="flex gap-2">
            <InputText v-model="sshTarget.path" placeholder="Default / auto-detect (cth: /home atau /)" class="flex-1" />
            <Button icon="pi pi-search" label="Deteksi Mount" class="p-button-outlined p-button-secondary p-button-sm"
              :loading="detectingMounts" @click="handleDetectMounts" v-tooltip.top="'Ambil daftar mount point langsung dari server via SSH'" />
          </div>
          <small class="text-color-secondary block mt-1">
            Bila dikosongkan, sistem otomatis menggunakan target dari panduan atau partisi utama (/home / /).
          </small>
        </div>

        <!-- Detected Mounts Selection -->
        <div v-if="detectedMounts.length > 0" class="detected-mounts mb-3">
          <label class="block font-medium text-xs mb-1 text-color-secondary">Pilih Mount Point yang Terdeteksi:</label>
          <div class="flex flex-wrap gap-2">
            <span v-for="m in detectedMounts" :key="m.mounted"
              class="mount-chip cursor-pointer"
              :class="{ 'mount-chip-active': sshTarget.path === m.mounted }"
              @click="sshTarget.path = m.mounted">
              <i class="pi pi-folder mr-1"></i>
              <strong>{{ m.mounted }}</strong>
              <span class="ml-1 text-xs text-color-secondary">({{ (m.available / 1024).toFixed(1) }} GB free)</span>
            </span>
          </div>
        </div>

        <!-- Check Result Box -->
        <div v-if="sshCheckResult" class="ssh-result-card p-3 border-round mb-2"
          :class="sshCheckResult.success ? 'bg-green-50 border-1 border-green-200' : 'bg-red-50 border-1 border-red-200'">
          <div class="flex align-items-center mb-2">
            <i :class="sshCheckResult.success ? 'pi pi-check-circle text-green-600' : 'pi pi-times-circle text-red-600'" class="mr-2 text-lg"></i>
            <strong :class="sshCheckResult.success ? 'text-green-800' : 'text-red-800'">
              {{ sshCheckResult.success ? 'Hasil Pengecekan Berhasil Disimpan ke Database' : 'Gagal Mengecek Storage' }}
            </strong>
          </div>
          <div v-if="sshCheckResult.success" class="text-sm">
            <div><strong>Free Space:</strong> <span class="font-bold text-green-700 font-mono">{{ sshCheckResult.freeSpace }}</span></div>
            <div><strong>Target Path:</strong> <code>{{ sshCheckResult.targetPath }}</code> (Mount: <code>{{ sshCheckResult.matchedMount }}</code>)</div>
            <div v-if="sshCheckResult.details" class="text-xs text-color-secondary mt-1">
              Total: {{ (sshCheckResult.details.sizeMb / 1024).toFixed(1) }} GB |
              Terpakai: {{ (sshCheckResult.details.usedMb / 1024).toFixed(1) }} GB ({{ sshCheckResult.details.usePercent }}) |
              Filesystem: {{ sshCheckResult.details.filesystem }}
            </div>
          </div>
          <div v-else class="text-sm text-red-700">
            {{ sshCheckResult.error }}
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="sshDlgVisible = false" />
        <Button label="Cek Sekarang & Simpan" icon="pi pi-server" class="p-button-success"
          :loading="sshChecking" @click="executeSingleSsh" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import ImagePreviewDialog from '@/components/common/ImagePreviewDialog.vue';
import PanduanCard from './PanduanCard.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import * as api from '@/services/ceklistPrepClosing.service.js';
import { useImageClipboardPaste } from '../composables/useImageClipboardPaste.js';

const props = defineProps({
  rows:      { type: Array, default: () => [] },
  loading:   { type: Boolean, default: false },
  periode:   { type: String, default: '' },
  panduan:   { type: Object, default: () => ({}) },
  cabangs:   { type: Array,  default: () => [] },
  onRefresh: { type: Function, default: null },
});
const emit = defineEmits(['delete', 'refresh']);

const toast = useToast();
const saving = ref(false);
const initLoading = ref(false);
const dlgVisible = ref(false);
const isEdit = ref(false);
const uploading = ref(false);
const captureFile = ref(null);
const capturePath = ref(null);
const fileInput = ref(null);
const previewVisible = ref(false);
const previewSrc = ref('');
const form = reactive({ kdcab: '', ip: '', freeSpace: '', os: 'WINDOWS', tglCheck: null, fu: '', freeAfter: '' });

// ─── Filter & Live Search State ──────────────────────────────────────────────
const searchQuery = ref('');
const statusFilter = ref('all'); // 'all' | 'critical' | 'warning' | 'ok' | 'linux' | 'windows'

function getCabangName(kdcab) {
  const code = formatCode(kdcab);
  if (props.panduan?.[code]?.NAMACAB) return props.panduan[code].NAMACAB;
  const found = props.cabangs?.find(c => formatCode(c.kdcab) === code);
  return found?.namacab || '';
}

const totalCount = computed(() => props.rows?.length || 0);
const criticalCount = computed(() => props.rows?.filter(r => r.freeSpaceGb !== null && r.freeSpaceGb !== undefined && r.freeSpaceGb < 10).length || 0);
const warningCount = computed(() => props.rows?.filter(r => r.freeSpaceGb !== null && r.freeSpaceGb !== undefined && r.freeSpaceGb >= 10 && r.freeSpaceGb < 30).length || 0);
const okCount = computed(() => props.rows?.filter(r => r.freeSpaceGb !== null && r.freeSpaceGb !== undefined && r.freeSpaceGb >= 30).length || 0);
const linuxCount = computed(() => props.rows?.filter(r => isLinux(r)).length || 0);
const windowsCount = computed(() => props.rows?.filter(r => !isLinux(r)).length || 0);

const filteredRows = computed(() => {
  let list = props.rows || [];

  if (statusFilter.value === 'critical') {
    list = list.filter(r => r.freeSpaceGb !== null && r.freeSpaceGb !== undefined && r.freeSpaceGb < 10);
  } else if (statusFilter.value === 'warning') {
    list = list.filter(r => r.freeSpaceGb !== null && r.freeSpaceGb !== undefined && r.freeSpaceGb >= 10 && r.freeSpaceGb < 30);
  } else if (statusFilter.value === 'ok') {
    list = list.filter(r => r.freeSpaceGb !== null && r.freeSpaceGb !== undefined && r.freeSpaceGb >= 30);
  } else if (statusFilter.value === 'linux') {
    list = list.filter(r => isLinux(r));
  } else if (statusFilter.value === 'windows') {
    list = list.filter(r => !isLinux(r));
  }

  const q = searchQuery.value?.trim().toLowerCase();
  if (q) {
    list = list.filter(r => {
      const code = formatCode(r.KDCAB).toLowerCase();
      const name = getCabangName(r.KDCAB).toLowerCase();
      const ip = (r.IP || '').toLowerCase();
      const os = (r.OS || '').toLowerCase();
      const fu = (r.FU || '').toLowerCase();
      return code.includes(q) || name.includes(q) || ip.includes(q) || os.includes(q) || fu.includes(q);
    });
  }

  return list;
});

function resetFilters() {
  searchQuery.value = '';
  statusFilter.value = 'all';
}

function spaceIcon(gb) {
  if (gb === null || gb === undefined) return 'pi pi-question-circle';
  if (gb < 10) return 'pi pi-exclamation-circle';
  if (gb < 30) return 'pi pi-exclamation-triangle';
  return 'pi pi-check-circle';
}

function formatDateShort(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const {
  isDragging,
  previewUrl: uploadPreview,
  setFile,
  reset: resetClipboard,
  pasteFromClipboard,
  onDragOver,
  onDragLeave,
  onDrop,
} = useImageClipboardPaste({
  isActive: dlgVisible,
  onImageCaptured: (file) => {
    captureFile.value = file;
  },
  toast,
  filePrefix: 'space-hdd',
});

// ─── SSH Storage Checking State ───────────────────────────────────────────────
const checkingKdcab = ref(null);
const batchLoading = ref(false);
const sshDlgVisible = ref(false);
const sshChecking = ref(false);
const detectingMounts = ref(false);
const detectedMounts = ref([]);
const sshCheckResult = ref(null);

const sshTarget = reactive({
  kdcab: '',
  ip: '',
  user: '',
  hddCheck: '',
  path: '',
});


// Cabang yang sudah punya record pada periode ini → tidak boleh ditambah dua kali
const existingKdcabs = computed(() => new Set(props.rows.map(r => r.KDCAB)));

// Opsi dropdown "Tambah": semua cabang minus yang sudah ada (dedupe);
// saat edit, hanya cabang milik baris itu sendiri.
const kdcabOptions = computed(() =>
  props.cabangs
    .filter(c => (isEdit.value ? c.kdcab === form.kdcab : !existingKdcabs.value.has(c.kdcab)))
    .map(c => ({ ...c, label: `${c.kdcab} - ${c.namacab}` })),
);

// Autofill IP & OS dari panduan saat kode cabang dipilih
function onKdcabChange() {
  const p = props.panduan[form.kdcab];
  if (p) {
    if (p.IP_BULANAN) form.ip = p.IP_BULANAN;
    if (p.OS) form.os = p.OS;
  }
}


function openPreview(url) { previewSrc.value = url; previewVisible.value = true; }

function onFileChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  setFile(f);
}

async function doUpload() {
  if (!captureFile.value || !form.kdcab || !props.periode) {
    toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pilih file, KDCAB, dan periode sebelum upload', life: 3000 });
    return;
  }
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('capture', captureFile.value);
    const res = await api.uploadCaptureHdd(fd, form.kdcab, props.periode);
    capturePath.value = res.captureUrl;
    captureFile.value = null;
    resetClipboard();
    toast.add({ severity: 'success', summary: 'Upload Berhasil', detail: 'Gambar capture disimpan', life: 3000 });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { uploading.value = false; }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function handleInit() {
  if (!props.periode) return;
  initLoading.value = true;
  try {
    const res = await api.initSpaceHdd(props.periode);
    let detailMsg = '';
    if (res.created > 0) {
      detailMsg = `Dibuat ${res.created} record baru dari total ${res.total} cabang.`;
    } else {
      detailMsg = `${res.existing || res.total} cabang sudah terdaftar.`;
    }
    if (res.ssh) {
      if (res.ssh.total > 0) {
        detailMsg += ` SSH Linux: ${res.ssh.successCount} berhasil, ${res.ssh.failedCount} gagal.`;
      } else if (res.ssh.error) {
        detailMsg += ` SSH dilewati (${res.ssh.error}).`;
      }
    }
    toast.add({
      severity: (res.ssh?.failedCount > 0 || res.ssh?.error) ? 'warn' : 'success',
      summary: 'Init Cabang Selesai',
      detail: detailMsg,
      life: 5000,
    });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Gagal Init Cabang',
      detail: e.message || 'Terjadi kesalahan saat inisialisasi cabang.',
      life: 5000,
    });
  } finally { initLoading.value = false; }
}

// ─── Expose open() to parent via event ──────────────────────────────────────
// Parent calls $refs.tabHdd.openDialog(row) OR we use event bridge:
defineExpose({ openDialog });

function openDialog(row = null) {
  isEdit.value = !!row;
  captureFile.value = null;
  resetClipboard();
  capturePath.value = row?.CAPTURE_PATH || null;
  Object.assign(form, {
    kdcab: row?.KDCAB || '', ip: row?.IP || '', freeSpace: row?.FREE_SPACE || '',
    os: row?.OS || 'WINDOWS', tglCheck: row?.TGL_CHECK ? new Date(row.TGL_CHECK) : null,
    fu: row?.FU || '', freeAfter: row?.FREE_AFTER || '',
  });
  dlgVisible.value = true;
}

async function save() {
  if (!form.kdcab || !form.ip) {
    toast.add({ severity: 'warn', summary: 'Validasi', detail: 'KDCAB dan IP wajib diisi', life: 3000 }); return;
  }
  saving.value = true;
  try {
    if (captureFile.value && props.periode) {
      const fd = new FormData();
      fd.append('capture', captureFile.value);
      const res = await api.uploadCaptureHdd(fd, form.kdcab, props.periode);
      capturePath.value = res.captureUrl;
      captureFile.value = null;
      resetClipboard();
    }
    const tgl = form.tglCheck ? formatTgl(form.tglCheck) : null;
    await api.upsertSpaceHdd({
      kdcab: form.kdcab, ip: form.ip, periode: props.periode,
      freeSpace: form.freeSpace || null, os: form.os || null, tglCheck: tgl,
      fu: form.fu || null, freeAfter: form.freeAfter || null,
    });
    dlgVisible.value = false;
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data tersimpan', life: 3000 });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { saving.value = false; }
}

// ─── SSH Storage Methods ──────────────────────────────────────────────────────
function isLinux(data) {
  if (!data) return false;
  const p = props.panduan[data.KDCAB];
  const pOs = String(p?.OS || '').toUpperCase();
  const pRemote = String(p?.REMOTE_BULANAN || '').toUpperCase();
  const dataOs = String(data.OS || '').toUpperCase();
  return dataOs === 'LINUX' || pOs === 'LINUX' || pRemote === 'SSH';
}

function openSshDialog(data) {
  const p = props.panduan[data.KDCAB] || {};
  sshTarget.kdcab = data.KDCAB;
  sshTarget.ip = data.IP || p.IP_BULANAN || '';
  sshTarget.user = p.USER_BULANAN || 'root';
  sshTarget.hddCheck = p.HDD_CHECK || '';

  // Extract default target path from panduan HDD_CHECK if present
  const match = (p.HDD_CHECK || '').match(/(?:df\s+(?:-[a-zA-Z]+\s+)?|partisi\s+)([\/\w\-_]+)/i);
  sshTarget.path = match ? match[1] : '';

  detectedMounts.value = [];
  sshCheckResult.value = null;
  sshDlgVisible.value = true;
}

async function handleDetectMounts() {
  if (!sshTarget.kdcab) return;
  detectingMounts.value = true;
  try {
    const res = await api.listSshMounts(sshTarget.kdcab);
    detectedMounts.value = res.mounts || [];
    if (detectedMounts.value.length === 0) {
      toast.add({ severity: 'warn', summary: 'Deteksi Mount', detail: 'Tidak ada mount point terdeteksi', life: 3000 });
    } else {
      toast.add({ severity: 'info', summary: 'Deteksi Mount', detail: `Ditemukan ${detectedMounts.value.length} mount point di server`, life: 3000 });
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Deteksi Gagal', detail: err.message, life: 4000 });
  } finally {
    detectingMounts.value = false;
  }
}

async function executeSingleSsh() {
  if (!sshTarget.kdcab || !props.periode) return;
  sshChecking.value = true;
  checkingKdcab.value = sshTarget.kdcab;
  try {
    const res = await api.checkSshStorage({
      kdcab: sshTarget.kdcab,
      periode: props.periode,
      targetPath: sshTarget.path?.trim() || undefined,
    });
    sshCheckResult.value = res;
    toast.add({
      severity: 'success',
      summary: 'SSH Berhasil',
      detail: `Free Space: ${res.freeSpace} (${res.targetPath}) tersimpan ke database`,
      life: 4000,
    });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (err) {
    sshCheckResult.value = { success: false, error: err.message };
    toast.add({ severity: 'error', summary: 'SSH Gagal', detail: err.message, life: 5000 });
  } finally {
    sshChecking.value = false;
    checkingKdcab.value = null;
  }
}

async function handleBatchSsh() {
  if (!props.periode) return;
  const proceed = window.confirm(
    `Jalankan pengecekan sisa storage via SSH untuk semua cabang Linux pada periode ${props.periode}?`
  );
  if (!proceed) return;
  batchLoading.value = true;
  try {
    const res = await api.checkBatchSshStorage(props.periode);
    const s = res.summary || { total: 0, success: 0, failed: 0 };
    if (s.failed === 0) {
      toast.add({
        severity: 'success',
        summary: 'Batch SSH Sukses',
        detail: `Semua ${s.success} cabang Linux berhasil dicek dan diupdate ke DB`,
        life: 4000,
      });
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Batch SSH Selesai',
        detail: `${s.success} berhasil, ${s.failed} gagal dari total ${s.total} cabang`,
        life: 5000,
      });
    }
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Batch SSH Gagal', detail: err.message, life: 5000 });
  } finally {
    batchLoading.value = false;
  }
}

function formatCode(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
}

function formatTgl(d) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function spaceClass(gb) {
  if (gb === null || gb === undefined) return '';
  if (gb < 10) return 'space-critical';
  if (gb < 30) return 'space-warning';
  return 'space-ok';
}

function rowClass(data) {
  if (data.predictedUsage !== null && data.predictedUsage < 10) return 'row-critical';
  if (data.usageDiskSpace !== null && data.usageDiskSpace < -20) return 'row-warning';
  return '';
}
</script>

<style scoped src="./TabSpaceHdd.style.css"></style>
