<template>
  <span class="wrc-config-wrapper">
    <Dialog
      :visible="visible"
      modal
      :style="{ width: '80vw', maxWidth: '1000px' }"
      :closable="!isExtracting"
      :breakpoints="{ '960px': '92vw', '640px': '100vw' }"
      @update:visible="(val) => { if (!isExtracting) $emit('update:visible', val) }"
      class="wrc-config-dialog"
      :draggable="false"
    >
      <template #header>
        <div class="dialog-custom-header">
          <div class="header-icon-wrapper">
            <i class="pi pi-database text-xl"></i>
          </div>
          <div class="header-text">
            <h3 class="header-title">WRC Extraction Engine</h3>
            <span class="header-subtitle">Kelola query extraction dari WRC Data Engine</span>
          </div>
        </div>
      </template>

      <div class="dialog-body position-relative">
        <!-- Loading Overlay -->
        <div v-if="isExtracting" class="wrc-loading-overlay">
          <div class="wrc-loading-content">
            <i class="pi pi-spin pi-spinner text-5xl text-primary"></i>
            <p class="mt-3 text-lg font-semibold m-0">Menarik data WRC...</p>
            <p class="text-sm text-color-secondary m-0 mt-1">Proses ini memerlukan waktu beberapa saat.</p>
          </div>
        </div>

        <!-- Info Bar -->
        <div class="info-bar">
          <div class="info-bar-content">
            <i class="pi pi-info-circle"></i>
            <span>Kueri extraction dijalankan sekali per hari/trigger dan disimpan dalam master <strong>cache in-memory</strong>.</span>
            <span v-if="props.lastSyncAt" class="ml-2 text-sm">
              <i class="pi pi-clock mr-1"></i>Terakhir sync: {{ props.lastSyncAt }}
            </span>
          </div>
          <div class="info-bar-actions">
            <Button
              label="Sync Sekarang"
              icon="pi pi-sync"
              class="p-button-outlined p-button-info p-button-sm"
              @click="handleTriggerExtract"
              :loading="isExtracting"
              :disabled="isExtracting || isSaving"
              v-tooltip.bottom="'Tarik seluruh data WRC sekarang'"
            />
          </div>
        </div>

        <!-- Rules Table -->
        <DataTable
          :value="rules"
          responsiveLayout="scroll"
          class="p-datatable-sm wrc-rule-table"
          :loading="isLoading"
          :showGridlines="false"
          emptyMessage="Tidak ada aturan extraction WRC yang ditemukan."
        >
          <template #header>
            <div class="flex justify-content-between align-items-center w-full">
              <Button
                label="Tambah Query"
                icon="pi pi-plus"
                class="p-button-sm p-button-success"
                @click="openAddRule"
              />
              <span class="table-title-text">{{ rules.length }} Query Terdaftar</span>
            </div>
          </template>

          <Column field="key" header="Cache Key" style="width: 18%">
            <template #body="slotProps">
              <span class="key-chip">{{ slotProps.data.key }}</span>
            </template>
          </Column>

          <Column field="name" header="Nama Indikator" style="width: 25%">
            <template #body="slotProps">
              <span class="indicator-name">{{ slotProps.data.name }}</span>
            </template>
          </Column>

          <Column field="table_type" header="Tipe" style="width: 10%">
            <template #body="slotProps">
              <Tag :value="slotProps.data.table_type" severity="warning" class="text-xs" />
            </template>
          </Column>

          <Column field="level" header="Level" style="width: 10%">
            <template #body="slotProps">
              <Tag
                :value="slotProps.data.level === 'branch' ? 'Branch' : 'Store'"
                :severity="slotProps.data.level === 'branch' ? 'info' : 'success'"
                class="text-xs"
              />
            </template>
          </Column>

          <Column field="query" header="SQL Query" style="width: 25%">
            <template #body="slotProps">
              <div class="sql-preview" v-tooltip.bottom="slotProps.data.query">
                {{ slotProps.data.query }}
              </div>
            </template>
          </Column>

          <Column :exportable="false" style="width: 10%" alignFrozen="right">
            <template #body="slotProps">
              <div class="flex gap-1 justify-content-end">
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text p-button-info p-button-sm"
                  @click="editRule(slotProps.data, slotProps.index)"
                  v-tooltip.left="'Edit'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text p-button-danger p-button-sm"
                  @click="deleteRule(slotProps.index)"
                  v-tooltip.left="'Hapus'"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <Button label="Tutup" icon="pi pi-times" class="p-button-text p-button-secondary" :disabled="isExtracting" @click="$emit('update:visible', false)" />
          <Button label="Simpan Konfigurasi" icon="pi pi-check" class="p-button-primary" @click="saveRules" :loading="isSaving" :disabled="isExtracting || isSaving" />
        </div>
      </template>
    </Dialog>

    <!-- Editor Sub-Dialog -->
    <Dialog
      v-model:visible="editorVisible"
      modal
      :style="{ width: '60vw', maxWidth: '800px' }"
      :breakpoints="{ '960px': '80vw', '640px': '95vw' }"
      class="wrc-editor-dialog"
      :draggable="false"
    >
      <template #header>
        <div class="editor-header">
          <div class="editor-icon" :class="editingIndex > -1 ? 'edit' : 'add'">
            <i :class="editingIndex > -1 ? 'pi pi-pencil' : 'pi pi-plus'"></i>
          </div>
          <div>
            <h3 class="editor-title">{{ editingIndex > -1 ? 'Edit WRC Query' : 'Tambah WRC Query Baru' }}</h3>
            <span class="editor-subtitle">{{ editingIndex > -1 ? 'Perbarui konfigurasi query yang ada' : 'Definisikan query extraction baru' }}</span>
          </div>
        </div>
      </template>

      <div v-if="currentRule" class="editor-body">
        <!-- Validation -->
        <div v-if="validationError" class="validation-alert">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ validationError }}</span>
        </div>

        <!-- Key Info Section -->
        <div class="form-section">
          <div class="section-header section-blue">
            <div class="section-icon"><i class="pi pi-key"></i></div>
            <div>
              <h5 class="section-title">Dictionary Identity</h5>
              <p class="section-desc">Identitas variabel cache untuk Rule Editor</p>
            </div>
          </div>
          <div class="section-body">
            <div class="form-grid">
              <div class="field-group">
                <label for="wrc-key">Cache Key <span class="req">*</span></label>
                <InputText id="wrc-key" v-model="currentRule.key" placeholder="saldo_akh_wrc_toko" :class="{'p-invalid': !currentRule.key && validationError}" class="w-full" />
                <small class="field-hint">Unik, huruf kecil, pakai underscore (_).</small>
              </div>
              <div class="field-group">
                <label for="wrc-name">Nama Deskriptif <span class="req">*</span></label>
                <InputText id="wrc-name" v-model="currentRule.name" placeholder="Total Saldo Akhir WRC" :class="{'p-invalid': !currentRule.name && validationError}" class="w-full" />
              </div>
              <div class="field-group">
                <label for="wrc-valueField">Result Value Field <span class="req">*</span></label>
                <InputText id="wrc-valueField" v-model="currentRule.valueField" placeholder="rp_saldo_akh" :class="{'p-invalid': !currentRule.valueField && validationError}" class="w-full" />
                <small class="field-hint">Alias kolom dari SQL (SELECT ... AS ...).</small>
              </div>
              <div class="field-group">
                <label for="wrc-tableType">Table Target <span class="req">*</span></label>
                <Dropdown id="wrc-tableType" v-model="currentRule.table_type" :options="['kodetoko', 'bln_akt', 'generic', 'wt', 'glslp']" placeholder="Pilih Tipe" :class="{'p-invalid': !currentRule.table_type && validationError}" class="w-full" />
              </div>
              <div class="field-group">
                <label for="wrc-level">Cakupan Data <span class="req">*</span></label>
                <Dropdown id="wrc-level" v-model="currentRule.level" :options="levelOptions" optionLabel="label" optionValue="value" placeholder="Pilih Level" :class="{'p-invalid': !currentRule.level && validationError}" class="w-full" />
              </div>
            </div>
          </div>
        </div>

        <!-- SQL Section -->
        <div class="form-section">
          <div class="section-header section-amber">
            <div class="section-icon"><i class="pi pi-code"></i></div>
            <div>
              <h5 class="section-title">SQL Query</h5>
              <p class="section-desc">Query executable untuk WRC engine</p>
            </div>
          </div>
          <div class="section-body">
            <label for="wrc-query" class="sql-label">Raw SQL <span class="req">*</span></label>
            <Textarea
              id="wrc-query"
              v-model="currentRule.query"
              rows="5"
              placeholder="SELECT KODE_TOKO, SUM(SALDO_AKH) AS saldo FROM kodetoko_{period} GROUP BY KODE_TOKO"
              class="w-full sql-textarea"
              :class="{'p-invalid': !currentRule.query && validationError}"
            />
            <div class="sql-hints">
              <div class="hint-item">
                <i class="pi pi-bolt"></i>
                <span>Dynamic: <code>{period}</code> (YYMM), <code>{month}</code> (MM), <code>{year}</code> (YYYY)</span>
              </div>
              <div class="hint-item" v-if="currentRule.level === 'store'">
                <i class="pi pi-exclamation-triangle text-amber-500"></i>
                <span>WAJIB menampilkan kolom <strong>KODE_TOKO</strong> untuk level Store.</span>
              </div>
              <div class="hint-item" v-else>
                <i class="pi pi-info-circle text-blue-500"></i>
                <span>Untuk level Branch, tidak wajib KODE_TOKO. Sistem ambil baris pertama.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="editor-footer">
          <Button label="Batal" icon="pi pi-times" class="p-button-text p-button-secondary" @click="editorVisible = false" />
          <Button label="Terapkan" icon="pi pi-check" class="p-button-primary" @click="applyRuleEdit" />
        </div>
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="Hapus Query WRC"
      :message="'Query yang dihapus akan membuat rule screening yang mereferensikannya menjadi INVALID. Lanjutkan?'"
      confirm-text="Hapus"
      @confirm="executeDelete"
    />
  </span>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import ConfirmDialog from '../common/ConfirmDialog.vue';

