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
const form = reactive({ cab: '', path: '', capacity: '', freeSpace: '', tglCheck: null });

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
