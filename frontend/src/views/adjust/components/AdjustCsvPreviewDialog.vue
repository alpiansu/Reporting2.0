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

          <!-- Duplicate PLU Alert -->
          <transition name="slide-fade">
            <div v-if="duplicateGroups.length" class="duplicate-alert-section">
              <div class="duplicate-alert-header">
                <div class="alert-icon-wrapper">
                  <i class="pi pi-exclamation-circle"></i>
                </div>
                <div class="alert-title-group">
                  <span class="alert-title">Ditemukan data yang duplikat sebanyak {{ duplicateGroups.length }} baris data</span>
                  <span class="alert-subtitle">Setiap kombinasi KDTK + PRDCD hanya boleh muncul satu kali. Harap perbaiki file CSV Anda.</span>
                </div>
                <button class="toggle-dup-btn" @click="showDuplicateDetails = !showDuplicateDetails">
                  <span>{{ showDuplicateDetails ? 'Sembunyikan' : 'Lihat' }} detail</span>
                  <i class="pi" :class="showDuplicateDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                </button>
              </div>

              <!-- Duplicate summary chips -->
              <div class="duplicate-chips">
                <span v-for="(group, idx) in duplicateGroups.slice(0, 8)" :key="idx" class="dup-chip">
                  <i class="pi pi-copy"></i>
                  <span class="dup-chip-kdtk">{{ group.kdtk }}</span>
                  <span class="dup-chip-sep">/</span>
                  <span class="dup-chip-prdcd">{{ group.prdcd }}</span>
                  <span class="dup-chip-count">{{ group.count }}×</span>
                </span>
                <span v-if="duplicateGroups.length > 8" class="dup-chip dup-chip-more">
                  +{{ duplicateGroups.length - 8 }} lainnya
                </span>
              </div>

              <!-- Expandable detail table -->
              <transition name="slide-fade">
                <div v-if="showDuplicateDetails" class="duplicate-details-table-wrapper">
                  <table class="duplicate-details-table">
                    <thead>
                      <tr>
                        <th>Baris</th>
                        <th>PRDCD</th>
                        <th>KDTK</th>
                        <th>QTY_ADJ</th>
                        <th>KETER</th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-for="(group, gIdx) in duplicateGroups" :key="gIdx">
                        <tr v-for="(row, rIdx) in group.rows" :key="`${gIdx}-${rIdx}`"
                            :class="{ 'group-separator': rIdx === 0 && gIdx > 0 }">
                          <td class="row-num-cell">
                            <span class="row-num-badge">{{ row._rowIndex }}</span>
                          </td>
                          <td class="prdcd-cell">
                            <span class="prdcd-badge">{{ row.PRDCD }}</span>
                          </td>
                          <td>{{ row.KDTK }}</td>
                          <td>{{ row.QTY_ADJ }}</td>
                          <td class="keter-cell" :title="row.KETER">{{ truncate(row.KETER, 40) }}</td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </transition>
            </div>
          </transition>

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
          <button type="button" class="btn btn-primary" :disabled="missingHeaders.length > 0 || totalRows === 0 || duplicateGroups.length > 0" :title="duplicateGroups.length > 0 ? 'Terdapat PLU duplikat — perbaiki file CSV terlebih dahulu' : ''" @click="handleConfirm">
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
  requiredHeaders: { type: Array, default: () => ['KDTK','PRDCD','QTY_ADJ','KETER','TGL_SELISIH'] }
});

const emit = defineEmits(['cancel','confirm']);

const showAllColumns = ref(false);
const searchQuery = ref('');
const showDuplicateDetails = ref(false);

const missingHeaders = computed(() => props.requiredHeaders.filter(h => !props.headers.includes(h)));
const extraHeaders = computed(() => props.headers.filter(h => !props.requiredHeaders.includes(h)));

const blankCounts = computed(() => {
  const counts = {};
  for (const h of props.requiredHeaders) {
    counts[h] = props.rows.filter(r => !r[h] && r[h] !== 0).length;
  }
  return counts;
});