import { useToastService } from '../../utils/toast';
import prepClosingApi from '../../services/prepClosing.service';

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectedPeriode: { type: String, default: null },
  selectedCabang: { type: String, default: 'All' },
  lastSyncAt: { type: String, default: null }
});

const emit = defineEmits(['update:visible']);
const toast = useToastService();

const isLoading = ref(false);
const isSaving = ref(false);
const isExtracting = ref(false);
const rules = ref([]);

const levelOptions = [
  { label: 'Branch Level (Global)', value: 'branch' },
  { label: 'Store Level (Per Toko)', value: 'store' }
];

const editorVisible = ref(false);
const editingIndex = ref(-1);
const currentRule = ref(null);
const validationError = ref('');
const showDeleteConfirm = ref(false);
const deleteIndex = ref(-1);

// Load Data
const fetchRules = async () => {
  try {
    isLoading.value = true;
    const res = await prepClosingApi.getWrcExtractRules();
    rules.value = res.data || [];
  } catch (error) {
    toast.error('Gagal mengambil daftar query WRC.');
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

watch(() => props.visible, (newVal) => {
  if (newVal) fetchRules();
});

onMounted(() => {
  if (props.visible) fetchRules();
});

// Trigger Extract
const handleTriggerExtract = async () => {
  if (!props.selectedPeriode) {
    toast.warn('Pilih bulan/periode di filter utama terlebih dahulu sebelum mengekstrak data dari WRC.');
    return;
  }
  const confirmation = window.confirm(`Apakah Anda yakin ingin mengeksekusi semua query ini ke WRC untuk periode ${props.selectedPeriode} / Cabang ${props.selectedCabang}?\nProses ini memerlukan waktu beberapa detik.`);
  if (!confirmation) return;

  try {
    isExtracting.value = true;
    await prepClosingApi.triggerWrcExtraction(props.selectedPeriode, props.selectedCabang);
    toast.success('Sukses menarik data dari WRC Server dan mengupdate Cache.');
  } catch (e) {
    toast.error('Gagal memproses WRC Cache Extraction.');
    console.error(e);
  } finally {
    isExtracting.value = false;
  }
};

// Open Editor
const openAddRule = () => {
  validationError.value = '';
  editingIndex.value = -1;
  currentRule.value = {
    key: '',
    name: '',
    level: 'store',
    table_type: 'kodetoko',
    query: '',
    valueField: ''
  };
  editorVisible.value = true;
};

const editRule = (rule, index) => {
  validationError.value = '';
  editingIndex.value = index;
  const ruleData = JSON.parse(JSON.stringify(rule));
  if (!ruleData.level) ruleData.level = 'store';
  currentRule.value = ruleData;
  editorVisible.value = true;
};

const deleteRule = (index) => {
  deleteIndex.value = index;
  showDeleteConfirm.value = true;
};

const executeDelete = () => {
  if (deleteIndex.value >= 0) {
    rules.value.splice(deleteIndex.value, 1);
    deleteIndex.value = -1;
  }
};

const applyRuleEdit = () => {
  const r = currentRule.value;
  if (!r.key || !r.name || !r.table_type || !r.query || !r.valueField || !r.level) {
    validationError.value = 'Mohon lengkapi semua field yang berbintang (*).';
    return;
  }

  if (editingIndex.value > -1) {
    rules.value[editingIndex.value] = { ...r };
  } else {
    if (rules.value.some(existing => existing.key === r.key)) {
      validationError.value = 'Cache Key sudah digunakan! Gunakan nama variabel lain.';
      return;
    }
    rules.value.push({ ...r });
  }
  editorVisible.value = false;
};

// Save
const saveRules = async () => {
  try {
    isSaving.value = true;
    await prepClosingApi.updateWrcExtractRules(rules.value);
    toast.success('Konfigurasi rule extractor WRC berhasil disimpan.');
  } catch (error) {
    toast.error('Gagal menyimpan WRC Extract rules.');
    console.error(error);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped src="./WrcExtractConfigDialog.style.css"></style>
