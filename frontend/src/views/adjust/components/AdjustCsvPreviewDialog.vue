<template>
  <div v-if="show" class="modal-backdrop"></div>
  <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Preview & Validasi CSV</h5>
          <button type="button" class="modal-close" @click="handleCancel">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="file-summary">
            <div class="file-info">
              <i class="pi pi-file"></i>
              <span class="file-name">{{ fileName }}</span>
            </div>
            <div class="row-count">
              <i class="pi pi-list"></i>
              <span>Total baris: {{ totalRows }}</span>
            </div>
          </div>

          <div class="validation-section">
            <div class="validation-header">
              <i class="pi pi-check-circle"></i>
              <span>Validasi Format Header</span>
            </div>
            <div class="header-badges">
              <span v-for="h in requiredHeaders" :key="h" :class="['header-badge', headers.includes(h) ? 'ok' : 'missing']">
                {{ h }}
              </span>
            </div>
            <div class="validation-details">
              <div v-if="missingHeaders.length" class="validation-item warn">
                <i class="pi pi-exclamation-triangle"></i>
                <span>Header wajib tidak ditemukan: {{ missingHeaders.join(', ') }}</span>
              </div>
              <div v-if="extraHeaders.length" class="validation-item info">
                <i class="pi pi-info-circle"></i>
                <span>Header tambahan: {{ extraHeaders.join(', ') }}</span>
              </div>
            </div>
          </div>

          <div class="field-summary">
            <div class="summary-item" v-for="h in requiredHeaders" :key="h">
              <div class="summary-label">{{ h }}</div>
              <div class="summary-value">Kosong: {{ blankCounts[h] || 0 }}</div>
            </div>
          </div>

          <div class="table-section">
            <div class="table-header">
              <h6>Preview Data</h6>
              <div class="table-actions" v-if="extraHeaders.length">
                <label class="toggle-all">
                  <input type="checkbox" v-model="showAllColumns" />
                  <span>Lihat semua kolom</span>
                </label>
              </div>
            </div>
            <DataTable :value="previewRows" :scrollable="true" scrollHeight="300px" stripedRows class="preview-table"
              :paginator="true" :rows="10" :rowsPerPageOptions="[10, 20, 50, 100]"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
              currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries">
              <Column field="KDTK" header="KDTK" />
              <Column field="PRDCD" header="PRDCD" />
              <Column field="QTY_ADJ" header="QTY_ADJ" />
              <Column field="KETER" header="KETER" />
              <template v-if="showAllColumns">
                <Column v-for="col in extraHeaders" :key="col" :field="col" :header="col" />
              </template>
              <template #empty>
                <div class="empty-state">
                  <i class="pi pi-inbox"></i>
                  <span>Tidak ada data untuk ditampilkan</span>
                </div>
              </template>
            </DataTable>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleCancel">
            <i class="pi pi-times"></i>
            Batal
          </button>
          <button type="button" class="btn btn-primary" :disabled="missingHeaders.length > 0 || totalRows === 0" @click="handleConfirm">
            <i class="pi pi-check"></i>
            Setujui & Siap Proses
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

const props = defineProps({
  show: { type: Boolean, default: false },
  fileName: { type: String, default: '' },
  headers: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  totalRows: { type: Number, default: 0 },
  requiredHeaders: { type: Array, default: () => ['KDTK','PRDCD','QTY_ADJ','KETER'] }
});

const emit = defineEmits(['cancel','confirm']);

const showAllColumns = ref(false);

const missingHeaders = computed(() => props.requiredHeaders.filter(h => !props.headers.includes(h)));
const extraHeaders = computed(() => props.headers.filter(h => !props.requiredHeaders.includes(h)));

const blankCounts = computed(() => {
  const counts = {};
  for (const h of props.requiredHeaders) {
    counts[h] = props.rows.filter(r => !r[h] && r[h] !== 0).length;
  }
  return counts;
});

const previewRows = computed(() => props.rows);

const handleCancel = () => emit('cancel');
const handleConfirm = () => emit('confirm');
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1040;
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease-out;
}
.modal.show { opacity: 1; visibility: visible; }
.modal-dialog { width: 92%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; }
.modal-content { background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.2); overflow: hidden; display: flex; flex-direction: column; height: 100%; }
.modal-header { padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; display: flex; justify-content: space-between; align-items: center; }
.modal-title { margin: 0; font-size: 1.15rem; font-weight: 600; }
.modal-close { background: none; border: none; color: white; font-size: 1.1rem; cursor: pointer; padding: 0.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
.modal-body { padding: 1.25rem 1.5rem; flex: 1; overflow-y: auto; min-height: 0; }
.modal-footer { padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; }

.file-summary { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.file-info { display: flex; align-items: center; gap: 0.5rem; color: #1e293b; }
.file-name { font-weight: 600; }
.row-count { display: flex; align-items: center; gap: 0.5rem; color: #334155; }

.validation-section { border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; background: #fff; }
.validation-header { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; }
.header-badges { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.header-badge { padding: 0.35rem 0.6rem; border-radius: 999px; font-size: 0.8rem; border: 1px solid #e2e8f0; }
.header-badge.ok { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.header-badge.missing { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
.validation-details { margin-top: 0.5rem; display: grid; gap: 0.35rem; }
.validation-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.validation-item.warn { color: #b91c1c; }
.validation-item.info { color: #0ea5e9; }

.field-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
.summary-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem; }
.summary-label { font-weight: 600; color: #334155; margin-bottom: 0.25rem; }
.summary-value { color: #475569; }

.table-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; }
.table-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }
.table-actions { display: flex; align-items: center; gap: 0.5rem; }
.toggle-all { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #334155; }
.preview-table :deep(.p-datatable) { border-radius: 0 0 10px 10px; }
.empty-state { display: flex; align-items: center; gap: 0.5rem; color: #64748b; padding: 1rem; }

.btn { padding: 0.6rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; }
.btn-primary { background: var(--primary-color, #0ea5e9); color: #fff; }
.btn-secondary { background: #e2e8f0; color: #1f2937; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
