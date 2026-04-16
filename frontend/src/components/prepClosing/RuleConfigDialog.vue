<template>
  <div>
    <Dialog
      v-model:visible="visible"
      header="Konfigurasi Rule Engine (Prep Closing)"
      :modal="true"
      :style="{ width: '80vw', minWidth: '600px' }"
      :maximizable="true"
      class="rule-config-dialog"
    >
      <div v-if="loading" class="flex justify-content-center align-items-center p-5">
        <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
      </div>
      <div v-else>
        <div class="mb-3 flex justify-content-between align-items-center">
          <div>
            <h5 class="m-0 text-gray-700">Manajemen Rule Screening</h5>
            <small class="text-gray-500">
              Total: {{ rules.length }} Rule Aktif | Last Update: {{ formatDate(lastUpdated) }}
            </small>
          </div>
          <div class="flex gap-2">
            <Button 
              type="button" 
              label="Panduan" 
              icon="pi pi-book" 
              class="p-button-outlined p-button-info" 
              @click="showGuide = true"
            />
            <Button 
              type="button" 
              label="Tambah Rule" 
              icon="pi pi-plus" 
              class="p-button-success" 
              @click="openAddRule"
            />
          </div>
        </div>

        <DataTable 
          :value="rules" 
          v-model:filters="filters" 
          dataKey="key"
          :paginator="true" 
          :rows="10" 
          :globalFilterFields="['name', 'key', 'category', 'description']"
          class="p-datatable-sm"
          responsiveLayout="scroll"
          stripedRows
        >
          <template #header>
            <div class="flex justify-content-end">
              <span class="p-input-icon-left">
                <i class="pi pi-search" />
                <InputText v-model="filters['global'].value" placeholder="Cari Rule..." />
              </span>
            </div>
          </template>

          <Column field="enabled" header="Aktif" style="width: 5%">
            <template #body="slotProps">
              <InputSwitch 
                v-model="slotProps.data.enabled" 
                @change="toggleRuleStatus(slotProps.data)" 
              />
            </template>
          </Column>

          <Column field="name" header="Nama Rule" style="width: 25%" sortable>
            <template #body="slotProps">
              <div class="font-bold">{{ slotProps.data.name }}</div>
              <small class="text-gray-500">{{ slotProps.data.key }}</small>
            </template>
          </Column>

          <Column field="category" header="Kategori" style="width: 15%" sortable>
            <template #body="slotProps">
              <Badge :value="getCategoryLabel(slotProps.data.category)" severity="info" />
            </template>
          </Column>

          <Column field="severity" header="Severity" style="width: 15%" sortable>
            <template #body="slotProps">
              <Badge 
                :value="getSeverityLabel(slotProps.data.severity)" 
                :severity="getSeverityBadge(slotProps.data.severity)" 
              />
            </template>
          </Column>
          
          <Column field="validation.operator" header="Logika" style="width: 20%">
            <template #body="slotProps">
              <div class="flex align-items-center gap-1 text-sm border-1 border-300 p-1 border-round surface-100">
                <span class="font-bold text-xs">{{ slotProps.data.validation.operator }}</span>
                <span class="text-xs" v-if="slotProps.data.validation.expected">({{ slotProps.data.validation.expected }})</span>
              </div>
            </template>
          </Column>

          <Column header="Ops" style="width: 10%; text-align: center">
            <template #body="slotProps">
              <div class="flex gap-1 justify-content-center">
                <Button icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-primary" @click="openEditRule(slotProps.data)" v-tooltip.top="'Edit Rule'" />
                <Button icon="pi pi-trash" class="p-button-rounded p-button-text p-button-danger" @click="confirmDeleteRule(slotProps.data)" v-tooltip.top="'Hapus Rule'" />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="text-center p-4 text-gray-500">
              Tidak ada aturan yang ditemukan.
            </div>
          </template>
        </DataTable>
      </div>

      <!-- Footer Actions for Save Main Config -->
      <template #footer>
        <div class="flex justify-content-between w-full mt-2">
          <small class="text-orange-500 font-italic">* Perubahan langsung dapat di sinkronasikan ke screening selanjutnya</small>
          <div class="flex gap-2">
            <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="closeConfig" :disabled="saving" />
            <Button label="Simpan Semua" icon="pi pi-save" class="p-button-primary" @click="saveAllRules" :loading="saving" />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- Sub Components -->
    <RuleEditorModal 
      v-model:visible="showEditor" 
      :ruleData="selectedRule"
      :categories="categories"
      :severities="severities"
      :operators="operators"
      @save="handleSaveRule" 
    />
    <RuleGuideSidebar v-model:visible="showGuide" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useToastService } from '../../utils/toast';
