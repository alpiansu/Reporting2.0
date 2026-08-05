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

        <!-- Snapshot Card -->
        <div v-if="noteSnapshot" class="snapshot-card">
          <div class="snapshot-card-header">
            <i class="pi pi-history"></i>
            <span>Riwayat Terakhir Pengecekan</span>
          </div>
          <div class="snapshot-card-body">
            <div class="snapshot-row">
              <span class="snapshot-label">Saat dicatat:</span>
              <span class="snapshot-value">{{ formatCurrency(noteSnapshot.sesuaSaatNote) }}</span>
              <span class="snapshot-date">({{ noteSnapshot.updtimeSaatNote ? formatDateTime(noteSnapshot.updtimeSaatNote).split(' ').slice(0,2).join(' ') : '-' }})</span>
            </div>
            <div class="snapshot-row">
              <span class="snapshot-label">Sekarang:</span>
              <span class="snapshot-value">{{ formatCurrency(noteSnapshot.sesuaSekarang) }}</span>
              <span class="snapshot-date">({{ formatDateTime(updtimeSekarang) }})</span>
            </div>
            <div class="snapshot-row" :class="noteSnapshot.membaik ? 'snapshot-improved' : 'snapshot-worsened'">
              <span class="snapshot-label">Pergerakan:</span>
              <span class="snapshot-delta">
                {{ noteSnapshot.membaik ? '\u25BC' : '\u25B2' }}
                {{ noteSnapshot.selisih >= 0 ? '+' : '' }}{{ formatCurrency(noteSnapshot.selisih) }}
                ({{ noteSnapshot.persen }}%)
              </span>
            </div>
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
  // Opsional: note snapshot dari tabel/resume data
  noteSnapshotData: { type: Object, default: null },
})

const emit = defineEmits(['close'])

// ─── Snapshot computation ────────────────────────────────────
const noteSnapshot = ref(null)
const updtimeSekarang = ref('')

watch(() => props.noteSnapshotData, (val) => {
  noteSnapshot.value = val || null
}, { immediate: true })

// Juga coba parse dari props.sesuai
watch(() => props.show, (val) => {
  if (val) {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    updtimeSekarang.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }
})

function formatCurrency(value) {
  const num = Number(value) || 0
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDateTime(date) {
  if (!date) return '-'
  return new Date(date).toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

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

<style scoped src="./PenyesuaianDetailModal.style.css"></style>
