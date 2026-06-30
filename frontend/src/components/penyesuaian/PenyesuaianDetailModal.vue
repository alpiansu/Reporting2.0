<template>
  <BaseModalDetail :show="show" title="Detail Penyesuaian" icon="pi pi-list" size="full" @close="$emit('close')"
    class="penyesuaian-detail-modal">
    <template #header-info>
      <div class="header-info-container">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-calendar"></i>
              <span>Periode</span>
            </div>
            <div class="info-value">{{ periode }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-building"></i>
              <span>Cabang</span>
            </div>
            <div class="info-value">{{ cab }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-shop"></i>
              <span>Toko</span>
            </div>
            <div class="info-value">{{ kdtk }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-dollar"></i>
              <span>Penyesuaian Toko</span>
            </div>
            <div class="info-value">{{ sesuai }}</div>
          </div>
        </div>
      </div>
    </template>
    <template #content>
      <div class="content-container">
        <!-- Warning Banner -->
        <div v-if="detailWarning" class="warning-banner">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ detailWarning }}</span>
        </div>

        <!-- Insight Panel Loading -->
        <div v-if="insightLoading" class="insight-panel insight-loading">
          <div class="insight-header">
            <i class="pi pi-chart-bar"></i>
            <span>Memuat Insight…</span>
          </div>
          <div class="insight-body">
            <div class="insight-summary">
              <div v-for="n in 4" :key="n" class="summary-item skeleton-item">
                <div class="skeleton-line skeleton-label"></div>
                <div class="skeleton-line skeleton-value"></div>
              </div>
            </div>
            <div class="insight-detail">
              <div class="skeleton-list">
                <div v-for="n in 5" :key="n" class="skeleton-row"></div>
              </div>
              <div class="skeleton-chart"></div>
            </div>
          </div>
        </div>

        <!-- Insight Panel -->
        <div v-if="insight && insight.totalItems > 0" class="insight-panel">
          <div class="insight-header">
            <i class="pi pi-chart-bar"></i>
            <span>Insight Penyesuaian</span>
          </div>

          <div class="insight-body">
            <div class="insight-summary">
              <div class="summary-item">
                <span class="summary-label">Total Item</span>
                <span class="summary-value">{{ insight.totalItems }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Nilai Penyesuaian</span>
                <span class="summary-value" :class="insight.signDirection">
                  {{ formatCurrency(insight.totalSesuai) }}
                </span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Arah</span>
                <span class="summary-value" :class="insight.signDirection">
                  {{ insight.signDirection === 'positive' ? 'Plus' : 'Minus' }}
                </span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Item Penyumbang</span>
                <span class="summary-value">
                  {{ insight.contributingItems }} dari {{ insight.totalItems }} item
                </span>
              </div>
            </div>

            <div class="insight-detail">
              <div class="top-items-section">
                <h4 class="top-items-title">
                  Top Item (arah {{ insight.signDirection === 'positive' ? 'plus' : 'minus' }})
                </h4>
                <div class="top-items-list">
                  <div v-for="(item, index) in insight.topItems" :key="item.prdcd" class="top-item-row">
                    <div class="item-rank">{{ index + 1 }}</div>
                    <div class="item-info">
                      <div class="item-name">{{ item.name }}</div>
                      <div class="item-prdcd">{{ item.prdcd }}</div>
                    </div>
                    <div class="item-metrics">
                      <div class="contribution-bar-container">
                        <div class="contribution-bar" :style="{ width: item.contributionPercent + '%' }"></div>
                      </div>
                      <span class="contribution-pct">{{ item.contributionPercent }}%</span>
                      <span class="contribution-amount">{{ formatCurrency(item.absSesuai) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="insight.paretoInfo.itemsFor80Percent > 0" class="pareto-note">
                  {{ insight.paretoInfo.itemsFor80Percent }} item menyumbang 80% dari total penyesuaian
                </div>
              </div>

              <div v-if="insight.topItems.length > 1" class="chart-section">
                <Doughnut :data="chartData" :options="chartOptions" />
              </div>
            </div>
          </div>
        </div>

        <BaseServerDataTableModal :title="'Detail Data'" :icon="'pi pi-table'" :fetcher="fetchDetail"
          :query="{ kdtk: kdtk, periode: periode }" :columns="columns" :autoColumns="false" :initialItemsPerPage="10"
          :minTableWidth="'1200px'" :maxHeight="'500px'" :searchable="true" :sortable="true"
          class="detail-table-wrapper" @loaded="onTableLoaded">
          <template #cell-PRDCD="{ row, value }">
            <a href="#" class="prdcd-link" @click.prevent="openInspector(value, row.BEGBAL)">{{ value }}</a>
          </template>
          <template #cell-SESUAI="{ row }">
            <span class="value-sesuai">{{ row.SESUAI }}</span>
          </template>
        </BaseServerDataTableModal>

        <StoreItemInspectorDialog
          v-if="showInspector"
          :show="showInspector"
          :kdtk="kdtk"
          :prdcd="selectedPrdcd"
          :cab="cab"
          :periode="periode"
          :begbal="selectedBegbal"
          @close="showInspector = false"
        />
      </div>
    </template>
    <template #footer>
      <div class="footer-container">
        <button type="button" class="btn btn-cancel" @click="$emit('close')">
          <i class="pi pi-times"></i>
          <span>Tutup</span>
        </button>
      </div>
    </template>
  </BaseModalDetail>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
} from 'chart.js'
import BaseModalDetail from '@/components/common/BaseModalDetail.vue'
import BaseServerDataTableModal from '@/components/common/BaseServerDataTableModal.vue'
import penyesuaianService from '@/services/penyesuaian.service.js'
import StoreItemInspectorDialog from './StoreItemInspectorDialog.vue'

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale)

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

const props = defineProps({
  show: { type: Boolean, default: false },
  periode: { type: String, required: true },
  cab: { type: String, required: true },
  kdtk: { type: String, required: true },
  sesuai: {type: String, required: true},
})

const emit = defineEmits(['close'])

const columnDefs = [
  // { field: 'RECID', label: 'Rec ID', align: 'center' },
  { field: 'PRDCD', label: 'PRDCD', align: 'center' },
  { field: 'SINGKATAN', label: 'SINGKATAN' },
  { field: 'PTAG', label: 'PTag', align: 'center' },
  { field: 'SESUAI', label: 'Nilai Sesuai', align: 'right', headerClass: 'col-sesuai', cellClass: 'cell-sesuai' },
  { field: 'BEGBAL', label: 'Saldo Awal', align: 'right' },
  { field: 'TRFIN', label: 'TRF In', align: 'right' },
  { field: 'TRFOUT', label: 'TRF Out', align: 'right' },
  { field: 'RP_SALES', label: 'RP Sales', align: 'right' },
  { field: 'RP_RETUR_SALES', label: 'RP Retur Sales', align: 'right' },
  { field: 'ADJ', label: 'Adj', align: 'right' },
  { field: 'BA', label: 'BA', align: 'right' },
  { field: 'BS', label: 'BS', align: 'right' },
  { field: 'ACOST', label: 'ACost', align: 'right' },
  { field: 'LCOST', label: 'LCost', align: 'right' },
  { field: 'STOCK', label: 'Stock', align: 'right' },
  { field: 'RP_STOCK', label: 'RP Stock', align: 'right' },
  // { field: 'STATUS_UPDTIME', label: 'Status Update', align: 'center', headerClass: 'col-status' },
];
const columns = ref(columnDefs);
const showInspector = ref(false);
const selectedPrdcd = ref('');
const selectedBegbal = ref('');
const insight = ref(null);
const insightLoading = ref(false);
const detailWarning = ref('');

function formatCurrency(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

const chartData = computed(() => {
  if (!insight.value || !insight.value.topItems || insight.value.topItems.length === 0) {
    return { labels: [], datasets: [] }
  }
  return {
    labels: insight.value.topItems.map(i => i.name || i.prdcd),
    datasets: [{
      data: insight.value.topItems.map(i => i.contributionPercent),
      backgroundColor: CHART_COLORS.slice(0, insight.value.topItems.length),
      hoverBackgroundColor: CHART_COLORS.slice(0, insight.value.topItems.length).map(c => c + 'cc'),
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '55%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 12,
        usePointStyle: true,
        font: { size: 11 },
      },
    },
    tooltip: {
      callbacks: {
        label: function (ctx) {
          const item = insight.value?.topItems?.[ctx.dataIndex]
          const pct = ctx.parsed || 0
          const amount = item ? formatCurrency(item.absSesuai) : ''
          return `${pct}% (${amount})`
        },
      },
    },
  },
}

function openInspector(prdcd, begbal) {
  selectedPrdcd.value = prdcd;
  selectedBegbal.value = begbal;
  showInspector.value = true;
}

const tableDataFields = ref([]);
function onTableLoaded({ data }) {
  if (data && data.length > 0) {
    tableDataFields.value = Object.keys(data[0]);
  }
}

const insightFetchedForKdtk = ref('');

async function fetchInsight() {
  if (!props.kdtk || !props.periode) return
  insightLoading.value = true
  try {
    const res = await penyesuaianService.getStoreInsight(props.kdtk, props.periode)
    insight.value = res?.data || null
  } catch {
    insight.value = null
  } finally {
    insightLoading.value = false
  }
}

watch(() => props.show, (val) => {
  if (val) {
    insight.value = null
    insightFetchedForKdtk.value = ''
    detailWarning.value = ''
  }
})

async function fetchDetail(params) {
  try {
    const res = await penyesuaianService.getStoreRecords(props.kdtk, props.periode, params);

    // Ambil warning dari response (jika toko di bawah threshold)
    detailWarning.value = res?.data?.warning || '';

    // Trigger insight setelah data detail berhasil di-load (hanya sekali per buka modal)
    if (insightFetchedForKdtk.value !== props.kdtk) {
      insightFetchedForKdtk.value = props.kdtk;
      fetchInsight();
    }

    // Pastikan ambil data array yang valid
    const dataArray = Array.isArray(res?.data?.data)
      ? res.data.data
      : Array.isArray(res?.data)
        ? res.data
        : [];

    return {
      data: dataArray,
      total: Number(res?.data?.total) || Number(res?.total) || 0,
      page: Number(res?.data?.page) || Number(res?.page) || params.page || 1,
      limit: Number(res?.data?.limit) || Number(res?.limit) || params.limit || 10,
      totalPages: Number(res?.data?.totalPages) || Number(res?.totalPages) || 1
    };
  } catch {
    detailWarning.value = 'Koneksi ke toko terputus, tidak dapat mengambil data detail.';
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: 0
    };
  }
}

</script>

<style scoped>
.insight-panel {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 10px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.insight-header {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  padding: 0.75rem 1.25rem;
  color: white;
  font-weight: 600;
  font-size: 0.9375rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.insight-header i {
  font-size: 1.125rem;
}

.insight-body {
  padding: 1rem 1.25rem;
}

.insight-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-item {
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.summary-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

.summary-value.positive {
  color: #059669;
}

.summary-value.negative {
  color: #dc2626;
}

.insight-detail {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 1rem;
  align-items: start;
}

.top-items-title {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}

.top-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.top-item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #f3f4f6;
  transition: box-shadow 0.15s ease;
}

.top-item-row:hover {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.item-rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-info {
  min-width: 0;
  flex: 1;
}

.item-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-prdcd {
  font-size: 0.6875rem;
  color: #6b7280;
  font-family: monospace;
}

.item-metrics {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.contribution-bar-container {
  width: 80px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.contribution-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.contribution-pct {
  font-size: 0.75rem;
  font-weight: 700;
  color: #374151;
  min-width: 36px;
  text-align: right;
}

.contribution-amount {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 90px;
  text-align: right;
  font-family: monospace;
}

.pareto-note {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
  text-align: center;
}

.chart-section {
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 0.75rem;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.penyesuaian-detail-modal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header-info-container {
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease-in-out;
}

.info-item:hover {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.info-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-label i {
  color: #3b82f6;
  font-size: 0.875rem;
}

.info-value {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.content-container {
  padding: 0.5rem 0;
}

.detail-table-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.footer-container {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 0;
}

.btn-cancel {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
}

.prdcd-link {
  color: #2563eb;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  font-family: monospace;
}

.prdcd-link:hover {
  color: #1d4ed8;
}

.btn-cancel:active {
  transform: translateY(0);
}

/* Responsive design */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .info-item {
    padding: 0.75rem;
  }

  .insight-detail {
    grid-template-columns: 1fr;
  }

/* Warning banner */
.warning-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.warning-banner i {
  font-size: 1.125rem;
  color: #dc2626;
  flex-shrink: 0;
}

/* Skeleton loading */
.insight-loading .insight-body {
  pointer-events: none;
}

.skeleton-item {
  background: #f9fafb;
}

.skeleton-line {
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-label {
  width: 60%;
  margin-bottom: 8px;
}

.skeleton-value {
  width: 80%;
  height: 14px;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  height: 40px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-chart {
  height: 220px;
  border-radius: 8px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.chart-section {
    height: 200px;
  }
  
  .footer-container {
    justify-content: center;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .header-info-container {
    padding: 0.75rem 0;
  }
  
  .info-value {
    font-size: 0.875rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }
}

.penyesuaian-detail-modal :deep(.col-sesuai) {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
  border-bottom: 2px solid #f59e0b !important;
}

.penyesuaian-detail-modal :deep(.col-sesuai .th-content span) {
  color: #92400e;
}

.penyesuaian-detail-modal :deep(.cell-sesuai) {
  font-weight: 700 !important;
  color: #1e293b !important;
}

.value-sesuai {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-weight: 600;
}
</style>
