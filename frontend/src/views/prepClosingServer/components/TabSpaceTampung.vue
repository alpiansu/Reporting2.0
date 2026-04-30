<template>
  <div class="tab-content">
    <div class="tab-toolbar">
      <Button icon="pi pi-bolt" label="Init Semua Cabang" class="p-button-warning p-button-sm mr-2"
        :loading="initLoading" :disabled="!periode" @click="handleInit"
        v-tooltip.top="'Generate skeleton record untuk semua INDUK cabang'" />
      <Button icon="pi pi-plus" label="Tambah Data" class="p-button-primary p-button-sm"
        :disabled="!periode" @click="openDialog(null)" />
    </div>

    <DataTable :value="rows" :loading="loading" class="ceklist-table" stripedRows responsiveLayout="scroll">
      <template #empty>
        <div class="table-empty"><i class="pi pi-inbox"></i><span>Belum ada data</span></div>
      </template>
      <Column field="CAB" header="CAB" style="width:80px" />
      <Column field="PATH" header="Path" style="min-width:200px" />
      <Column field="CAPACITY" header="Capacity" style="width:110px" />
      <Column field="FREE_SPACE" header="Free Space" style="width:110px">
        <template #body="{ data }">
          <span :class="['space-badge', spaceClass(parseGbSimple(data.FREE_SPACE))]">{{ data.FREE_SPACE || '—' }}</span>
        </template>
      </Column>
      <Column field="TGL_CHECK" header="Tgl Check" style="width:110px">
        <template #body="{ data }">{{ data.TGL_CHECK || '—' }}</template>
      </Column>
      <Column header="Capture" style="width:90px">
        <template #body="{ data }">
          <a v-if="data.CAPTURE_PATH" :href="baseUrl + data.CAPTURE_PATH" target="_blank">
            <img :src="baseUrl + data.CAPTURE_PATH" alt="capture"
              style="max-width:80px;max-height:56px;width:auto;height:auto;object-fit:contain;border-radius:3px;display:block" />
          </a>
          <i v-else class="pi pi-image" style="font-size:1.4rem;color:var(--text-color-secondary)" />
        </template>
      </Column>
      <Column header="Aksi" style="width:90px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-info"
              v-tooltip.top="'Edit'" @click="openDialog(data)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
              v-tooltip.top="'Hapus'" @click="$emit('delete', data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Upsert Dialog -->
    <Dialog v-model:visible="dlgVisible" :header="isEdit ? 'Edit Space HDD Tampung' : 'Tambah Space HDD Tampung'"
      modal class="ceklist-dialog" :style="{ width: '440px' }">
      <div class="form-grid">
        <div class="form-field">
          <label>CAB <span class="req">*</span></label>
          <InputText v-model="form.cab" placeholder="G033" class="w-full" :disabled="isEdit" />
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

        <!-- ─── Compact Capture Upload ─── -->
        <div class="form-field form-field-full capture-section">
          <label>Capture <span style="color:var(--text-color-secondary);font-weight:400;font-size:0.8rem">(opsional)</span></label>
          <div class="capture-upload-row">
            <div class="capture-preview-box">
              <img v-if="capturePath" :src="baseUrl + capturePath" alt="capture"
                style="max-width:120px;max-height:80px;width:auto;height:auto;object-fit:contain;border-radius:4px" />
              <i v-else class="pi pi-image" style="font-size:2rem;color:var(--text-color-secondary)" />
            </div>
            <div class="capture-upload-actions">
              <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
              <Button :label="capturePath ? 'Ganti' : 'Pilih File'" icon="pi pi-upload"
                class="p-button-outlined p-button-sm" @click="fileInput.click()" />
              <span v-if="captureFile" class="capture-filename">{{ captureFile.name }}</span>
              <Button v-if="captureFile" label="Upload" icon="pi pi-check" class="p-button-success p-button-sm"
                :loading="uploading" @click="doUpload" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="dlgVisible = false" />
        <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :loading="saving" @click="save" />
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
import Calendar from 'primevue/calendar';
import Dialog from 'primevue/dialog';
import * as api from '../services/ceklistPrepClosing.service.js';

const props = defineProps({
  rows:    { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  periode: { type: String, default: '' },
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
const form = reactive({ cab: '', path: '', capacity: '', freeSpace: '', tglCheck: null });

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000';

function onFileChange(e) { captureFile.value = e.target.files[0] || null; }

async function doUpload() {
  if (!captureFile.value || !form.cab || !props.periode) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('capture', captureFile.value);
    const res = await api.uploadCaptureTampung(fd, form.cab, props.periode);
    capturePath.value = res.captureUrl;
    captureFile.value = null;
    toast.add({ severity: 'success', summary: 'Upload Berhasil', detail: 'Gambar capture disimpan', life: 3000 });
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
    toast.add({ severity: 'success', summary: 'Init Selesai',
      detail: `Dibuat ${res.created} record baru dari total ${res.total} cabang`, life: 4000 });
    emit('refresh');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { initLoading.value = false; }
}

defineExpose({ openDialog });

function openDialog(row = null) {
  isEdit.value = !!row;
  captureFile.value = null;
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
    await api.upsertSpaceTampung({
      cab: form.cab, periode: props.periode, path: form.path || null,
      capacity: form.capacity || null, freeSpace: form.freeSpace || null,
      tglCheck: formatTgl(form.tglCheck),
    });
    dlgVisible.value = false;
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data tersimpan', life: 3000 });
    emit('refresh');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { saving.value = false; }
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

<style scoped>
.capture-section { border-top: 1px solid var(--surface-border); padding-top: 0.75rem; margin-top: 0.25rem; }
.capture-upload-row { display: flex; align-items: center; gap: 0.75rem; }
.capture-preview-box {
  width: 128px; height: 88px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-section); border: 1px solid var(--surface-border); border-radius: 6px; overflow: hidden;
}
.capture-upload-actions { display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-start; }
.capture-filename { font-size: 0.78rem; color: var(--text-color-secondary); word-break: break-all; max-width: 200px; }
</style>
