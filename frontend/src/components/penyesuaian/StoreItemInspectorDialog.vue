<template>
  <BaseModalDetail :show="show" :title="'Detail Item: ' + prdcd" icon="pi pi-box" size="full" @close="$emit('close')">
    <template #header-info>
      <div class="inspector-header">
        <div class="info-grid">
          <div class="info-item"><span class="info-label">Toko</span><span class="info-value">{{ kdtk }}</span></div>
          <div class="info-item"><span class="info-label">Cabang</span><span class="info-value">{{ cab }}</span></div>
          <div class="info-item"><span class="info-label">Periode</span><span class="info-value">{{ periode || 'Semua' }}</span></div>
          <div class="info-item"><span class="info-label">PRDCD</span><span class="info-value prdcd-value">{{ prdcd }}</span></div>
        </div>
        <div v-if="acostNum > 0" class="begbal-row">
          <div class="begbal-box">
            <span class="b-label">BEGBAL</span>
            <span class="b-value" :class="begbalDevClass">{{ begbalFormatted }}</span>
          </div>
          <div class="begbal-box">
            <span class="b-label">ACOST</span>
            <span class="b-value">{{ acostFormatted }}</span>
          </div>
          <div class="begbal-box" v-if="begbalDev !== null">
            <span class="b-label">Deviasi</span>
            <span class="b-value" :class="begbalDevClass">{{ begbalDevPct }}</span>
          </div>
        </div>
      </div>
    </template>
    <template #content>
      <div v-if="loading" class="loading-section">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
        <p>Mengambil data dari toko {{ kdtk }}...</p>
      </div>
      <div v-else-if="error" class="error-section">
        <i class="pi pi-exclamation-triangle" style="font-size: 2rem"></i>
        <p>{{ error }}</p>
      </div>
      <div v-else class="inspector-content">
        <!-- Summary Warnings -->
        <div v-if="summary.totalWarnings > 0" class="summary-bar">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ summary.totalWarnings }} kecurigaan ditemukan</span>
          <span v-for="(g, key) in criticalGroups" :key="key" class="crit-badge">{{ g }}</span>
        </div>
        <div v-else class="summary-bar summary-ok">
          <i class="pi pi-check-circle"></i>
          <span>Tidak ada kecurigaan pada data item ini</span>
        </div>

        <!-- PRODMAST -->
        <div class="section">
          <div class="section-header">
            <i class="pi pi-database"></i>
            <h4>PRODMAST</h4>
            <span v-if="data.prodmast?.supco" class="bkl-badge">BKL</span>
            <span v-if="prodmastWarnings.length" class="warn-badge">{{ prodmastWarnings.length }}</span>
          </div>
          <div v-if="data.prodmast" class="prodmast-card">
            <div class="pm-row" v-for="(val, key) in data.prodmast" :key="key">
              <span class="pm-key">{{ key }}</span>
              <span class="pm-val">{{ val }}</span>
            </div>
            <div v-if="prodmastWarnings.length" class="pm-warnings">
              <div v-for="(w, i) in prodmastWarnings" :key="i" class="pm-warn-item">
                <i class="pi pi-exclamation-triangle"></i> {{ w }}
              </div>
            </div>
          </div>
          <div v-else class="empty-section">Produk tidak ditemukan di prodmast</div>
        </div>

        <!-- MSTRAN Groups -->
        <div v-if="data.mstran?.rows?.length" class="section-group">
          <div class="section-header">
            <i class="pi pi-list"></i>
            <h4>MSTRAN ({{ data.mstran.rows.length }})</h4>
            <span v-if="data.mstran.totalWarnings" class="warn-badge">{{ data.mstran.totalWarnings }} warning</span>
          </div>
          <div v-for="(group, gkey) in mstranGroups" :key="gkey" class="group-card">
            <div class="group-header" :class="{ 'group-warn': group.warningCount > 0, 'group-critical': group.deviation > 0.5 && group.count > 0 }">
              <div class="gh-top">
                <span class="gh-label">{{ group.label }}</span>
                <span class="gh-mapping" v-if="group.mapping">→ {{ group.mapping.toUpperCase() }}</span>
                <span class="gh-count">{{ group.count }} row(s)</span>
                <span v-if="group.warningCount" class="warn-badge">{{ group.warningCount }} ⚠</span>
                <span v-if="group.deviation > 0.5 && group.count" class="crit-badge">DEVIASI TINGGI</span>
              </div>
              <div v-if="group.count" class="gh-aggr">
                <span>Qty: <strong>{{ fmt(group.totalQty) }}</strong></span>
                <span>Rp: <strong>{{ fmt(group.totalRupiah) }}</strong></span>
                <span v-if="group.unitPrice > 0">
                  Unit: <strong class="unit-price" :class="priceClass(group.unitPrice)">{{ fmt(group.unitPrice) }}</strong>
                </span>
                <span v-if="acostNum > 0 && group.unitPrice > 0">
                  ACOST: <strong>{{ fmt(acostNum) }}</strong>
                  Dev: <strong :class="devClass(group.deviation)">{{ (group.deviation * 100).toFixed(1) }}%</strong>
                </span>
              </div>
            </div>
            <div v-if="group.count" class="group-table-wrap">
              <table class="inspector-table">
                <thead>
                  <tr>
                    <th v-for="col in mstranColumns" :key="col" class="sortable-th" @click="toggleSort('mstran', col)">
                      {{ col }}<span class="sort-indicator">{{ sortIndicator('mstran', col) }}</span>
                    </th>
                    <th class="warn-col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in sortRows(group.rows, mstranSort)" :key="i" :class="{ 'row-suspicious': row._warnings?.length }">
                    <td v-for="col in mstranColumns" :key="col" :class="cellClass(row, col)">{{ cellVal(row, col) }}</td>
                    <td class="warn-col">
                      <span v-if="row._warnings?.length" class="warn-icon"
                        :title="row._warnings.map(w => w.text).join('\n')">⚠</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-section">Tidak ada data grup ini</div>
          </div>
        </div>
        <div v-else class="section">
          <div class="section-header"><i class="pi pi-list"></i><h4>MSTRAN</h4></div>
          <div class="empty-section">Tidak ada data mstran untuk periode ini</div>
        </div>

        <!-- MTRAN Groups -->
        <div v-if="data.mtran?.rows?.length" class="section-group">
          <div class="section-header">
            <i class="pi pi-chart-bar"></i>
            <h4>MTRAN ({{ data.mtran.rows.length }})</h4>
            <span v-if="data.mtran.totalWarnings" class="warn-badge">{{ data.mtran.totalWarnings }} warning</span>
          </div>
          <div v-for="(group, gkey) in mtranGroups" :key="gkey" class="group-card">
            <div class="group-header" :class="{ 'group-warn': group.warningCount > 0, 'group-critical': group.deviation > 0.5 && group.count > 0 }">
              <div class="gh-top">
                <span class="gh-label">{{ group.label }}</span>
                <span class="gh-mapping" v-if="group.mapping">→ {{ group.mapping.toUpperCase() }}</span>
                <span class="gh-count">{{ group.count }} row(s)</span>
                <span v-if="group.warningCount" class="warn-badge">{{ group.warningCount }} ⚠</span>
              </div>
              <div v-if="group.count" class="gh-aggr">
                <span>Qty: <strong>{{ fmt(group.totalQty) }}</strong></span>
                <span>Rp: <strong>{{ fmt(group.totalRupiah) }}</strong></span>
                <span v-if="group.unitPrice > 0">
                  Unit: <strong class="unit-price" :class="priceClass(group.unitPrice)">{{ fmt(group.unitPrice) }}</strong>
                </span>
                <span v-if="acostNum > 0 && group.unitPrice > 0">
                  ACOST: <strong>{{ fmt(acostNum) }}</strong>
                  Dev: <strong :class="devClass(group.deviation)">{{ (group.deviation * 100).toFixed(1) }}%</strong>
                </span>
              </div>
            </div>
            <div v-if="group.count" class="group-table-wrap">
              <table class="inspector-table">
                <thead>
                  <tr>
                    <th v-for="col in mtranColumns" :key="col" class="sortable-th" @click="toggleSort('mtran', col)">
                      {{ col }}<span class="sort-indicator">{{ sortIndicator('mtran', col) }}</span>
                    </th>
                    <th class="warn-col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in sortRows(group.rows, mtranSort)" :key="i" :class="{ 'row-suspicious': row._warnings?.length }">
                    <td v-for="col in mtranColumns" :key="col" :class="cellClass(row, col)">{{ cellVal(row, col) }}</td>
                    <td class="warn-col">
                      <span v-if="row._warnings?.length" class="warn-icon"
                        :title="row._warnings.map(w => w.text).join('\n')">⚠</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-section">Tidak ada data grup ini</div>
          </div>
        </div>
        <div v-else class="section">
          <div class="section-header"><i class="pi pi-chart-bar"></i><h4>MTRAN</h4></div>
          <div class="empty-section">Tidak ada data mtran untuk periode ini</div>
        </div>

        <!-- PROTECT -->
        <div v-if="data.protect?.length" class="section">
          <div class="section-header">
            <i class="pi pi-shield"></i>
            <h4>PROTECT ({{ data.protect.length }})</h4>
          </div>
          <div class="group-table-wrap">
            <table class="inspector-table">
              <thead>
                <tr>
                  <th v-for="col in protectColumns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in data.protect" :key="i">
                  <td v-for="col in protectColumns" :key="col">{{ row[col] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="footer-actions">
        <button type="button" class="btn btn-cancel" @click="$emit('close')">
          <i class="pi pi-times"></i><span>Tutup</span>
        </button>
      </div>
    </template>
  </BaseModalDetail>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import BaseModalDetail from "@/components/common/BaseModalDetail.vue";
import penyesuaianService from "@/services/penyesuaian.service.js";

const props = defineProps({
  show: { type: Boolean, default: false },
  kdtk: { type: String, required: true },
  prdcd: { type: String, required: true },
  cab: { type: String, default: "" },
  periode: { type: String, default: "" },
  begbal: { type: [String, Number], default: "" },
});

defineEmits(["close"]);

const data = ref({ prodmast: null, mstran: { rows: [], groups: {}, totalWarnings: 0 }, mtran: { rows: [], groups: {}, totalWarnings: 0 }, protect: [], prodmastWarnings: [], acost: 0, lcost: 0, summary: { totalWarnings: 0, groupsWithIssues: [] } });
const loading = ref(true);
const error = ref("");

const acostNum = computed(() => Number(data.value.acost) || Number(data.value.lcost) || 0);
const acostFormatted = computed(() => fmt(acostNum.value));
const begbalNum = computed(() => {
  const v = props.begbal;
  if (!v) return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[.,\s]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
});
const begbalFormatted = computed(() => fmt(begbalNum.value));
const begbalDev = computed(() => {
  if (!begbalNum.value || !acostNum.value) return null;
  return Math.abs(begbalNum.value - acostNum.value) / acostNum.value;
});
const begbalDevPct = computed(() => {
  if (begbalDev.value === null) return "-";
  return (begbalDev.value * 100).toFixed(1) + "%";
});
const begbalDevClass = computed(() => {
  if (begbalDev.value === null) return "dev-none";
  if (begbalDev.value > 0.5) return "dev-critical";
  if (begbalDev.value > 0.1) return "dev-warn";
  return "dev-ok";
});

const prodmastWarnings = computed(() => data.value.prodmastWarnings || []);

const summary = computed(() => data.value.summary || { totalWarnings: 0, groupsWithIssues: [] });
const criticalGroups = computed(() => summary.value.groupsWithIssues?.map(k => {
  const g = mstranGroups.value[k];
  return g ? `${g.label} (${(g.deviation * 100).toFixed(0)}%)` : k;
}) || []);

const mstranGroups = computed(() => {
  const groups = data.value.mstran?.groups || {};
  return Object.fromEntries(Object.entries(groups).filter(([, g]) => g.count > 0));
});

const mtranGroups = computed(() => {
  const groups = data.value.mtran?.groups || {};
  return Object.fromEntries(Object.entries(groups).filter(([, g]) => g.count > 0));
});

const internalFields = ["_category", "_warnings", "_unitPrice"];

function getColumns(rows) {
  if (!rows?.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.filter(k => !internalFields.includes(k));
}

const mstranColumns = computed(() => getColumns(data.value.mstran?.rows));
const mtranColumns = computed(() => getColumns(data.value.mtran?.rows));
const protectColumns = computed(() => getColumns(data.value.protect));

const mstranSort = ref({ column: null, order: null });
const mtranSort = ref({ column: null, order: null });

function toggleSort(table, column) {
  const s = table === "mstran" ? mstranSort : mtranSort;
  if (s.value.column === column) {
    if (s.value.order === "asc") s.value.order = "desc";
    else if (s.value.order === "desc") s.value = { column: null, order: null };
    else s.value = { column, order: "asc" };
  } else {
    s.value = { column, order: "asc" };
  }
}

function sortIndicator(table, column) {
  const s = table === "mstran" ? mstranSort : mtranSort;
  if (s.value.column !== column) return "";
  return s.value.order === "asc" ? " ▲" : " ▼";
}

function sortRows(rows, sortState) {
  if (!sortState.column || !sortState.order || !rows?.length) return rows;
  const col = sortState.column;
  const order = sortState.order === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (numericCols.includes(col.toLowerCase())) {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return (va - vb) * order;
    }
    va = String(va ?? "").toLowerCase();
    vb = String(vb ?? "").toLowerCase();
    return va.localeCompare(vb) * order;
  });
  return sorted;
}

function fmt(val) {
  if (val === null || val === undefined) return "-";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString("id-ID");
}

function priceClass(unitPrice) {
  if (!acostNum.value || !unitPrice) return "";
  const d = Math.abs(unitPrice - acostNum.value) / acostNum.value;
  if (d > 0.5) return "val-critical";
  if (d > 0.1) return "val-warn";
  return "";
}

function devClass(d) {
  if (d > 0.5) return "val-critical";
  if (d > 0.1) return "val-warn";
  return "val-ok";
}

const numericCols = ["qty", "gross", "hpp", "stock", "rp_sld_akh", "saldo_akh"];

function cellClass(row, col) {
  if (numericCols.includes(col.toLowerCase())) return "cell-num";
  return "";
}

function cellVal(row, col) {
  if (numericCols.includes(col.toLowerCase())) return fmt(row[col]);
  const v = row[col];
  if (v === null || v === undefined) return "-";
  return String(v);
}

onMounted(async () => {
  try {
    const res = await penyesuaianService.getStoreItem(props.kdtk, props.prdcd, props.periode);
    data.value = res?.data || data.value;
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || "Gagal mengambil data item";
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.inspector-header { padding: 1rem 0; }
.info-grid { display: flex; gap: 1rem; flex-wrap: wrap; }
.info-item {
  display: flex; flex-direction: column; gap: 0.25rem;
  padding: 0.5rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;
}
.info-label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.info-value { font-size: 0.9rem; font-weight: 700; color: #1e293b; }
.prdcd-value { color: #2563eb; font-family: monospace; }

.begbal-row {
  display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;
  background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 0.75rem 1rem;
}
.begbal-box {
  display: flex; flex-direction: column; gap: 0.15rem; padding-right: 1.5rem;
  border-right: 1px solid #dbeafe;
}
.begbal-box:last-child { border-right: none; }
.b-label { font-size: 0.65rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.b-value { font-size: 1rem; font-weight: 700; color: #1e293b; }

.loading-section, .error-section { text-align: center; padding: 3rem; color: #6b7280; }
.error-section { color: #dc2626; }

.inspector-content { display: flex; flex-direction: column; gap: 1.25rem; padding: 0.5rem 0; }

.summary-bar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 8px; color: #b91c1c; font-weight: 600; font-size: 0.875rem;
}
.summary-ok { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }

.section, .section-group {
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
}
.section-header {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1rem; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
  font-weight: 600; font-size: 0.875rem; color: #374151;
}
.section-header h4 { margin: 0; font-size: inherit; }

.bkl-badge { background: #f59e0b; color: #fff; font-size: 0.6rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; }
.warn-badge { background: #ef4444; color: #fff; font-size: 0.6rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; }
.crit-badge { background: #b91c1c; color: #fff; font-size: 0.6rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; }

.prodmast-card { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0; padding: 0.5rem 1rem; }
.pm-row { display: flex; flex-direction: column; padding: 0.35rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
.pm-key { font-size: 0.6rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.pm-val { font-size: 0.85rem; font-weight: 600; color: #1e293b; font-family: monospace; word-break: break-all; }
.pm-warnings { grid-column: 1 / -1; background: #fef2f2; padding: 0.5rem 1rem; border-radius: 4px; margin-top: 0.5rem; }
.pm-warn-item { font-size: 0.8rem; color: #b91c1c; display: flex; align-items: center; gap: 0.35rem; }

.group-card { border-bottom: 1px solid #e5e7eb; }
.group-card:last-child { border-bottom: none; }
.group-header {
  padding: 0.5rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
}
.group-warn { background: #fff5f5; }
.group-critical { background: #fef2f2; border-left: 4px solid #b91c1c; }
.gh-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
.gh-label { font-weight: 700; font-size: 0.85rem; color: #1e293b; }
.gh-mapping { font-size: 0.75rem; color: #6b7280; background: #e5e7eb; padding: 0.05rem 0.4rem; border-radius: 4px; }
.gh-count { font-size: 0.75rem; color: #6b7280; margin-left: auto; }
.gh-aggr { display: flex; gap: 1rem; font-size: 0.8rem; color: #374151; flex-wrap: wrap; }
.gh-aggr strong { font-weight: 700; }
.unit-price { font-family: monospace; }

.group-table-wrap {
  overflow: auto; padding: 0;
  max-height: 320px;
}
.inspector-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; white-space: nowrap; }
.inspector-table thead { position: sticky; top: 0; z-index: 2; }
.sortable-th { cursor: pointer; user-select: none; }
.sortable-th:hover { background: #e5e7eb; }
.sort-indicator { font-size: 0.7rem; color: #6b7280; }
.inspector-table th {
  background: #e2e8f0; padding: 0.4rem 0.6rem; text-align: left;
  font-weight: 700; color: #1e293b; border-bottom: 2px solid #94a3b8;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.inspector-table td { padding: 0.3rem 0.6rem; border-bottom: 1px solid #e5e7eb; color: #1e293b; }
.inspector-table tbody tr:hover { background: #e0f2fe; }

/* Suspicious row highlighting — high contrast */
.row-suspicious { background: #fff1f2 !important; }
.row-suspicious:hover { background: #ffd6d8 !important; }
.row-suspicious td:first-child {
  border-left: 4px solid #dc2626 !important;
  padding-left: calc(0.6rem - 4px);
}

.cell-num { text-align: right; font-family: monospace; }
.warn-col { text-align: center; width: 50px; }
.warn-icon { color: #ef4444; cursor: help; font-size: 1rem; }

.empty-section { text-align: center; padding: 1.5rem; color: #9ca3af; font-size: 0.85rem; }

.val-ok { color: #15803d; }
.val-warn { color: #d97706; }
.val-critical { color: #b91c1c; font-weight: 700; }
.dev-none { color: #6b7280; }
.dev-ok { color: #15803d; }
.dev-warn { color: #d97706; }
.dev-critical { color: #b91c1c; font-weight: 700; }

.footer-actions { display: flex; justify-content: flex-end; }
.btn-cancel {
  background: linear-gradient(135deg, #6b7280, #4b5563); color: #fff;
  padding: 0.625rem 1.5rem; border: none; border-radius: 10px; font-size: 0.9375rem;
  font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;
}
.btn-cancel:hover { background: linear-gradient(135deg, #4b5563, #374151); }
</style>
