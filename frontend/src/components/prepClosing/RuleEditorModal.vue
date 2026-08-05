<template>
  <span>
    <Dialog
      v-model:visible="visible"
      :modal="true"
      :style="{ width: '60vw', minWidth: '620px' }"
      :maximizable="true"
      :breakpoints="{'960px': '80vw', '640px': '95vw'}"
      @hide="resetForm"
      class="rule-editor-dialog"
      :draggable="false"
    >
      <template #header>
        <div class="editor-header">
          <div class="editor-header-icon" :class="isEditMode ? 'edit-mode' : 'add-mode'">
            <i :class="isEditMode ? 'pi pi-pencil' : 'pi pi-plus'"></i>
          </div>
          <div class="editor-header-text">
            <h3 class="header-title">{{ isEditMode ? 'Edit Rule Specification' : 'Create New Rule' }}</h3>
            <span class="header-subtitle">{{ isEditMode ? 'Perbarui parameter rule yang ada' : 'Definisikan rule screening baru' }}</span>
          </div>
        </div>
      </template>

      <div class="editor-body">
        <!-- Validation Alert -->
        <div v-if="validationError" class="validation-alert">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ validationError }}</span>
        </div>

        <!-- Section 1: General Settings -->
        <div class="form-section">
          <div class="section-header section-blue">
            <div class="section-icon">
              <i class="pi pi-info-circle"></i>
            </div>
            <div>
              <h5 class="section-title">General Information</h5>
              <p class="section-desc">Identitas dan metadata rule</p>
            </div>
          </div>

          <div class="section-body">
            <div class="form-grid">
              <div class="field-group">
                <label for="ruleKey">Key ID <span class="required">*</span></label>
                <InputText id="ruleKey" v-model="formData.key" :disabled="isEditMode" placeholder="e.g. saldo_minus_check" class="w-full" />
                <small v-if="!isEditMode" class="field-hint">Gunakan <strong>generic_sql_check</strong> untuk Raw SQL kustom.</small>
              </div>

              <div class="field-group">
                <label for="ruleName">Nama Rule <span class="required">*</span></label>
                <InputText id="ruleName" v-model="formData.name" placeholder="Nama Deskriptif" class="w-full" />
              </div>

              <div class="field-group">
                <label for="category">Kategori Engine</label>
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

              <div class="field-group">
                <label for="severity">Severity Level</label>
                <Dropdown
                  id="severity"
                  v-model="formData.severity"
                  :options="severityOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                >
                  <template #value="slotProps">
                    <Tag v-if="slotProps.value" :value="slotProps.value" :severity="getSeverityBadge(slotProps.value)" class="text-xs" />
                  </template>
                </Dropdown>
              </div>

              <div class="field-group full-width">
                <label for="description">Deskripsi</label>
                <Textarea id="description" v-model="formData.description" rows="2" autoResize class="w-full" placeholder="Jelaskan tujuan rule ini..." />
              </div>

              <div class="field-group full-width">
                <div class="toggle-row">
                  <InputSwitch id="enabled" v-model="formData.enabled" />
                  <div>
                    <label for="enabled" class="toggle-label">Status Rule Diaktifkan</label>
                    <small class="field-hint">Nonaktifkan untuk skip rule saat screening.</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Query & Validation -->
        <div class="form-section">
          <div class="section-header section-amber">
            <div class="section-icon">
              <i class="pi pi-database"></i>
            </div>
            <div>
              <h5 class="section-title">Query & Validation Logic</h5>
              <p class="section-desc">Konfigurasi SQL dan logika pembanding</p>
            </div>
          </div>

          <div class="section-body">
            <div class="form-grid">
              <div class="field-group full-width">
                <label for="querySql">Raw SQL Query</label>
                <Textarea
                  id="querySql"
                  v-model="formData.query.sql"
                  rows="3"
                  class="w-full sql-textarea"
                  placeholder="SELECT ... FROM ... WHERE ...='{cabang}'"
                />
                <small class="field-hint">Variabel: <code>{cabang}</code>, <code>{periode}</code>, <code>{year}</code>, <code>{kdtk}</code></small>
              </div>

              <div class="field-group">
                <label for="validatorOp">Operator Pembanding</label>
                <Dropdown
                  id="validatorOp"
                  v-model="formData.validation.operator"
                  :options="operatorOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Pilih Operator"
                  class="w-full"
                />
              </div>

              <div class="field-group">
                <label for="valExpected" :class="{ 'label-disabled': ['IS_NULL', 'IS_NOT_NULL'].includes(formData.validation.operator) }">Expected Value</label>
                <Dropdown
                  id="valExpected"
                  v-model="formData.validation.expected"
                  :options="expectedOptions"
                  optionLabel="label"
                  optionValue="value"
                  :editable="true"
                  placeholder="Target value"
                  class="w-full"
                  :disabled="['IS_NULL', 'IS_NOT_NULL'].includes(formData.validation.operator)"
                />
              </div>

              <div class="field-group">
                <label for="passMessage">Feedback Sukses (Pass)</label>
                <InputText id="passMessage" v-model="formData.validation.passMessage" placeholder="Pesan bila sesuai ekspektasi" class="w-full" />
              </div>

              <div class="field-group">
                <label for="failMessage">Feedback Gagal (Fail)</label>
                <InputText id="failMessage" v-model="formData.validation.failMessage" placeholder="Misal: Ditemukan {actual} anomali" class="w-full" />
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Appearance -->
        <div class="form-section">
          <div class="section-header section-violet">
            <div class="section-icon">
              <i class="pi pi-palette"></i>
            </div>
            <div>
              <h5 class="section-title">Dashboard Appearance</h5>
              <p class="section-desc">Tampilan rule di dashboard monitoring</p>
            </div>
          </div>

          <div class="section-body">
            <div class="form-grid">
              <div class="field-group">
                <label for="uiColor">Warna Kotak (Hex)</label>
                <div class="color-input-row">
                  <div class="color-preview" :style="{ background: formData.ui.color || '#3b82f6' }"></div>
                  <InputText id="uiColor" v-model="formData.ui.color" placeholder="#dc2626" class="w-full" />
                </div>
              </div>

              <div class="field-group">
                <label for="uiHelp">Teks Bantuan (Hover)</label>
                <InputText id="uiHelp" v-model="formData.ui.helpText" placeholder="Petunjuk Singkat" class="w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="editor-footer">
          <Button label="Batal" icon="pi pi-times" class="p-button-text p-button-secondary" @click="closeModal" />
          <Button :label="isEditMode ? 'Simpan Perubahan' : 'Buat Rule'" icon="pi pi-check" class="p-button-primary" @click="saveRule" />
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
import Tag from 'primevue/tag';
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

const validationError = ref('');

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
    validationError.value = '';
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
      formData.value = JSON.parse(JSON.stringify(props.ruleData));
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
  validationError.value = '';
};

const saveRule = () => {
  if (!formData.value.key || !formData.value.name) {
    validationError.value = 'Key ID dan Nama Rule wajib diisi.';
    return;
  }

  if (['IS_NULL', 'IS_NOT_NULL'].includes(formData.value.validation.operator)) {
    formData.value.validation.expected = null;
  }

  emit('save', JSON.parse(JSON.stringify(formData.value)));
  closeModal();
};

</script>

<style scoped src="./RuleEditorModal.style.css"></style>
