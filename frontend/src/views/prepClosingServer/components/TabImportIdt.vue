<template>
  <div class="tab-content">
    <div class="tab-toolbar">
      <Button icon="pi pi-bolt" label="Init Semua Cabang" class="p-button-warning p-button-sm mr-2"
        :loading="initLoading" :disabled="!periode" @click="handleInit"
        v-tooltip.top="'Generate skeleton untuk semua INDUK cabang'" style="margin-right: 0.5rem;" />
      <Button icon="pi pi-plus" label="Tambah Manual" class="p-button-primary p-button-sm"
        :disabled="!periode" @click="openCaptureDialog(null)" />
    </div>

    <DataTable :value="rows" :loading="loading" class="ceklist-table" stripedRows responsiveLayout="scroll">
      <template #empty>
        <div class="table-empty">
          <i class="pi pi-inbox"></i>
          <span>Belum ada data. Klik "Init Semua Cabang" untuk generate.</span>
        </div>
      </template>
      <Column header="KDCAB" style="width:100px">
        <template #body="{ data }">
          <span class="font-mono font-medium">{{ formatCode(data.KDCAB) }}</span>
        </template>
      </Column>
      <Column header="Status" style="width:120px">
        <template #body="{ data }">
          <Tag :value="data.CAPTURE ? 'Done' : 'Pending'"
            :severity="data.CAPTURE ? 'success' : 'warning'" />
        </template>
      </Column>
      <Column header="Capture" style="min-width:220px">
        <template #body="{ data }">
          <div v-if="data.CAPTURE">
            <a v-if="isImageUrl(data.CAPTURE)" :href="api.getAssetUrl(data.CAPTURE)"
              target="_blank" class="capture-link">
              <img :src="api.getAssetUrl(data.CAPTURE)" class="capture-thumb" alt="capture" />
            </a>
            <span v-else class="capture-text">{{ data.CAPTURE }}</span>
          </div>
          <span v-else class="text-color-secondary">—</span>
        </template>
      </Column>
      <Column field="UPDTIME" header="Update" style="width:140px">
        <template #body="{ data }">
          <span class="text-sm text-color-secondary">{{ formatDate(data.UPDTIME) }}</span>
        </template>
      </Column>
      <Column header="Aksi" style="width:130px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-upload" class="p-button-text p-button-sm p-button-success"
              v-tooltip.top="'Upload Gambar'" @click="openUploadDlg(data)" />
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-info"
              v-tooltip.top="'Edit Teks'" @click="openCaptureDialog(data)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
              v-tooltip.top="'Hapus'" @click="$emit('delete', data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Edit Text Dialog -->
    <Dialog v-model:visible="editDlgVisible" :header="isEdit ? 'Edit Import IDT' : 'Tambah Import IDT'"
      modal class="ceklist-dialog" :style="{ width: '400px' }">
      <div class="form-grid">
        <div class="form-field">
          <label>KDCAB <span class="req">*</span></label>
          <Dropdown v-model="form.kdcab" :options="kdcabOptions" optionLabel="label" optionValue="kdcab"
            placeholder="Pilih Kode Cabang" class="w-full" :disabled="isEdit" filter
            :showClear="!isEdit" />
        </div>
        <div class="form-field form-field-full">
          <label>Capture / Keterangan</label>
          <InputText v-model="form.capture" placeholder="Status atau keterangan..." class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="editDlgVisible = false" />
        <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :loading="saving" @click="saveText" />
      </template>
    </Dialog>

    <!-- Upload Image Dialog -->
    <Dialog v-model:visible="uploadDlgVisible" header="Upload Capture Gambar"
      modal class="ceklist-dialog" :style="{ width: '440px' }">
      <div
        class="upload-zone"
        :class="{ 'drag-over': isDragging }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <div class="upload-icon-container">
          <i class="pi pi-images upload-icon"></i>
        </div>
        <div class="paste-hint-box">
          <i class="pi pi-copy mr-1 text-primary"></i>
          <span>Bisa langsung <strong>Ctrl + V</strong> screenshot di sini</span>
        </div>
        <p class="upload-hint">atau seret file gambar / pilih dari file komputer</p>
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileSelected" />
        <div class="upload-actions-bar">
          <Button icon="pi pi-folder-open" label="Pilih File" class="p-button-outlined p-button-sm"
            @click="fileInput?.click()" />
          <Button icon="pi pi-clipboard" label="Paste Clipboard" class="p-button-outlined p-button-secondary p-button-sm"
            @click="pasteFromClipboard" v-tooltip.top="'Ambil gambar langsung dari clipboard OS'" />
        </div>
        <div v-if="uploadFile" class="upload-preview">
          <img :src="uploadPreview" class="preview-img" alt="preview" />
          <div class="preview-info">
            <span class="preview-name">{{ uploadFile.name }}</span>
            <span class="preview-size">({{ (uploadFile.size / 1024).toFixed(1) }} KB)</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="closeUpload" />
        <Button label="Upload" icon="pi pi-upload" class="p-button-success"
          :loading="uploading" :disabled="!uploadFile" @click="doUpload" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
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

