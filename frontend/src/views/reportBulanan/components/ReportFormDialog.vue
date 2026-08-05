<template>
  <Dialog
    :visible="visible"
    modal
    :header="isEditMode ? 'Edit Konfigurasi Laporan' : 'Tambah Laporan Baru'"
    :style="{ width: '85vw', maxWidth: '920px' }"
    :closable="!saving"
    @update:visible="handleClose"
  >
    <div class="form-body p-fluid">

      <!-- Validation error -->
      <Message v-if="validationError" severity="error" :closable="false" class="mb-3">
        {{ validationError }}
      </Message>

      <!-- ─── Nama Laporan ─────────────────────────────────────── -->
      <div class="field mb-4">
        <label class="field-label" for="rf-name">
          Nama Laporan <span class="text-red-500">*</span>
        </label>
        <InputText
          id="rf-name"
          v-model="form.name"
          placeholder="Contoh: Laporan Penjualan Bulanan"
          :class="{ 'p-invalid': errors.name }"
        />
        <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
      </div>

      <!-- ─── Panduan Placeholder ──────────────────────────────────── -->
      <div class="placeholder-guide mb-4">
        <div class="placeholder-guide__header" @click="showPlaceholderGuide = !showPlaceholderGuide">
          <span>
            <i class="pi pi-info-circle mr-2 text-blue-400" />
            <strong>Panduan Placeholder Query</strong>
            <small class="text-color-secondary ml-2">— variabel dinamis yang bisa dipakai di semua query</small>
          </span>
          <i :class="showPlaceholderGuide ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="text-color-secondary" />
        </div>

        <Transition name="slide-down">
          <div v-if="showPlaceholderGuide" class="placeholder-guide__body">
            <table class="placeholder-table">
              <thead>
                <tr>
                  <th>Placeholder</th>
                  <th>Nilai yang Disubstitusi</th>
                  <th>Contoh Nilai</th>
                  <th>Contoh Penggunaan di Query</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ph in placeholders" :key="ph.key">
                  <td><code class="ph-code">{{ ph.key }}</code></td>
                  <td>{{ ph.desc }}</td>
                  <td><code class="ph-example">{{ ph.example }}</code></td>
                  <td><code class="ph-usage">{{ ph.usage }}</code></td>
                </tr>
              </tbody>
            </table>
            <div class="placeholder-guide__note">
              <i class="pi pi-shield mr-1" />
              Nilai placeholder di-<strong>sanitize otomatis</strong> (hanya huruf, angka, underscore) — aman dipakai sebagai bagian nama tabel temporary.
            </div>
          </div>
        </Transition>
      </div>

      <div class="section mb-4">
        <div class="section__header">
          <div>
            <span class="section__title">
              <i class="pi pi-database mr-2 text-blue-500" />
              Queries WRC
            </span>
            <small class="text-color-secondary ml-2">
              Dieksekusi <strong>sequential</strong> ke WRC sebelum export.
              Gunakan placeholder dari panduan di atas.
            </small>
          </div>
          <Button
            label="+ Tambah Query"
            icon="pi pi-plus"
            class="p-button-outlined p-button-sm p-button-info"
            @click="addWrcQuery"
          />
        </div>

        <div v-if="form.queriesWrc.length === 0" class="section__empty">
          <i class="pi pi-info-circle mr-1" />
          Kosong — query WRC opsional. Laporan akan langsung ke query export.
        </div>

        <div
          v-for="(q, idx) in form.queriesWrc"
          :key="idx"
          class="query-row"
        >
          <div class="query-row__num">{{ idx + 1 }}</div>
          <Textarea
            v-model="form.queriesWrc[idx]"
            :rows="3"
            :placeholder="`Query WRC ke-${idx + 1}\nContoh: DROP TEMPORARY TABLE IF EXISTS tmp_lap_{userId}_{cab}_{prd};`"
            class="query-row__textarea font-mono"
            auto-resize
          />
          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-danger p-0 w-2rem h-2rem flex-shrink-0"
            v-tooltip.top="'Hapus query ini'"
            @click="removeWrcQuery(idx)"
          />
        </div>
      </div>

      <!-- ─── Queries Export (Sheets) ─────────────────────────── -->
      <div class="section">
        <div class="section__header">
          <div>
            <span class="section__title">
              <i class="pi pi-file-excel mr-2 text-green-600" />
              Queries Export (Sheet Excel)
            </span>
            <small class="text-color-secondary ml-2">
              Setiap baris = 1 sheet di file Excel. Placeholder yang sama tersedia.
            </small>
          </div>
          <Button
            label="+ Tambah Sheet"
            icon="pi pi-plus"
            class="p-button-outlined p-button-sm p-button-success"
            @click="addExportQuery"
          />
        </div>

        <small v-if="errors.queriesExport" class="p-error block mb-2">{{ errors.queriesExport }}</small>

        <div v-if="form.queriesExport.length === 0" class="section__empty section__empty--error">
          <i class="pi pi-exclamation-circle mr-1 text-red-500" />
          Minimal 1 sheet export diperlukan.
        </div>

        <div
          v-for="(item, idx) in form.queriesExport"
          :key="idx"
          class="export-row"
        >
          <div class="query-row__num">{{ idx + 1 }}</div>
          <div class="export-row__inputs">
            <InputText
              v-model="form.queriesExport[idx].key"
              placeholder="Nama Sheet (contoh: Rekap Penjualan)"
              :class="{ 'p-invalid': errors[`export_key_${idx}`] }"
              class="export-row__key"
            />
            <small v-if="errors[`export_key_${idx}`]" class="p-error">{{ errors[`export_key_${idx}`] }}</small>
            <Textarea
              v-model="form.queriesExport[idx].query"
              :rows="3"
              :placeholder="`Query SQL untuk sheet ini\nContoh: SELECT * FROM tmp_lap_{userId}_{cab}_{prd}`"
              class="export-row__query font-mono"
              auto-resize
            />
          </div>
          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-danger p-0 w-2rem h-2rem flex-shrink-0"
            v-tooltip.top="'Hapus sheet ini'"
            @click="removeExportQuery(idx)"
          />
        </div>
      </div>

      <!-- ─── Queries Cleanup ─────────────────────────────────────── -->
      <div class="section mb-4">
        <div class="section__header">
          <div>
            <span class="section__title">
              <i class="pi pi-trash mr-2 text-orange-500" />
              Queries Cleanup
            </span>
            <small class="text-color-secondary ml-2">
              Dieksekusi <strong>secara paralel</strong> setelah proses export selesai.
              Digunakan untuk menghapus temporary table (Drop Table).
            </small>
          </div>
          <Button
            label="+ Tambah Query"
            icon="pi pi-plus"
            class="p-button-outlined p-button-sm p-button-warning"
            @click="addCleanupQuery"
          />
        </div>

        <div v-if="form.queriesCleanup.length === 0" class="section__empty">
          <i class="pi pi-info-circle mr-1" />
          Kosong — query cleanup opsional.
        </div>

        <div
          v-for="(q, idx) in form.queriesCleanup"
          :key="idx"
          class="query-row"
        >
          <div class="query-row__num" style="background-color: var(--orange-500);">{{ idx + 1 }}</div>
          <Textarea
            v-model="form.queriesCleanup[idx]"
            :rows="3"
            :placeholder="`Query Cleanup ke-${idx + 1}\nContoh: DROP TEMPORARY TABLE IF EXISTS tmp_lap_{userId}_{cab}_{prd};`"
            class="query-row__textarea font-mono"
            auto-resize
          />
          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-danger p-0 w-2rem h-2rem flex-shrink-0"
            v-tooltip.top="'Hapus query ini'"
            @click="removeCleanupQuery(idx)"
          />
        </div>
      </div>

    </div>

    <template #footer>
      <Button
        label="Batal"
        icon="pi pi-times"
        class="p-button-text p-button-secondary"
        :disabled="saving"
        @click="handleClose"
      />
      <Button
        :label="saving ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Buat Laporan')"
        :icon="saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
        class="p-button-primary"
        :loading="saving"
        :disabled="saving"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog    from 'primevue/dialog';
