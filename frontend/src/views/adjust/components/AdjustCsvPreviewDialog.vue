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
                        <th>TGL_SELISIH</th>
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
                          <td :title="row.TGL_SELISIH">{{ row.TGL_SELISIH }}</td>
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
            <div class="summary-item" v-for="h in requiredHeaders" :key="h" :class="{ 'has-error': fieldErrors[h] > 0 }">
              <div class="summary-label">{{ h }}</div>
              <div class="summary-value" v-if="fieldErrors[h] > 0">
                <span class="error-text"><i class="pi pi-exclamation-triangle"></i> {{ fieldErrors[h] }} error</span>
              </div>
              <div class="summary-value" v-else-if="blankCounts[h] > 0">
                <span class="warn-text">Kosong: {{ blankCounts[h] }}</span>
              </div>
              <div class="summary-value" v-else>
                <span class="ok-text"><i class="pi pi-check-circle"></i> OK</span>
              </div>
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
              <Column field="QTY_ADJ" header="QTY_ADJ" style="width:100px" />
              <Column field="KETER" header="KETER" />
              <Column field="TGL_SELISIH" header="TGL_SELISIH" style="width:120px" />
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
          <button type="button" class="btn btn-primary" :disabled="missingHeaders.length > 0 || totalRows === 0 || duplicateGroups.length > 0 || hasFieldErrors" :title="hasFieldErrors ? 'Terdapat error pada data — perbaiki isi CSV Anda' : duplicateGroups.length > 0 ? 'Terdapat PLU duplikat — perbaiki file CSV terlebih dahulu' : ''" @click="handleConfirm">
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

const fieldErrors = computed(() => {
  const errors = { KDTK: 0, PRDCD: 0, QTY_ADJ: 0, KETER: 0, TGL_SELISIH: 0 };
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const row of props.rows) {
    if (!row.KDTK || !String(row.KDTK).trim()) errors.KDTK++;
    if (!row.PRDCD || !String(row.PRDCD).trim()) errors.PRDCD++;
    if (row.QTY_ADJ === '' || row.QTY_ADJ == null || isNaN(Number(row.QTY_ADJ))) errors.QTY_ADJ++;
    if (!row.KETER || !String(row.KETER).trim()) errors.KETER++;
    if (!row.TGL_SELISIH || !dateRegex.test(String(row.TGL_SELISIH).trim())) errors.TGL_SELISIH++;
  }
  return errors;
});

const hasFieldErrors = computed(() => Object.values(fieldErrors.value).some(c => c > 0));

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

<style scoped src="./AdjustCsvPreviewDialog.style.css"></style>
