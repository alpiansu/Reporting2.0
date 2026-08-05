<template>
  <BaseModalDetail :show="show" :title="'Detail Item: ' + prdcd" icon="pi pi-box" size="full" @close="$emit('close')">
    <template #header-info>
      <div class="inspector-header">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Toko</span>
            <span class="info-value">{{ kdtk }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Cabang</span>
            <span class="info-value">{{ cab }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Periode</span>
            <span class="info-value">{{ periode || 'Semua' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">PRDCD</span>
            <span class="info-value prdcd-value">{{ prdcd }}</span>
          </div>
          <div v-if="data.prodmast?.SINGKATAN" class="info-item">
            <span class="info-label">SINGKATAN</span>
            <span class="info-value singkatan-value">{{ data.prodmast.SINGKATAN }}</span>
          </div>
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
        <!-- ── ACOST Analysis Banner ──────────────────────────── -->
        <div v-if="acostAnalysis" class="acost-section">
          <div class="acost-header">
            <i class="pi pi-search"></i>
            <h4>Analisis Perubahan ACOST</h4>
          </div>

          <!-- CABANG A: Ada bukti transaksi -->
          <div v-if="acostAnalysis.cause === 'transaction_evidence'" class="acost-card acost-evidence">
            <div class="acost-card-header">
              <i class="pi pi-arrow-right-arrow-left"></i>
              <span>Perubahan harga terdeteksi melalui transaksi berikut:</span>
            </div>
            <div class="acost-card-body">
              <table class="acost-table">
                <thead>
                  <tr>
                    <th class="th-date">Tanggal</th>
                    <th class="th-num">Harga Sebelum</th>
                    <th class="th-num">Harga Sesudah</th>
                    <th class="th-num">Selisih</th>
                    <th class="th-source">Sumber</th>
                    <th class="th-ref">No. Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(ch, i) in acostPaginatedChanges" :key="i">
                    <td>{{ formatDate(ch.tanggal) }}</td>
                    <td class="cell-num">{{ fmt(ch.dari) }}</td>
                    <td class="cell-num">{{ fmt(ch.ke) }}</td>
                    <td class="cell-num" :class="diffClass(ch.ke - ch.dari)">{{ fmt(ch.ke - ch.dari) }}</td>
                    <td>
                      <span class="source-badge" :class="'source-' + ch.source">{{ sourceLabel(ch.source) }}</span>
                      <span v-if="ch.lcostMatch === true" class="lcost-badge lcost-ok" title="Harga retur sesuai LCOST (case closed)">LCOST ✓</span>
                      <span v-else-if="ch.lcostMatch === false" class="lcost-badge lcost-ko" title="Harga retur TIDAK sesuai LCOST — perlu investigasi">LCOST ✗</span>
                      <button v-if="ch.koDetail" class="btn-detail-konversi" @click="openKonversiDetail(ch)" title="Lihat detail konversi">
                        <i class="pi pi-external-link"></i>
                      </button>
                    </td>
                    <td class="cell-ref">{{ buktiNo(ch.ref) }}</td>
                  </tr>
                </tbody>
              </table>
              <!-- Pagination ACOST -->
              <div v-if="acostTotalPages > 1" class="pagination-bar">
                <button class="page-btn" :disabled="acostPage <= 1" @click="acostPage--">
                  <i class="pi pi-chevron-left"></i>
                </button>
                <template v-for="p in acostPageNumbers" :key="p">
                  <span v-if="p === '...'" class="page-ellipsis">…</span>
                  <button v-else class="page-btn" :class="{ 'page-active': p === acostPage }" @click="acostPage = p">
                    {{ p }}
                  </button>
                </template>
                <button class="page-btn" :disabled="acostPage >= acostTotalPages" @click="acostPage++">
                  <i class="pi pi-chevron-right"></i>
                </button>
                <span class="page-info">{{ acostChanges.length }} perubahan</span>
              </div>
            </div>
          </div>

          <!-- CABANG B: BKL cocok dengan protect -->
          <div v-else-if="acostAnalysis.cause === 'protect_sync'" class="acost-card acost-protect-ok">
            <div class="acost-card-header">
              <i class="pi pi-check-circle"></i>
              <span>Kenaikan sesuai harga supplier (protect)</span>
            </div>
            <div class="acost-card-body">
              <p>ACOST saat ini <strong>{{ fmt(acostAnalysis.acostSekarang) }}</strong> sudah sesuai dengan HARGABL protect <strong>{{ fmt(acostAnalysis.hargablProtect) }}</strong>.</p>
            </div>
          </div>

          <!-- CABANG B: BKL tidak cocok dengan protect -->
          <div v-else-if="acostAnalysis.cause === 'protect_mismatch'" class="acost-card acost-protect-warn">
            <div class="acost-card-header">
              <i class="pi pi-exclamation-triangle"></i>
              <span>ACOST tidak sesuai dengan harga supplier (protect)</span>
            </div>
            <div class="acost-card-body">
              <p>ACOST toko <strong>{{ fmt(acostAnalysis.acostSekarang) }}</strong> tidak sesuai dengan HARGABL protect <strong>{{ fmt(acostAnalysis.hargablProtect) }}</strong> — tidak ada transaksi yang menjelaskan perubahan ini.</p>
            </div>
          </div>

          <!-- CABANG C: Anomali tanpa penjelasan -->
          <div v-else-if="acostAnalysis.cause === 'unexplained_acost_anomaly'" class="acost-card acost-anomaly">
            <div class="acost-card-header">
              <i class="pi pi-question-circle"></i>
              <span>ACOST berubah tanpa transaksi tercatat</span>
            </div>
            <div class="acost-card-body">
              <p>ACOST berubah dari BEGBAL <strong>{{ fmt(acostAnalysis.begbal) }}</strong> menjadi <strong>{{ fmt(acostAnalysis.acostSekarang) }}</strong> tanpa transaksi yang mencatat perubahan harga. Item non-BKL — perlu investigasi manual.</p>
            </div>
          </div>
        </div>

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
                  <tr v-for="(row, i) in getPaginatedRows(sortRows(group.rows, mstranSort), mstranPageMap[gkey] || 1)" :key="i" :class="{ 'row-suspicious': row._warnings?.length }">
                    <td v-for="col in mstranColumns" :key="col" :class="cellClass(row, col)">{{ cellVal(row, col) }}</td>
                    <td class="warn-col">
                      <span v-if="row._warnings?.length" class="warn-icon"
                        :title="row._warnings.map(w => w.text).join('\n')">⚠</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <!-- Pagination MSTRAN group -->
              <div v-if="mstranGroupPages(gkey) > 1" class="pagination-bar">
                <button class="page-btn" :disabled="(mstranPageMap[gkey] || 1) <= 1" @click="setMstranPage(gkey, (mstranPageMap[gkey] || 1) - 1)">
                  <i class="pi pi-chevron-left"></i>
                </button>
                <template v-for="p in getGroupPageNumbers(mstranPageMap[gkey] || 1, mstranGroupPages(gkey))" :key="p">
                  <span v-if="p === '...'" class="page-ellipsis">…</span>
                  <button v-else class="page-btn" :class="{ 'page-active': p === (mstranPageMap[gkey] || 1) }" @click="setMstranPage(gkey, p)">
                    {{ p }}
                  </button>
                </template>
                <button class="page-btn" :disabled="(mstranPageMap[gkey] || 1) >= mstranGroupPages(gkey)" @click="setMstranPage(gkey, (mstranPageMap[gkey] || 1) + 1)">
                  <i class="pi pi-chevron-right"></i>
                </button>
                <span class="page-info">{{ group.rows.length }} baris</span>
              </div>
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
                  <tr v-for="(row, i) in getPaginatedRows(sortRows(group.rows, mtranSort), mtranPageMap[gkey] || 1)" :key="i" :class="{ 'row-suspicious': row._warnings?.length }">
                    <td v-for="col in mtranColumns" :key="col" :class="cellClass(row, col)">{{ cellVal(row, col) }}</td>
                    <td class="warn-col">
                      <span v-if="row._warnings?.length" class="warn-icon"
                        :title="row._warnings.map(w => w.text).join('\n')">⚠</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <!-- Pagination MTRAN group -->
              <div v-if="mtranGroupPages(gkey) > 1" class="pagination-bar">
                <button class="page-btn" :disabled="(mtranPageMap[gkey] || 1) <= 1" @click="setMtranPage(gkey, (mtranPageMap[gkey] || 1) - 1)">
                  <i class="pi pi-chevron-left"></i>
                </button>
                <template v-for="p in getGroupPageNumbers(mtranPageMap[gkey] || 1, mtranGroupPages(gkey))" :key="p">
                  <span v-if="p === '...'" class="page-ellipsis">…</span>
                  <button v-else class="page-btn" :class="{ 'page-active': p === (mtranPageMap[gkey] || 1) }" @click="setMtranPage(gkey, p)">
                    {{ p }}
                  </button>
                </template>
                <button class="page-btn" :disabled="(mtranPageMap[gkey] || 1) >= mtranGroupPages(gkey)" @click="setMtranPage(gkey, (mtranPageMap[gkey] || 1) + 1)">
                  <i class="pi pi-chevron-right"></i>
                </button>
                <span class="page-info">{{ group.rows.length }} baris</span>
              </div>
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

  <!-- Detail Dialog for Konversi Analysis -->
  <KonversiDetailDialog
    :show="showKonversiDetail"
    :detail="selectedKonversiDetail"
    @close="showKonversiDetail = false"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import BaseModalDetail from "@/components/common/BaseModalDetail.vue";
import KonversiDetailDialog from "./KonversiDetailDialog.vue";
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

const data = ref({ prodmast: null, mstran: { rows: [], groups: {}, totalWarnings: 0 }, mtran: { rows: [], groups: {}, totalWarnings: 0 }, protect: [], prodmastWarnings: [], acost: 0, lcost: 0, summary: { totalWarnings: 0, groupsWithIssues: [] }, acostAnalysis: null });
const loading = ref(true);
const error = ref("");

// ── Konversi Detail Dialog state ────────────────────────────
const showKonversiDetail = ref(false);
const selectedKonversiDetail = ref(null);

function openKonversiDetail(ch) {
  selectedKonversiDetail.value = ch.koDetail || null;
  showKonversiDetail.value = true;
}

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

const acostAnalysis = computed(() => data.value.acostAnalysis || null);

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

// ── Client-side pagination state ────────────────────────────
const pageSize = 10;
const acostPage = ref(1);
const mstranPageMap = ref({});
const mtranPageMap = ref({});

const acostChanges = computed(() => acostAnalysis.value?.changes || []);
const acostTotalPages = computed(() => Math.max(1, Math.ceil(acostChanges.value.length / pageSize)));
const acostPaginatedChanges = computed(() => {
  const start = (acostPage.value - 1) * pageSize;
  return acostChanges.value.slice(start, start + pageSize);
});
const acostPageNumbers = computed(() => getGroupPageNumbers(acostPage.value, acostTotalPages.value));

function getPaginatedRows(rows, page, size = pageSize) {
  if (!rows?.length) return rows || [];
  const start = (page - 1) * size;
  return rows.slice(start, start + size);
}

function mstranGroupPages(gkey) {
  const g = mstranGroups.value[gkey];
  return Math.max(1, Math.ceil((g?.rows?.length || 0) / pageSize));
}

function mtranGroupPages(gkey) {
  const g = mtranGroups.value[gkey];
  return Math.max(1, Math.ceil((g?.rows?.length || 0) / pageSize));
}

function setMstranPage(gkey, page) {
  mstranPageMap.value = { ...mstranPageMap.value, [gkey]: page };
}

function setMtranPage(gkey, page) {
  mtranPageMap.value = { ...mtranPageMap.value, [gkey]: page };
}

function getGroupPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const cur = currentPage;
  const tp = totalPages;
  const pages = [];
  if (cur <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...', tp);
  } else if (cur >= tp - 3) {
    pages.push(1, '...');
    for (let i = tp - 4; i <= tp; i++) pages.push(i);
  } else {
    pages.push(1, '...');
    for (let i = cur - 1; i <= cur + 1; i++) pages.push(i);
    pages.push('...', tp);
  }
  return pages;
}

// Reset pagination when data changes
watch(() => data.value.mstran?.rows, () => { mstranPageMap.value = {}; });
watch(() => data.value.mtran?.rows, () => { mtranPageMap.value = {}; });
watch(() => acostAnalysis.value, () => { acostPage.value = 1; });

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
  return n.toLocaleString("en-US");
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

/** ── ACOST Analysis Helpers ────────────────────────────── */
function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function sourceLabel(source) {
  const labels = {
    bpb_i: 'BPB / Trf Masuk',
    bpb: 'BPB / Trf Masuk',
    konversi_bm: 'Konversi Racikan',
    retur_k: 'Retur',
    k_o: 'Retur',
    k: 'Retur',
    trfout_o: 'Trf Keluar',
    ba: 'Barang Afkir',
    bs: 'Barang Rusak',
    stock_opname: 'Stock Opname',
    so: 'Stock Opname',
    mtran_hpp: 'Penjualan (HPP)',
  };
  return labels[source] || source;
}

function diffClass(val) {
  if (val > 0) return 'val-critical';
  if (val < 0) return 'val-ok';
  return '';
}

function buktiNo(refRow) {
  if (!refRow) return '-';
  // mstran: BUKTI_NO, mtran: DOCNO
  return refRow.BUKTI_NO || refRow.bukti_no
    || refRow.DOCNO || refRow.docno
    || refRow.BUKTI || refRow.bukti
    || '-';
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

<style scoped src="./StoreItemInspectorDialog.style.css"></style>