import Button    from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea  from 'primevue/textarea';
import Message   from 'primevue/message';

// ─── Placeholder guide data ───────────────────────────────────────────────────
const showPlaceholderGuide = ref(false);
const placeholders = [
  { key: '{userId}',   desc: 'Username / PIC user yang sedang login',              example: 'admin',  usage: 'tmp_lap_{userId}_{cab}' },
  { key: '{cab}',     desc: 'Kode cabang yang dipilih saat export',                example: 'G001',   usage: 'tmp_lap_{userId}_{cab}' },
  { key: '{prd}',     desc: 'Periode YYMM (tahun 2 digit + bulan)',                example: '2604',   usage: "WHERE periode = '{prd}'" },
  { key: '{prdPrev}', desc: 'Periode bulan sebelumnya — otomatis dihitung sistem',  example: '2603',   usage: 'kodetoko_{prdPrev}' },
  { key: '{prdYear}', desc: 'Tahun penuh 4 digit dari periode',                    example: '2026',   usage: 'WHERE YEAR(tgl) = {prdYear}' },
  { key: '{prdMonth}',desc: 'Bulan 2 digit dari periode',                          example: '04',     usage: 'WHERE MONTH(tgl) = {prdMonth}' },
];

const props = defineProps({
  visible:  { type: Boolean, default: false },
  editData: { type: Object,  default: null  },
  saving:   { type: Boolean, default: false },
});

