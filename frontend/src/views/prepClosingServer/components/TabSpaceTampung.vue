<template>
  <div class="tab-content">
    <!-- Toolbar with Action Buttons & Live Search -->
    <div class="tab-toolbar-wrapper">
      <div class="tab-actions-group">
        <Button icon="pi pi-bolt" label="Init Semua Cabang" class="p-button-warning p-button-sm"
          :loading="initLoading" :disabled="!periode" @click="handleInit"
          v-tooltip.top="'Generate skeleton record untuk semua INDUK cabang'" />
        <Button icon="pi pi-plus" label="Tambah Data" class="p-button-primary p-button-sm"
          :disabled="!periode" @click="openDialog(null)" />
      </div>

      <div class="tab-search-box">
        <IconField iconPosition="left">
          <InputIcon class="pi pi-search" />
          <InputText v-model="searchQuery" placeholder="Cari cabang, nama, path..." class="p-inputtext-sm search-input" />
        </IconField>
      </div>
    </div>

    <!-- Filter Pills Row -->
    <div class="filter-pills-row">
      <button
        type="button"
        class="filter-pill"
        :class="{ active: statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        <i class="pi pi-th-large mr-1"></i> Semua <span class="pill-badge">{{ totalCount }}</span>
      </button>
      <button
        type="button"
        class="filter-pill pill-danger"
        :class="{ active: statusFilter === 'critical' }"
        @click="statusFilter = 'critical'"
      >
        <i class="pi pi-exclamation-circle mr-1"></i> Kritis &lt; 10 GB <span class="pill-badge badge-danger">{{ criticalCount }}</span>
      </button>
      <button
        type="button"
        class="filter-pill pill-warn"
        :class="{ active: statusFilter === 'warning' }"
        @click="statusFilter = 'warning'"
      >
        <i class="pi pi-exclamation-triangle mr-1"></i> Warning &lt; 30 GB <span class="pill-badge badge-warn">{{ warningCount }}</span>
      </button>
      <button
        type="button"
        class="filter-pill pill-success"
        :class="{ active: statusFilter === 'ok' }"
        @click="statusFilter = 'ok'"
      >
        <i class="pi pi-check-circle mr-1"></i> Aman &ge; 30 GB <span class="pill-badge badge-success">{{ okCount }}</span>
      </button>
    </div>

    <DataTable :value="filteredRows" :loading="loading" class="ceklist-table" stripedRows responsiveLayout="scroll"
      :paginator="filteredRows.length > 15" :rows="15" :rowsPerPageOptions="[15, 30, 50]">
      <template #empty>
        <div class="table-empty">
          <i class="pi pi-search-minus" v-if="searchQuery || statusFilter !== 'all'"></i>
          <i class="pi pi-inbox" v-else></i>
          <span v-if="searchQuery || statusFilter !== 'all'">
            Tidak ada data yang sesuai dengan filter/pencarian.
            <Button label="Reset Filter" class="p-button-link p-button-sm p-0 ml-1" @click="resetFilters" />
          </span>
          <span v-else>Belum ada data untuk periode ini</span>
        </div>
      </template>

      <Column header="Cabang" sortable sortField="CAB" style="min-width:145px">
        <template #body="{ data }">
          <div class="cabang-cell">
            <span class="cabang-code font-mono">{{ formatCode(data.CAB) }}</span>
            <span class="cabang-name">{{ getCabangName(data.CAB) }}</span>
          </div>
        </template>
      </Column>
      <Column field="PATH" header="Path" sortable style="min-width:190px">
        <template #body="{ data }">
          <code class="path-badge">{{ data.PATH || '—' }}</code>
        </template>
      </Column>
      <Column header="Storage (Free / Total)" sortable :sortField="(d) => parseGbSimple(d.FREE_SPACE) || 0" style="min-width:210px">
        <template #body="{ data }">
          <div v-if="calcStorage(data)" class="storage-gauge">
            <div class="storage-gauge-header">
              <span :class="['font-mono font-bold text-xs', spaceClass(calcStorage(data).freeGb)]">
                {{ data.FREE_SPACE || '—' }} Sisa
              </span>
              <span class="text-xs text-color-secondary">Total: {{ data.CAPACITY || '—' }}</span>
            </div>
            <div class="storage-bar-track">
              <div
                class="storage-bar-fill"
                :class="calcStorage(data).pctUsed >= 90 ? 'bar-critical' : calcStorage(data).pctUsed >= 75 ? 'bar-warning' : 'bar-ok'"
                :style="{ width: calcStorage(data).pctUsed + '%' }"
              ></div>
            </div>
            <div class="storage-gauge-footer text-xs text-color-secondary">
              <span>{{ calcStorage(data).pctUsed }}% terpakai</span>
            </div>
          </div>
          <div v-else class="text-sm">
            <span class="font-mono">{{ data.FREE_SPACE || '—' }}</span> / {{ data.CAPACITY || '—' }}
          </div>
        </template>
      </Column>
      <Column field="TGL_CHECK" header="Tgl Check" sortable style="width:120px">
        <template #body="{ data }">
          <span class="text-sm font-mono">{{ formatDateShort(data.TGL_CHECK) }}</span>
        </template>
      </Column>
      <Column header="Capture" style="width:85px">
        <template #body="{ data }">
          <img v-if="data.CAPTURE_PATH" :src="api.getAssetUrl(data.CAPTURE_PATH)" alt="capture"
            class="capture-thumb-mini"
            @click="openPreview(api.getAssetUrl(data.CAPTURE_PATH))" />
          <i v-else class="pi pi-image text-color-secondary opacity-40 text-lg" />
        </template>
      </Column>
      <Column header="Aksi" style="width:95px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-info"
              v-tooltip.top="'Edit'" @click="openDialog(data)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
              v-tooltip.top="'Hapus'" @click="$emit('delete', data)" />
          </div>
        </template>
      </Column>

      <template #paginatorleft>
        <span class="text-xs text-color-secondary">
          Menampilkan {{ filteredRows.length }} dari total {{ rows.length }} cabang
        </span>
      </template>
    </DataTable>

    <!-- Upsert Dialog -->
    <Dialog v-model:visible="dlgVisible" :header="isEdit ? 'Edit Space HDD Tampung' : 'Tambah Space HDD Tampung'"
      modal class="ceklist-dialog" :style="{ width: '440px' }">
      <div class="form-grid">
        <div class="form-field">
          <label>CAB <span class="req">*</span></label>
          <Dropdown v-model="form.cab" :options="cabOptions" optionLabel="label" optionValue="kdcab"
            placeholder="Pilih Kode Cabang" class="w-full" :disabled="isEdit" filter
            :showClear="!isEdit" @change="onCabChange" />
        </div>
        <div class="form-field">
          <label>Path</label>
          <InputText v-model="form.path" placeholder="D:\Data\Tampung" class="w-full" />
        </div>
        <div class="form-field">
          <label>Capacity</label>
          <InputText v-model="form.capacity" placeholder="500 GB" class="w-full" />
        </div>
        <div class="form-field">
          <label>Free Space</label>
          <InputText v-model="form.freeSpace" placeholder="120 GB" class="w-full" />
        </div>
        <div class="form-field">
          <label>Tgl Check</label>
          <Calendar v-model="form.tglCheck" dateFormat="yy-mm-dd" class="w-full" showIcon />
        </div>

        <!-- Info Panduan (auto-fill dari guide) -->
        <div class="form-field form-field-full" v-if="form.cab && panduan[form.cab]">
          <label>Panduan Cabang <span style="color:var(--text-color-secondary);font-weight:400;font-size:0.8rem">(dari JUKLAK)</span></label>
          <PanduanCard :panduan="panduan[form.cab]" />
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
                  class="p-button-outlined p-button-sm" @click="fileInput?.click()" />
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
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
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
const form = reactive({ cab: '', path: '', capacity: '', freeSpace: '', tglCheck: null });

