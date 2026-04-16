<template>
  <span class="wrc-config-wrapper">
    <Dialog
      :visible="visible"
      modal
      header="WRC Extraction Configurations"
      :style="{ width: '80vw', maxWidth: '1000px' }"
      :closable="true"
      @update:visible="$emit('update:visible', $event)"
      class="wrc-config-dialog"
    >
      <div class="card border-none shadow-none pb-0">
        <div class="flex justify-content-between align-items-center mb-4">
          <div>
            <h5 class="m-0 text-xl font-bold">WRC Custom Query Dictionary</h5>
            <p class="text-color-secondary mt-1 mb-0 text-sm">
              Kelola _query extraction_ sentral dari WRC Data Engine. Kueri ini akan ditarik sekali per hari/trigger dan disimpan di dalam master _cache_ in-memory.
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              label="Sync/Trigger Extractor"
              icon="pi pi-sync"
              class="p-button-outlined p-button-info"
              @click="handleTriggerExtract"
              :loading="isExtracting"
              v-tooltip.bottom="'Tarik seluruh data dari kueri di bawah dari server WRC sekarang juga'"
            />
            <Button
              label="Batal / Tutup"
              icon="pi pi-times"
              class="p-button-text p-button-secondary"
              @click="$emit('update:visible', false)"
            />
            <Button
              label="Simpan Konfigurasi"
              icon="pi pi-check"
              class="p-button-primary"
              @click="saveRules"
              :loading="isSaving"
            />
          </div>
        </div>

        <!-- Table Data -->
        <DataTable
          :value="rules"
          responsiveLayout="scroll"
          class="p-datatable-sm wrc-rule-table"
          :loading="isLoading"
          emptyMessage="Tidak ada aturan extraction WRC yang ditemukan."
        >
          <template #header>
            <div class="flex justify-content-end">
              <Button
                label="Tambah Kueri WRC"
                icon="pi pi-plus"
                class="p-button-sm p-button-success"
                @click="openAddRule"
              />
            </div>
          </template>

          <Column field="key" header="Cache Key / Variabel" style="width: 20%">
            <template #body="slotProps">
              <span class="font-bold text-primary">{{ slotProps.data.key }}</span>
            </template>
          </Column>

          <Column field="name" header="Nama Indikator" style="width: 25%" />

          <Column field="table_type" header="Tipe Tabel" style="width: 15%">
            <template #body="slotProps">
              <Badge :value="slotProps.data.table_type" severity="warning" />
            </template>
          </Column>

          <Column field="query" header="Query (SQL)" style="width: 30%">
            <template #body="slotProps">
              <div class="sql-preview" v-tooltip.bottom="slotProps.data.query">
                {{ slotProps.data.query }}
              </div>
            </template>
          </Column>

          <Column :exportable="false" style="width: 10%" alignFrozen="right">
            <template #body="slotProps">
              <div class="flex gap-2 justify-content-end">
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text p-button-info p-0 w-2rem h-2rem"
                  @click="editRule(slotProps.data, slotProps.index)"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text p-button-danger p-0 w-2rem h-2rem"
                  @click="deleteRule(slotProps.index)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </Dialog>

    <!-- Editor Modal (Sub-Dialog) -->
    <Dialog
      v-model:visible="editorVisible"
      modal
      :header="editingIndex > -1 ? 'Edit WRC Query' : 'Tambah WRC Query Baru'"
      :style="{ width: '60vw', maxWidth: '800px' }"
      class="wrc-editor-dialog"
    >
      <div v-if="currentRule" class="p-fluid grid mt-2 px-3">
        <!-- Validation Message -->
        <div class="col-12" v-if="validationError">
          <Message severity="error" :closable="false" class="m-0">{{ validationError }}</Message>
        </div>

        <div class="col-12 mt-3">
          <div class="flex align-items-center mb-4 border-bottom-1 surface-border pb-3">
            <div class="mr-3">
              <div class="flex align-items-center justify-content-center bg-primary-100 text-primary border-circle w-3rem h-3rem">
                <i class="pi pi-database text-xl"></i>
              </div>
            </div>
            <div>
              <h3 class="m-0 text-lg font-semibold text-color">Informasi Key Dictionary</h3>
              <p class="m-0 text-sm text-color-secondary">Identitas variabel cache untuk auto-complete di Rule Editor utama.</p>
            </div>
          </div>
        </div>

        <div class="col-12 md:col-6 field mb-4">
          <label class="font-semibold" for="wrc-key">Cache Key (Variabel) <span class="text-red-500">*</span></label>
          <InputText
            id="wrc-key"
            v-model="currentRule.key"
            placeholder="Contoh: saldo_akh_wrc_toko"
            :class="{'p-invalid': !currentRule.key && validationError}"
          />
          <small class="text-color-secondary block mt-1">Harus unik, huruf kecil, dan pakai underscore (_).</small>
        </div>

        <div class="col-12 md:col-6 field mb-4">
          <label class="font-semibold" for="wrc-name">Nama Deskriptif <span class="text-red-500">*</span></label>
          <InputText
            id="wrc-name"
            v-model="currentRule.name"
            placeholder="Contoh: Total Saldo Akhir WRC"
            :class="{'p-invalid': !currentRule.name && validationError}"
          />
        </div>

        <div class="col-12 md:col-6 field mb-4">
          <label class="font-semibold" for="wrc-valueField">Result Value Field <span class="text-red-500">*</span></label>
          <InputText
            id="wrc-valueField"
            v-model="currentRule.valueField"
            placeholder="Contoh: rp_saldo_akh"
            :class="{'p-invalid': !currentRule.valueField && validationError}"
          />
          <small class="text-color-secondary block mt-1">Sesuai dengan nama origin/alias kolom pada Query SQL (SELECT xyz as ...).</small>
        </div>

        <div class="col-12 md:col-6 field mb-4">
          <label class="font-semibold" for="wrc-tableType">Table Target (Format Utility) <span class="text-red-500">*</span></label>
          <Dropdown
            id="wrc-tableType"
            v-model="currentRule.table_type"
            :options="['kodetoko', 'bln_akt', 'generic', 'wt', 'glslp']"
            placeholder="Pilih Tipe Tabel Backend"
            :class="{'p-invalid': !currentRule.table_type && validationError}"
          />
        </div>

        <div class="col-12 field mb-4">
          <label class="font-semibold" for="wrc-query">Query Executable (Raw SQL) <span class="text-red-500">*</span></label>
          <Textarea
            id="wrc-query"
            v-model="currentRule.query"
            rows="5"
            placeholder="SELECT KODE_TOKO, SUM(SALDO_AKH) AS saldo FROM kodetoko_{period} GROUP BY KODE_TOKO"
            style="font-family: monospace; font-size:14px; background: #1e1e1e; color: #d4d4d4"
            :class="{'p-invalid': !currentRule.query && validationError}"
          />
          <Message severity="info" :closable="false" class="mt-2 text-sm p-2 w-full">
            Tersedia Dynamic Replacement: <b>{period}</b> (YYMM), <b>{month}</b> (MM), <b>{year}</b> (YYYY).<br/>
            WAJIB menampilkan kolom <b>KODE_TOKO</b> jika value ditujukan per toko. Ketik 'GLOBAL' AS KODE_TOKO jika untuk semua toko sekaligus.
          </Message>
        </div>
      </div>

      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="editorVisible = false" />
        <Button label="Terapkan" icon="pi pi-check" @click="applyRuleEdit" />
      </template>
    </Dialog>
  </span>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Badge from 'primevue/badge';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';