const emit = defineEmits(['update:visible', 'save']);

// ─── Form state ───────────────────────────────────────────────────────────────
const form = ref({
  name:          '',
  queriesWrc:    [],
  queriesExport: [],
  queriesCleanup: [],
});

const errors          = ref({});
const validationError = ref('');

const isEditMode = computed(() => !!props.editData);

// Pre-fill form saat mode edit atau reset saat tambah baru
watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    errors.value          = {};
    validationError.value = '';

    if (props.editData) {
      form.value = {
        name:          props.editData['name-reports'] || '',
        queriesWrc:    [...(props.editData['queries-wrc'] || [])],
        queriesExport: (props.editData['queries-export'] || []).map(q => ({ ...q })),
        queriesCleanup: [...(props.editData['queries-cleanup'] || [])],
      };
    } else {
      form.value = {
        name:          '',
        queriesWrc:    [],
        queriesExport: [{ key: '', query: '' }], // mulai dengan 1 sheet kosong
        queriesCleanup: [],
      };
    }
  },
  { immediate: true }
);

// ─── Query WRC builders ───────────────────────────────────────────────────────
const addWrcQuery    = () => form.value.queriesWrc.push('');
const removeWrcQuery = (idx) => form.value.queriesWrc.splice(idx, 1);

// ─── Query Export builders ────────────────────────────────────────────────────
const addExportQuery    = () => form.value.queriesExport.push({ key: '', query: '' });
const removeExportQuery = (idx) => form.value.queriesExport.splice(idx, 1);

// ─── Query Cleanup builders ───────────────────────────────────────────────────
const addCleanupQuery    = () => form.value.queriesCleanup.push('');
const removeCleanupQuery = (idx) => form.value.queriesCleanup.splice(idx, 1);

// ─── Validation ───────────────────────────────────────────────────────────────
const validate = () => {
  errors.value          = {};
  validationError.value = '';
  let valid = true;

  if (!form.value.name?.trim()) {
    errors.value.name = 'Nama laporan wajib diisi';
    valid = false;
  }

  if (form.value.queriesExport.length === 0) {
    errors.value.queriesExport = 'Minimal 1 sheet export diperlukan';
    valid = false;
  }

  form.value.queriesExport.forEach((item, idx) => {
    if (!item.key?.trim()) {
      errors.value[`export_key_${idx}`] = 'Nama sheet wajib diisi';
      valid = false;
    }
  });

  if (!valid) {
    validationError.value = 'Mohon lengkapi semua field yang wajib diisi (*)';
  }

  return valid;
};

// ─── Save ─────────────────────────────────────────────────────────────────────
const handleSave = () => {
  if (!validate()) return;

  const payload = {
    'name-reports':   form.value.name.trim(),
    'queries-wrc':    form.value.queriesWrc.filter(q => q.trim() !== ''),
    'queries-export': form.value.queriesExport.filter(q => q.key.trim() !== ''),
    'queries-cleanup': form.value.queriesCleanup.filter(q => q.trim() !== ''),
  };

  emit('save', payload);
};

// ─── Close ────────────────────────────────────────────────────────────────────
const handleClose = () => {
  if (props.saving) return;
  emit('update:visible', false);
};
</script>

<style scoped src="./ReportFormDialog.style.css"></style>