import { prepClosingService } from '../../services';

// UI Components
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import InputSwitch from 'primevue/inputswitch';
import Badge from 'primevue/badge';

// Sub Components
import RuleEditorModal from './RuleEditorModal.vue';
import RuleGuideSidebar from './RuleGuideSidebar.vue';

const props = defineProps({
  visible: { type: Boolean, default: false }
});

const emit = defineEmits(['update:visible', 'rules-updated']);

const toast = useToastService();

// State
const loading = ref(false);
const saving = ref(false);
const rulesData = ref({});
const rules = ref([]);
const categories = ref({});
const severities = ref({});
const operators = ref({});
const lastUpdated = ref(null);

const showEditor = ref(false);
const showGuide = ref(false);
const selectedRule = ref(null);

const filters = ref({
  global: { value: null, matchMode: 'contains' },
});

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

watch(() => props.visible, async (newVal) => {
  if (newVal && rules.value.length === 0) {
    await fetchRulesConfig();
  }
});

const fetchRulesConfig = async () => {
  try {
    loading.value = true;
    const response = await prepClosingService.getRulesConfig();
    
    // response format may be encapsulated by proxy or {data, success}
    const data = response && response.data ? response.data : response;
    
    rulesData.value = data;
    rules.value = data.rules ? JSON.parse(JSON.stringify(data.rules)) : [];
    categories.value = data.categories || {};
    severities.value = data.severityLevels || {};
    operators.value = data.operators || {};
    lastUpdated.value = data.lastUpdated;
    
  } catch (error) {
    toast.showError('Error', 'Gagal memuat konfigurasi rule.');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const saveAllRules = async () => {
  try {
    saving.value = true;
    const payload = { ...rulesData.value };
    payload.rules = rules.value;
    
    const response = await prepClosingService.updateRulesConfig(payload);
    const updatedData = response && response.data ? response.data : response;
    
    lastUpdated.value = updatedData.lastUpdated;
    toast.showSuccess('Sukses', 'Berhasil menyimpan dan mensinkronisasikan Aturan Engine');
    emit('rules-updated');
    closeConfig();
  } catch (error) {
    toast.showError('Error', 'Gagal menyimpan perubahan.');
    console.error(error);
  } finally {
    saving.value = false;
  }
};

const closeConfig = () => {
  visible.value = false;
};

// Internal Modals Actions
const openAddRule = () => {
  selectedRule.value = null; // Create Mode
  showEditor.value = true;
};

const openEditRule = (ruleItem) => {
  selectedRule.value = { ...ruleItem };
  showEditor.value = true;
};

const confirmDeleteRule = (ruleItem) => {
  if (window.confirm(`Anda yakin ingin menghapus aturan ${ruleItem.name}?`)) {
     rules.value = rules.value.filter(r => r.key !== ruleItem.key);
     toast.showSuccess('Sukses Hapus', 'Aturan telah dihapus sementara, tekan Simpan Semua untuk permanenkan.');
  }
};

const handleSaveRule = (savedRule) => {
  const index = rules.value.findIndex(r => r.key === savedRule.key);
  if (index >= 0) { // Edit
    rules.value[index] = savedRule;
  } else { // Add
    rules.value.push(savedRule);
  }
};

const toggleRuleStatus = (ruleData) => {
  // It's mutating the variable directly (fine until saved via saveAllRules)
};

// Utilities
const getCategoryLabel = (cat) => {
  return categories.value[cat] ? categories.value[cat].label : cat;
};

const getSeverityLabel = (sev) => {
  return severities.value[sev] ? severities.value[sev].label : sev;
};

const getSeverityBadge = (sev) => {
  if (sev === 'critical') return 'danger';
  if (sev === 'high') return 'warning';
  if (sev === 'medium') return 'info';
  return 'success';
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};
</script>

<style scoped>
:deep(.p-datatable-sm .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.5rem;
}
.rule-config-dialog :deep(.p-dialog-footer) {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
}
</style>