// Detect duplicate entries — each KDTK + PRDCD combination must be unique
const duplicateGroups = computed(() => {
  const comboMap = {};
  props.rows.forEach((row, idx) => {
    const kdtk = row.KDTK != null ? String(row.KDTK).trim() : '';
    const prdcd = row.PRDCD != null ? String(row.PRDCD).trim() : '';
    if (!kdtk || !prdcd) return;
    const key = `${kdtk}||${prdcd}`;
    if (!comboMap[key]) comboMap[key] = { kdtk, prdcd, rows: [] };
    comboMap[key].rows.push({ ...row, _rowIndex: idx + 2 }); // +2 because row 1 is header, 0-based index
  });
  return Object.values(comboMap)
    .filter(g => g.rows.length > 1)
    .map(g => ({ ...g, count: g.rows.length }))
    .sort((a, b) => b.count - a.count);
});

const truncate = (text, max) => {
  if (!text) return '-';
  const s = String(text);
  return s.length > max ? s.substring(0, max) + '...' : s;
};

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
.table-actions { display: flex; align-items: center; gap: 1rem; }
.search-wrapper { position: relative; display: flex; align-items: center; }
.search-wrapper i { position: absolute; left: 0.75rem; color: #64748b; font-size: 0.9rem; }
.search-input { padding: 0.5rem 0.5rem 0.5rem 2rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; width: 200px; }
.search-input:focus { border-color: #0ea5e9; }
.toggle-all { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #334155; }
.preview-table :deep(.p-datatable) { border-radius: 0 0 10px 10px; }
.empty-state { display: flex; align-items: center; gap: 0.5rem; color: #64748b; padding: 1rem; }

.btn { padding: 0.6rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; }
.btn-primary { background: var(--primary-color, #0ea5e9); color: #fff; }
.btn-secondary { background: #e2e8f0; color: #1f2937; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Duplicate PLU Alert */
.duplicate-alert-section { border: 1px solid #fecaca; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem; background: linear-gradient(135deg, #fff5f5 0%, #fff 60%); }
.duplicate-alert-header { display: flex; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; }
.alert-icon-wrapper { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #fee2e2; color: #dc2626; flex-shrink: 0; }
.alert-icon-wrapper i { font-size: 1.1rem; }
.alert-title-group { flex: 1; min-width: 0; }
.alert-title { display: block; font-weight: 700; color: #b91c1c; font-size: 0.95rem; }
.alert-subtitle { display: block; color: #991b1b; font-size: 0.82rem; margin-top: 0.15rem; opacity: 0.85; }
.toggle-dup-btn { background: none; border: 1px solid #fecaca; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #b91c1c; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: background 0.2s; white-space: nowrap; }
.toggle-dup-btn:hover { background: #fee2e2; }

.duplicate-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem; }
.dup-chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.dup-chip i { font-size: 0.7rem; opacity: 0.7; }
.dup-chip-kdtk { font-weight: 700; }
.dup-chip-sep { opacity: 0.4; margin: 0 0.05rem; }
.dup-chip-prdcd { font-weight: 600; }
.dup-chip-count { background: #dc2626; color: #fff; border-radius: 999px; padding: 0.1rem 0.4rem; font-size: 0.7rem; font-weight: 700; margin-left: 0.15rem; }
.dup-chip-more { background: #fef2f2; color: #b91c1c; border-style: dashed; }

.duplicate-details-table-wrapper { margin-top: 0.75rem; border-radius: 8px; overflow: hidden; border: 1px solid #fecaca; max-height: 240px; overflow-y: auto; }
.duplicate-details-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.duplicate-details-table th { background: #fef2f2; color: #991b1b; font-weight: 600; padding: 0.5rem 0.75rem; text-align: left; position: sticky; top: 0; z-index: 1; border-bottom: 1px solid #fecaca; }
.duplicate-details-table td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
.duplicate-details-table tr:hover td { background: #fafafa; }
.duplicate-details-table tr.group-separator td { border-top: 2px solid #fecaca; }
.row-num-cell { text-align: center; }
.row-num-badge { display: inline-block; background: #f1f5f9; color: #475569; border-radius: 4px; padding: 0.15rem 0.45rem; font-size: 0.75rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.prdcd-cell { font-weight: 600; }
.prdcd-badge { background: #fee2e2; color: #991b1b; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
.keter-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.25s ease; }
.slide-fade-enter-from, .slide-fade-leave-to { opacity: 0; max-height: 0; overflow: hidden; }
.slide-fade-enter-to, .slide-fade-leave-from { opacity: 1; max-height: 600px; }
</style>
