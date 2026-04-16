<template>
  <span>
    <Dialog
      v-model:visible="visible"
      :header="isEditMode ? 'Edit Spesifikasi Rule' : 'Tambah Aturan Baru'"
      :modal="true"
      :style="{ width: '60vw', minWidth: '600px' }"
      :maximizable="true"
      :breakpoints="{'960px': '75vw', '640px': '90vw'}"
      @hide="resetForm"
      class="p-fluid"
    >
      <div class="px-2 py-1">

        <!-- 1. General Settings -->
        <div class="surface-card p-4 shadow-1 border-round mb-4">
          <div class="flex align-items-center mb-4 border-bottom-1 surface-border pb-3">
            <i class="pi pi-info-circle text-primary text-xl mr-2"></i>
            <h5 class="m-0 font-medium text-lg text-900">Informasi Fundamental</h5>
          </div>

          <div class="grid formgrid">
            <div class="field col-12 md:col-6 mb-4">
              <label for="ruleKey" class="block font-medium text-700 mb-2">Key ID (Trigger) <span class="text-red-500">*</span></label>
              <InputText id="ruleKey" v-model="formData.key" :disabled="isEditMode" placeholder="e.g. saldo_minus_check" class="w-full" />
              <small v-if="!isEditMode" class="text-600 mt-2 block line-height-2">Gunakan <b class="text-primary">generic_sql_check</b> agar backend memproses Raw SQL Kustom Anda.</small>
            </div>

            <div class="field col-12 md:col-6 mb-4">
              <label for="ruleName" class="block font-medium text-700 mb-2">Nama Rule (Alias) <span class="text-red-500">*</span></label>
              <InputText id="ruleName" v-model="formData.name" placeholder="Nama Deskriptif" class="w-full" />
            </div>

            <div class="field col-12 md:col-6 mb-4">
              <label for="category" class="block font-medium text-700 mb-2">Kategori Engine</label>
              <Dropdown 
                id="category" 
                v-model="formData.category" 
                :options="categoryOptions" 
                optionLabel="label" 
                optionValue="value" 
                placeholder="Pilih Kategori" 
                class="w-full"
              />
            </div>

            <div class="field col-12 md:col-6 mb-4">
              <label for="severity" class="block font-medium text-700 mb-2">Tingkat Bahaya (Severity)</label>
              <Dropdown 
                id="severity" 
                v-model="formData.severity" 
                :options="severityOptions" 
                optionLabel="label" 
                optionValue="value" 
                class="w-full"
              >
                <template #value="slotProps">
                  <Badge v-if="slotProps.value" :value="slotProps.value" :severity="getSeverityBadge(slotProps.value)" />
                </template>
              </Dropdown>
            </div>

            <div class="field col-12 mb-4">
              <label for="description" class="block font-medium text-700 mb-2">Deskripsi Tujuan Aturan</label>
              <Textarea id="description" v-model="formData.description" rows="2" autoResize class="w-full" />
            </div>

            <div class="field col-12 flex align-items-center gap-3">
              <InputSwitch id="enabled" v-model="formData.enabled" />
              <div class="flex flex-column">
                <label for="enabled" class="font-medium text-900 cursor-pointer">Status Rule Diaktifkan</label>
                <small class="text-500">Bila dimatikan, screening akan melewati rule ini.</small>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Logic & Validation Settings -->
        <div class="surface-card p-4 shadow-1 border-round mb-4">
          <div class="flex align-items-center mb-4 border-bottom-1 surface-border pb-3">
            <i class="pi pi-database text-primary text-xl mr-2"></i>
            <h5 class="m-0 font-medium text-lg text-900">Query & Logika Validasi</h5>
          </div>

          <div class="grid formgrid">
            <div class="field col-12 mb-4">
              <label for="querySql" class="block font-medium text-700 mb-2">Konfigurasi Raw SQL</label>
              <Textarea 
                id="querySql" 
                v-model="formData.query.sql" 
                rows="3" 
                style="font-family: 'Courier New', Courier, monospace;" 
                placeholder="SELECT ... FROM ... WHERE ...='{cabang}'" 
                class="w-full surface-100"
              />
              <small class="text-500 block mt-2">Dukungan variabel: {cabang}, {periode}, {year}, {kdtk}, dll.</small>
            </div>

            <div class="field col-12 md:col-6 mb-4">
              <label for="validatorOp" class="block font-medium text-700 mb-2">Operator Pembanding</label>
              <Dropdown 
                id="validatorOp" 
                v-model="formData.validation.operator" 
                :options="operatorOptions" 
                optionLabel="label" 
                optionValue="value" 
                placeholder="Pilih Operator"
                class="w-full font-bold text-primary"
              />
            </div>

            <div class="field col-12 md:col-6 mb-4">
              <label for="valExpected" class="block font-medium text-700 mb-2" :class="{'text-400': ['IS_NULL', 'IS_NOT_NULL'].includes(formData.validation.operator)}">Expected Value (Harapan)</label>
              <Dropdown
                id="valExpected" 
                v-model="formData.validation.expected"
                :options="expectedOptions"
                optionLabel="label"
                optionValue="value"
                :editable="true"
                placeholder="Target. (0 / ON / {year} / {wrc_key})" 
                class="w-full"
                :disabled="['IS_NULL', 'IS_NOT_NULL'].includes(formData.validation.operator)"
              />
            </div>
            
            <div class="field col-12 md:col-6 mb-4">
              <label for="passMessage" class="block font-medium text-700 mb-2">Feedback Sukses (Pass)</label>
              <InputText id="passMessage" v-model="formData.validation.passMessage" placeholder="Pesan bila sesuai ekspektasi" class="w-full" />
            </div>

            <div class="field col-12 md:col-6 mb-4">
              <label for="failMessage" class="block font-medium text-700 mb-2">Feedback Gagal (Fail)</label>
              <InputText id="failMessage" v-model="formData.validation.failMessage" placeholder="Misal: Ditemukan {actual} anomali" class="w-full" />
            </div>
          </div>
        </div>

        <!-- 3. Appearance -->
        <div class="surface-card p-4 shadow-1 border-round mb-2">
          <div class="flex align-items-center mb-4 border-bottom-1 surface-border pb-3">
            <i class="pi pi-desktop text-primary text-xl mr-2"></i>
            <h5 class="m-0 font-medium text-lg text-900">Estetika Laporan (Dashboard)</h5>
          </div>
          
          <div class="grid formgrid">
            <div class="field col-12 md:col-6 mb-1">
              <label for="uiColor" class="block font-medium text-700 mb-2">Kode Warna Kotak (Hex)</label>
              <InputText id="uiColor" v-model="formData.ui.color" placeholder="#dc2626 Atau #3b82f6" class="w-full" />
            </div>

            <div class="field col-12 md:col-6 mb-1">
              <label for="uiHelp" class="block font-medium text-700 mb-2">Teks Bantuan (Hover Help)</label>
              <InputText id="uiHelp" v-model="formData.ui.helpText" placeholder="Petunjuk Singkat" class="w-full" />
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <div class="flex justify-content-end gap-2 pr-2 py-3 border-top-1 surface-border border-round-bottom">
          <Button label="Batal" icon="pi pi-times" class="p-button-text p-button-secondary" @click="closeModal" />
          <Button label="Simpan Perubahan Rule" icon="pi pi-check" class="p-button-primary" @click="saveRule" />
        </div>
      </template>
    </Dialog>
  </span>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import InputSwitch from 'primevue/inputswitch';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import prepClosingApi from '../../services/prepClosing.service';