import { useToastService } from '../../utils/toast';
import prepClosingApi from '../../services/prepClosing.service';

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectedPeriode: { type: String, default: null },
  selectedCabang: { type: String, default: 'All' }
});

const emit = defineEmits(['update:visible']);
const toast = useToastService();

const isLoading = ref(false);
const isSaving = ref(false);
const isExtracting = ref(false);
const rules = ref([]);

const editorVisible = ref(false);
const editingIndex = ref(-1);
const currentRule = ref(null);
const validationError = ref('');

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
  if (newVal) {
    fetchRules();
  }
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
    table_type: 'kodetoko',
    query: '',
    valueField: ''
  };
  editorVisible.value = true;
};

const editRule = (rule, index) => {
  validationError.value = '';
  editingIndex.value = index;
  currentRule.value = JSON.parse(JSON.stringify(rule));
  editorVisible.value = true;
};

const deleteRule = (index) => {
  if (window.confirm("Yakin ingin menghapus query WRC ini? Penghapusan akan membuat rule screening dengan referensi 'Source Data 1'-nya menjadi INVALID.")) {
    rules.value.splice(index, 1);
  }
};

const applyRuleEdit = () => {
  const r = currentRule.value;
  if (!r.key || !r.name || !r.table_type || !r.query || !r.valueField) {
    validationError.value = 'Mohon lengkapi semua field yang berbintang (*).';
    return;
  }
  
  if (editingIndex.value > -1) {
    rules.value[editingIndex.value] = { ...r };
  } else {
    // Cek duplikasi key
    if (rules.value.some(existing => existing.key === r.key)) {
      validationError.value = 'Cache Key (Variabel) sudah digunakan! Gunakan nama variabel lain.';
      return;
    }
    rules.value.push({ ...r });
  }
  editorVisible.value = false;
};

// Save Configuration Logic
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

<style scoped>
.sql-preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  font-family: monospace;
  font-size: 0.85rem;
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}
</style>
