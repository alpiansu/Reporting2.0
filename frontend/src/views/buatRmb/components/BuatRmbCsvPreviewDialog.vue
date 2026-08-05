<template>
  <div v-if="show" class="modal-backdrop"></div>
  <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Preview & Validasi CSV RMB</h5>
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
              <div class="table-actions">
                <div class="search-wrapper">
                  <i class="pi pi-search"></i>
                  <input type="text" v-model="searchQuery" placeholder="Cari data..." class="search-input" />
                </div>
                <label class="toggle-all" v-if="extraHeaders.length">
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
              <Column field="TANGGAL" header="TANGGAL" />
              <Column field="PRDCD" header="PRDCD" />
              <Column field="NOHP" header="NOHP" />
              <Column field="TRXID" header="TRXID" />
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
  requiredHeaders: { type: Array, default: () => ['KDTK', 'TANGGAL', 'PRDCD', 'NOHP', 'TRXID'] }
});

const emit = defineEmits(['cancel','confirm']);

const showAllColumns = ref(false);
const searchQuery = ref('');

const missingHeaders = computed(() => props.requiredHeaders.filter(h => !props.headers.includes(h)));
const extraHeaders = computed(() => props.headers.filter(h => !props.requiredHeaders.includes(h)));

const blankCounts = computed(() => {
  const counts = {};
  for (const h of props.requiredHeaders) {
    counts[h] = props.rows.filter(r => !r[h] && r[h] !== 0).length;
  }
  return counts;
});

// Standalone function for live search
const calculateFilteredRows = (rows, query) => {
  if (!query) return rows;
  const lowerQuery = query.toLowerCase();
  return rows.filter(row => {
    return Object.values(row).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery)
    );
  });
};

const previewRows = computed(() => {
  return calculateFilteredRows(props.rows, searchQuery.value);
});

const handleCancel = () => emit('cancel');
const handleConfirm = () => emit('confirm');
</script>

<style scoped src="./BuatRmbCsvPreviewDialog.style.css"></style>