// ─── Init ────────────────────────────────────────────────────────────────────
const initLoading = ref(false);
async function handleInit() {
  if (!props.periode) return;
  initLoading.value = true;
  try {
    const res = await api.initImportIdt(props.periode);
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

// ─── Edit text ───────────────────────────────────────────────────────────────
const saving = ref(false);
const editDlgVisible = ref(false);
const isEdit = ref(false);
const form = reactive({ kdcab: '', capture: '' });

// Cabang yang sudah punya record → tidak boleh ditambah dua kali
const existingKdcabs = computed(() => new Set(props.rows.map(r => r.KDCAB)));

const kdcabOptions = computed(() =>
  props.cabangs
    .filter(c => (isEdit.value ? c.kdcab === form.kdcab : !existingKdcabs.value.has(c.kdcab)))
    .map(c => ({ ...c, label: `${c.kdcab} - ${c.namacab}` })),
);

function openCaptureDialog(row = null) {
  isEdit.value = !!row;
  Object.assign(form, { kdcab: row?.KDCAB || '', capture: row?.CAPTURE || '' });
  editDlgVisible.value = true;
}
async function saveText() {
  if (!form.kdcab) { toast.add({ severity: 'warn', summary: 'Validasi', detail: 'KDCAB wajib', life: 3000 }); return; }
  saving.value = true;
  try {
    await api.upsertImportIdt({ kdcab: form.kdcab, periode: props.periode, capture: form.capture || null });
    editDlgVisible.value = false;
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data tersimpan', life: 3000 });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (e) { toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 }); }
  finally { saving.value = false; }
}

// ─── Upload ──────────────────────────────────────────────────────────────────
const uploading = ref(false);
const uploadDlgVisible = ref(false);
const uploadTarget = ref(null);
const uploadFile   = ref(null);
const fileInput    = ref(null);

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
  isActive: uploadDlgVisible,
  onImageCaptured: (file) => {
    uploadFile.value = file;
  },
  toast,
  filePrefix: 'idt-capture',
});

function openUploadDlg(row) {
  uploadTarget.value = row;
  uploadFile.value = null;
  resetClipboard();
  uploadDlgVisible.value = true;
}

function closeUpload() {
  uploadDlgVisible.value = false;
  uploadFile.value = null;
  resetClipboard();
}

function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  setFile(f);
}

async function doUpload() {
  if (!uploadFile.value || !uploadTarget.value) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('kdcab', uploadTarget.value.KDCAB);
    fd.append('periode', props.periode);
    fd.append('capture', uploadFile.value);
    await api.uploadCapture(fd, uploadTarget.value.KDCAB, props.periode);
    closeUpload();
    toast.add({ severity: 'success', summary: 'Upload Berhasil', detail: 'Gambar capture disimpan', life: 3000 });
    if (props.onRefresh) {
      await props.onRefresh();
    }
    emit('refresh');
  } catch (e) { toast.add({ severity: 'error', summary: 'Error Upload', detail: e.message, life: 4000 }); }
  finally { uploading.value = false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCode(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
}
function isImageUrl(str) { return /\.(jpg|jpeg|png|gif|webp)$/i.test(str); }
function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'2-digit' });
}
</script>

<style scoped src="./TabImportIdt.style.css"></style>
