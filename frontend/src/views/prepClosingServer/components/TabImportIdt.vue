<template>
  <div class="tab-content">
    <div class="tab-toolbar">
      <Button icon="pi pi-bolt" label="Init Semua Cabang" class="p-button-warning p-button-sm mr-2"
        :loading="initLoading" :disabled="!periode" @click="handleInit"
        v-tooltip.top="'Generate skeleton untuk semua INDUK cabang'" />
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
      <Column field="KDCAB" header="KDCAB" style="width:100px" />
      <Column header="Status" style="width:120px">
        <template #body="{ data }">
          <Tag :value="data.CAPTURE ? 'Done' : 'Pending'"
            :severity="data.CAPTURE ? 'success' : 'warning'" />
        </template>
      </Column>
      <Column header="Capture" style="min-width:220px">
        <template #body="{ data }">
          <div v-if="data.CAPTURE">
            <a v-if="isImageUrl(data.CAPTURE)" :href="backendUrl + data.CAPTURE"
              target="_blank" class="capture-link">
              <img :src="backendUrl + data.CAPTURE" class="capture-thumb" alt="capture" />
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
          <InputText v-model="form.kdcab" placeholder="G033" class="w-full" :disabled="isEdit" />
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
      modal class="ceklist-dialog" :style="{ width: '400px' }">
      <div class="upload-zone">
        <i class="pi pi-image upload-icon"></i>
        <p class="upload-hint">Pilih gambar (JPEG/PNG/WebP, maks 10 MB)</p>
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileSelected" />
        <Button icon="pi pi-folder-open" label="Pilih File" class="p-button-outlined mt-2"
          @click="fileInput?.click()" />
        <div v-if="uploadFile" class="upload-preview">
          <img :src="uploadPreview" class="preview-img" alt="preview" />
          <span class="preview-name">{{ uploadFile.name }}</span>
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
import { ref, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import * as api from '../services/ceklistPrepClosing.service.js';

const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000';

const props = defineProps({
  rows:    { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  periode: { type: String, default: '' },
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
    toast.add({ severity: 'success', summary: 'Init Selesai',
      detail: `Dibuat ${res.created} record dari ${res.total} cabang`, life: 4000 });
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
    emit('refresh');
  } catch (e) { toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 }); }
  finally { saving.value = false; }
}

// ─── Upload ──────────────────────────────────────────────────────────────────
const uploading = ref(false);
const uploadDlgVisible = ref(false);
const uploadTarget = ref(null);
const uploadFile   = ref(null);
const uploadPreview = ref('');
const fileInput    = ref(null);

function openUploadDlg(row) {
  uploadTarget.value = row; uploadFile.value = null; uploadPreview.value = '';
  uploadDlgVisible.value = true;
}
function closeUpload() { uploadDlgVisible.value = false; uploadFile.value = null; }
function onFileSelected(e) {
  const f = e.target.files?.[0]; if (!f) return;
  uploadFile.value = f; uploadPreview.value = URL.createObjectURL(f);
}
async function doUpload() {
  if (!uploadFile.value || !uploadTarget.value) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('capture', uploadFile.value);
    fd.append('kdcab', uploadTarget.value.KDCAB);
    fd.append('periode', props.periode);
    await api.uploadCapture(fd, uploadTarget.value.KDCAB, props.periode);
    closeUpload();
    toast.add({ severity: 'success', summary: 'Upload Berhasil', detail: 'Gambar capture disimpan', life: 3000 });
    emit('refresh');
  } catch (e) { toast.add({ severity: 'error', summary: 'Error Upload', detail: e.message, life: 4000 }); }
  finally { uploading.value = false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isImageUrl(str) { return /\.(jpg|jpeg|png|gif|webp)$/i.test(str); }
function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'2-digit' });
}
</script>

<style scoped>
.capture-thumb {
  max-width: 200px;
  max-height: 150px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.capture-thumb:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.capture-link {
  display: inline-block;
}

.capture-text {
  font-size: 0.875rem;
  color: var(--text-color);
}

.upload-zone {
  text-align: center;
  padding: 2rem 1rem;
  border: 2px dashed var(--surface-border);
  border-radius: 8px;
  background: var(--surface-section);
}

.upload-icon {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
}

.upload-hint {
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
}

.upload-preview {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.preview-img {
  max-width: 100%;
  max-height: 200px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
}

.preview-name {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  word-break: break-word;
}

.row-actions {
  display: flex;
  gap: 0.25rem;
}

.table-empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-color-secondary);
}

.table-empty i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  display: block;
}

@media (max-width: 768px) {
  .capture-thumb {
    max-width: 150px;
    max-height: 100px;
  }
}
</style>