// ─── Filter & Live Search State ──────────────────────────────────────────────
const searchQuery = ref('');
const statusFilter = ref('all'); // 'all' | 'critical' | 'warning' | 'ok'

function getCabangName(cab) {
  const code = formatCode(cab);
  if (props.panduan?.[code]?.NAMACAB) return props.panduan[code].NAMACAB;
  const found = props.cabangs?.find(c => formatCode(c.kdcab) === code);
  return found?.namacab || '';
}

function calcStorage(row) {
  const freeGb = parseGbSimple(row.FREE_SPACE);
  const capGb = parseGbSimple(row.CAPACITY);
  if (!capGb || freeGb === null) return null;
  const usedGb = Math.max(0, capGb - freeGb);
  const pctUsed = Math.min(100, Math.max(0, Math.round((usedGb / capGb) * 100)));
  return { freeGb, capGb, usedGb, pctUsed };
}

const totalCount = computed(() => props.rows?.length || 0);
const criticalCount = computed(() => props.rows?.filter(r => {
  const gb = parseGbSimple(r.FREE_SPACE);
  return gb !== null && gb < 10;
}).length || 0);
const warningCount = computed(() => props.rows?.filter(r => {
  const gb = parseGbSimple(r.FREE_SPACE);
  return gb !== null && gb >= 10 && gb < 30;
}).length || 0);
const okCount = computed(() => props.rows?.filter(r => {
  const gb = parseGbSimple(r.FREE_SPACE);
  return gb !== null && gb >= 30;
}).length || 0);

