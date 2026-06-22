<template>
  <div>
    <Dialog
      v-model:visible="visible"
      :modal="true"
      :style="{ width: '80vw', minWidth: '680px' }"
      :maximizable="true"
      :breakpoints="{ '960px': '92vw', '640px': '100vw' }"
      class="rule-config-dialog"
      :draggable="false"
    >
      <template #header>
        <div class="dialog-custom-header">
          <div class="header-icon-wrapper">
            <i class="pi pi-cog text-xl"></i>
          </div>
          <div class="header-text">
            <h3 class="header-title">Rule Engine Configuration</h3>
            <span class="header-subtitle">Kelola rule screening untuk validasi kesiapan closing</span>
          </div>
        </div>
      </template>

      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
        <p class="mt-3 text-color-secondary">Memuat konfigurasi rule...</p>
      </div>

      <div v-else class="dialog-body">
        <!-- Stats Bar -->
        <div class="stats-bar">
          <div class="stat-chip">
            <i class="pi pi-list-check"></i>
            <span>{{ rules.length }} Rule Aktif</span>
          </div>
          <div class="stat-chip stat-chip-muted">
            <i class="pi pi-clock"></i>
            <span>Update: {{ formatDate(lastUpdated) }}</span>
          </div>
          <div class="stat-actions">
            <Button type="button" label="Panduan" icon="pi pi-book" class="p-button-outlined p-button-sm p-button-info" @click="showGuide = true" />
            <Button type="button" label="Tambah Rule" icon="pi pi-plus" class="p-button-success p-button-sm" @click="openAddRule" />
          </div>
        </div>

        <!-- Rules Table -->
        <DataTable
          :value="rules"
          v-model:filters="filters"
          dataKey="key"
          :paginator="true"
          :rows="8"
          :globalFilterFields="['name', 'key', 'category', 'description']"
          class="p-datatable-sm rules-table"
          responsiveLayout="scroll"
          stripedRows
          :showGridlines="false"
        >
          <template #header>
            <div class="flex justify-content-between align-items-center w-full">
              <span class="p-input-icon-left">
                <i class="pi pi-search" />
                <InputText v-model="filters['global'].value" placeholder="Cari rule..." class="p-inputtext-sm" />
              </span>
            </div>
          </template>

          <Column field="enabled" header="Aktif" style="width: 6%; text-align: center">
            <template #body="slotProps">
              <InputSwitch v-model="slotProps.data.enabled" @change="toggleRuleStatus(slotProps.data)" />
            </template>
          </Column>

          <Column field="name" header="Rule" style="width: 28%" sortable>
            <template #body="slotProps">
              <div class="rule-name-cell">
                <span class="rule-name">{{ slotProps.data.name }}</span>
                <small class="rule-key">{{ slotProps.data.key }}</small>
              </div>
            </template>
          </Column>

          <Column field="category" header="Kategori" style="width: 14%" sortable>
            <template #body="slotProps">
              <Tag :value="getCategoryLabel(slotProps.data.category)" severity="info" class="text-xs" />
            </template>
          </Column>

          <Column field="severity" header="Severity" style="width: 13%" sortable>
            <template #body="slotProps">
              <Tag
                :value="getSeverityLabel(slotProps.data.severity)"
                :severity="getSeverityBadge(slotProps.data.severity)"
                class="text-xs"
              />
            </template>
          </Column>

          <Column field="validation.operator" header="Logika" style="width: 22%">
            <template #body="slotProps">
              <div class="logic-chip">
                <span class="logic-operator">{{ slotProps.data.validation.operator }}</span>
                <span v-if="slotProps.data.validation.expected" class="logic-expected">{{ slotProps.data.validation.expected }}</span>
              </div>
            </template>
          </Column>

          <Column header="Aksi" style="width: 10%; text-align: center">
            <template #body="slotProps">
              <div class="flex gap-1 justify-content-center">
                <Button icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-primary p-button-sm" @click="openEditRule(slotProps.data)" v-tooltip.top="'Edit'" />
                <Button icon="pi pi-trash" class="p-button-rounded p-button-text p-button-danger p-button-sm" @click="confirmDeleteRule(slotProps.data)" v-tooltip.top="'Hapus'" />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox text-4xl text-300"></i>
              <p>Tidak ada rule yang ditemukan</p>
            </div>
          </template>
        </DataTable>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <small class="footer-hint">
            <i class="pi pi-info-circle"></i> Perubahan langsung disinkronkan ke screening selanjutnya
          </small>
          <div class="footer-actions">
            <Button label="Tutup" icon="pi pi-times" class="p-button-text p-button-secondary" @click="closeConfig" :disabled="saving" />
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

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="Hapus Rule"
      :message="`Apakah Anda yakin ingin menghapus rule '${ruleToDelete?.name || ''}'?`"
      confirm-text="Hapus"
      @confirm="executeDeleteRule"
    />
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
import Tag from 'primevue/tag';
import ConfirmDialog from '../common/ConfirmDialog.vue';

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
const showDeleteConfirm = ref(false);
const ruleToDelete = ref(null);

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
  ruleToDelete.value = ruleItem;
  showDeleteConfirm.value = true;
};

const executeDeleteRule = () => {
  if (!ruleToDelete.value) return;
  rules.value = rules.value.filter(r => r.key !== ruleToDelete.value.key);
  toast.showSuccess('Sukses Hapus', 'Aturan telah dihapus sementara, tekan Simpan Semua untuk permanenkan.');
  ruleToDelete.value = null;
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
/* === Custom Header === */
.dialog-custom-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.625rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  flex-shrink: 0;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.header-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.header-subtitle {
  font-size: 0.8rem;
  color: #64748b;
}

/* === Loading === */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

/* === Stats Bar === */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #3b82f6;
  padding: 0.25rem 0.625rem;
  background: #eff6ff;
  border-radius: 1rem;
}

.stat-chip i {
  font-size: 0.8rem;
}

.stat-chip-muted {
  color: #64748b;
  background: #f1f5f9;
}

.stat-actions {
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
}

/* === Rule Name Cell === */
.rule-name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.rule-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: #1e293b;
}

.rule-key {
  font-size: 0.72rem;
  color: #94a3b8;
  font-family: 'Courier New', monospace;
}

/* === Logic Chip === */
.logic-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.78rem;
}

.logic-operator {
  font-weight: 700;
  color: #475569;
}

.logic-expected {
  color: #64748b;
}

.logic-expected::before {
  content: '(';
}
.logic-expected::after {
  content: ')';
}

/* === Empty State === */
.empty-state {
  text-align: center;
  padding: 2.5rem 1rem;
  color: #94a3b8;
}

.empty-state i {
  display: block;
  margin-bottom: 0.75rem;
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-top: 0.5rem;
}

.footer-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #94a3b8;
  font-size: 0.78rem;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

/* === Table overrides === */
:deep(.rules-table .p-datatable-tbody > tr > td) {
  padding: 0.625rem 0.75rem;
}

:deep(.rules-table .p-datatable-thead > tr > th) {
  padding: 0.625rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  background: #f8fafc;
}

:deep(.p-dialog-footer) {
  border-top: 1px solid #f1f5f9;
}

@media (max-width: 768px) {
  .stats-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .stat-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }
  .dialog-footer {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }
  .footer-actions {
    justify-content: flex-end;
  }
}
</style>