const props = defineProps({
  visible: { type: Boolean, default: false },
  ruleData: { type: Object, default: null },
  operators: { type: Object, default: () => ({}) },
  categories: { type: Object, default: () => ({}) },
  severities: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['update:visible', 'save']);

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

const isEditMode = computed(() => !!props.ruleData);

// Options formulation from injected props
const categoryOptions = computed(() => {
  return Object.keys(props.categories).map(k => ({ value: k, label: props.categories[k].label || k }));
});

const severityOptions = computed(() => {
  return Object.keys(props.severities).map(k => ({ value: k, label: props.severities[k].label || k }));
});

const operatorOptions = computed(() => {
  return Object.keys(props.operators).map(k => ({ value: k, label: `${k} - ${props.operators[k].label || ''}` }));
});

const getSeverityBadge = (sev) => {
  if (sev === 'critical') return 'danger';
  if (sev === 'high') return 'warning';
  if (sev === 'medium') return 'info';
  return 'success';
};

const defaultTemplate = () => ({
  key: "",
  name: "",
  description: "",
  category: "wrc_data",
  priority: 99,
  enabled: true,
  query: { type: "calculation", sql: "" },
  validation: {
    type: "equals",
    operator: "EQUALS",
    expected: "",
    passMessage: "Data sudah sesuai",
    failMessage: "Terjadi kesalahan: {actual}",
  },
  severity: "medium",
  ui: {
    icon: "pi pi-cog",
    color: "#3b82f6",
    helpText: "",
    fixable: false,
    expandable: true
  },
  metadata: { impactArea: "General", estimatedFixTime: "Manual Check" }
});

const formData = ref(defaultTemplate());
const wrcKeysOptions = ref([]);

const expectedOptions = computed(() => {
  return [
    { label: 'Angka 0 (Nol)', value: '0' },
    { label: 'Opsi Ya (ON)', value: 'ON' },
    { label: 'Periode {year}', value: '{year}' },
    ...wrcKeysOptions.value
  ];
});

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    // Fetch WRC Rules to populate keys dynamically
    try {
      const res = await prepClosingApi.getWrcExtractRules();
      wrcKeysOptions.value = (res.data || []).map(r => ({
        label: `[Data WRC] ${r.name}`,
        value: `{${r.key}}`
      }));
    } catch(e) {
      console.error("Gagal load WRC keys", e);
    }

    if (props.ruleData) {
      // Deep clone rule data for editing
      formData.value = JSON.parse(JSON.stringify(props.ruleData));
      // Guard missing structures
      if (!formData.value.query) formData.value.query = { sql: "" };
      if (!formData.value.validation) formData.value.validation = {};
      if (!formData.value.ui) formData.value.ui = {};
    } else {
      formData.value = defaultTemplate();
    }
  }
});

const closeModal = () => {
  visible.value = false;
};

const resetForm = () => {
  formData.value = defaultTemplate();
};

const saveRule = () => {
  if (!formData.value.key || !formData.value.name) {
    // Should ideally use a toast here
    alert("Key & Nama Rule wajib diisi!");
    return;
  }
  
  if (['IS_NULL', 'IS_NOT_NULL'].includes(formData.value.validation.operator)) {
    formData.value.validation.expected = null;
  }
  
  emit('save', JSON.parse(JSON.stringify(formData.value)));
  closeModal();
};

</script>