const filteredRows = computed(() => {
  let list = props.rows || [];

  if (statusFilter.value === 'critical') {
    list = list.filter(r => {
      const gb = parseGbSimple(r.FREE_SPACE);
      return gb !== null && gb < 10;
    });
  } else if (statusFilter.value === 'warning') {
    list = list.filter(r => {
      const gb = parseGbSimple(r.FREE_SPACE);
      return gb !== null && gb >= 10 && gb < 30;
    });
  } else if (statusFilter.value === 'ok') {
    list = list.filter(r => {
      const gb = parseGbSimple(r.FREE_SPACE);
      return gb !== null && gb >= 30;
    });
  }

  const q = searchQuery.value?.trim().toLowerCase();
  if (q) {
    list = list.filter(r => {
      const code = formatCode(r.CAB).toLowerCase();
      const name = getCabangName(r.CAB).toLowerCase();
      const path = (r.PATH || '').toLowerCase();
      const cap = (r.CAPACITY || '').toLowerCase();
      const free = (r.FREE_SPACE || '').toLowerCase();
      return code.includes(q) || name.includes(q) || path.includes(q) || cap.includes(q) || free.includes(q);
    });
  }

  return list;
});

function resetFilters() {
  searchQuery.value = '';
  statusFilter.value = 'all';
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
  filePrefix: 'space-tampung',
});

// Cabang yang sudah punya record pada periode ini → tidak boleh ditambah dua kali
const existingCabs = computed(() => new Set(props.rows.map(r => r.CAB)));

const cabOptions = computed(() =>
  props.cabangs
    .filter(c => (isEdit.value ? c.kdcab === form.cab : !existingCabs.value.has(c.kdcab)))
    .map(c => ({ ...c, label: `${c.kdcab} - ${c.namacab}` })),
);

// Autofill PATH dari panduan saat kode cabang dipilih
function onCabChange() {
  const p = props.panduan[form.cab];
  if (p && p.PATH_TAMPUNG) form.path = p.PATH_TAMPUNG;
}


function openPreview(url) { previewSrc.value = url; previewVisible.value = true; }

function onFileChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  setFile(f);
}

async function doUpload() {
  if (!captureFile.value || !form.cab || !props.periode) {
    toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pilih file, CAB, dan periode sebelum upload', life: 3000 });
    return;
  }
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('capture', captureFile.value);
    const res = await api.uploadCaptureTampung(fd, form.cab, props.periode);
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
    const res = await api.initSpaceTampung(props.periode);
    const detailMsg = res.created > 0
      ? `Dibuat ${res.created} record baru dari total ${res.total} cabang`
      : `${res.existing || res.total} cabang sudah terdaftar`;
    toast.add({ severity: 'success', summary: 'Init Selesai', detail: detailMsg, life: 4000 });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { initLoading.value = false; }
}

defineExpose({ openDialog });

function openDialog(row = null) {
  isEdit.value = !!row;
  captureFile.value = null;
  resetClipboard();
  capturePath.value = row?.CAPTURE_PATH || null;
  Object.assign(form, {
    cab: row?.CAB || '', path: row?.PATH || '', capacity: row?.CAPACITY || '',
    freeSpace: row?.FREE_SPACE || '', tglCheck: row?.TGL_CHECK ? new Date(row.TGL_CHECK) : null,
  });
  dlgVisible.value = true;
}

async function save() {
  if (!form.cab) {
    toast.add({ severity: 'warn', summary: 'Validasi', detail: 'CAB wajib diisi', life: 3000 }); return;
  }
  saving.value = true;
  try {
    if (captureFile.value && props.periode) {
      const fd = new FormData();
      fd.append('capture', captureFile.value);
      const res = await api.uploadCaptureTampung(fd, form.cab, props.periode);
      capturePath.value = res.captureUrl;
      captureFile.value = null;
      resetClipboard();
    }
    await api.upsertSpaceTampung({
      cab: form.cab, periode: props.periode, path: form.path || null,
      capacity: form.capacity || null, freeSpace: form.freeSpace || null,
      tglCheck: formatTgl(form.tglCheck),
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

function formatCode(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
}

function formatTgl(d) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function parseGbSimple(str) {
  if (!str) return null;
  const m = str.match(/([\d.]+)\s*(GB|TB|MB)/i);
  if (!m) return null;
  const v = parseFloat(m[1]); const u = m[2].toUpperCase();
  return u === 'TB' ? v * 1024 : u === 'MB' ? v / 1024 : v;
}
function spaceClass(gb) {
  if (gb === null || gb === undefined) return '';
  return gb < 10 ? 'space-critical' : gb < 30 ? 'space-warning' : 'space-ok';
}
</script>

<style scoped src="./TabSpaceTampung.style.css"></style>
