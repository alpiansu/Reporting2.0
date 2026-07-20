<template>
  <div class="branch-recap-panel">
    <Card class="recap-card">
      <template #header>
        <div class="recap-header">
          <div class="recap-header-left">
            <i class="pi pi-sitemap"></i>
            <h3 class="recap-title">Rekap Penyesuaian per Cabang</h3>
          </div>
          <div class="recap-header-right">
            <span class="recap-periode">{{ periodeDisplay }}</span>
            <Button
              icon="pi pi-refresh"
              size="small"
              severity="secondary"
              text
              :loading="loading"
              @click="$emit('refresh')"
              v-tooltip.top="'Refresh data'"
            />
          </div>
        </div>
      </template>
      <template #content>
        <!-- Loading -->
        <div v-if="loading" class="recap-loading">
          <div class="skeleton-grid">
            <Skeleton v-for="n in 4" :key="n" width="100%" height="220px" borderRadius="10px" />
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="recap-error">
          <i class="pi pi-exclamation-triangle"></i>
          <p>{{ error }}</p>
          <Button label="Coba Lagi" icon="pi pi-refresh" size="small" @click="$emit('refresh')" />
        </div>

        <!-- Empty -->
        <div v-else-if="!branches.length" class="recap-empty">
          <i class="pi pi-chart-bar"></i>
          <p>Tidak ada data penyesuaian untuk periode ini</p>
        </div>

        <!-- Content -->
        <div v-else class="recap-content">
          <!-- Bar Chart: Top 10 max positive values per cabang -->
          <div class="chart-section">
            <div class="chart-header-inline">
              <div class="chart-title-wrap">
                <i class="pi pi-arrow-up chart-icon-positive"></i>
                <span>Nilai Plus Terbesar per Cabang</span>
              </div>
              <span class="chart-hint">Top 10 cabang dengan nilai penyesuaian positif tertinggi</span>
            </div>
            <div class="chart-container">
              <Bar :data="chartDataPositive" :options="chartOptionsPositive" />
            </div>
          </div>

          <div class="chart-section">
            <div class="chart-header-inline">
              <div class="chart-title-wrap">
                <i class="pi pi-arrow-down chart-icon-negative"></i>
                <span>Nilai Minus Terbesar per Cabang</span>
              </div>
              <span class="chart-hint">Top 10 cabang dengan nilai penyesuaian negatif terendah</span>
            </div>
            <div class="chart-container">
              <Bar :data="chartDataNegative" :options="chartOptionsNegative" />
            </div>
          </div>

          <!-- Branch Extremes Table -->
          <div class="branch-table-section">
            <h4 class="section-title">
              <i class="pi pi-list"></i>
              Nilai Ekstrem per Cabang
              <span class="section-count">{{ branches.length }} cabang</span>
            </h4>
            <div class="branch-table-wrap">
              <table class="branch-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cabang</th>
                    <th class="text-right">Plus Terbesar</th>
                    <th class="text-center">Item Plus</th>
                    <th class="text-center">Toko</th>
                    <th class="text-right">Minus Terbesar</th>
                    <th class="text-center">Item Minus</th>
                    <th class="text-center">Toko</th>
                    <th class="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(branch, index) in sortedBranches" :key="branch.cabang"
                    :class="{ 'has-extreme': branch.maxPositive || branch.maxNegative }"
                    @click="openBranchDetail(branch)">
                    <td class="text-center">{{ index + 1 }}</td>
                    <td>
                      <div class="branch-info">
                        <Tag :value="branch.cabang" severity="info" class="branch-tag" />
                      </div>
                    </td>
                    <td class="text-right">
                      <span v-if="branch.maxPositive" class="value-positive">
                        {{ formatCurrency(branch.maxPositive.sesui) }}
                      </span>
                      <span v-else class="no-data">-</span>
                    </td>
                    <td class="text-center">
                      <span v-if="branch.maxPositive" class="item-code" v-tooltip.top="branch.maxPositive.name">
                        {{ branch.maxPositive.prdcd }}
                      </span>
                    </td>
                    <td class="text-center">
                      <span v-if="branch.maxPositive" class="store-code">{{ branch.maxPositive.kdtk }}</span>
                    </td>
                    <td class="text-right">
                      <span v-if="branch.maxNegative" class="value-negative">
                        {{ formatCurrency(branch.maxNegative.sesui) }}
                      </span>
                      <span v-else class="no-data">-</span>
                    </td>
                    <td class="text-center">
                      <span v-if="branch.maxNegative" class="item-code" v-tooltip.top="branch.maxNegative.name">
                        {{ branch.maxNegative.prdcd }}
                      </span>
                    </td>
                    <td class="text-center">
                      <span v-if="branch.maxNegative" class="store-code">{{ branch.maxNegative.kdtk }}</span>
                    </td>
                    <td class="text-center">
                      <Button icon="pi pi-list" size="small" severity="info" text
                        v-tooltip.top="'Top 10 item penyebab'"
                        @click.stop="openBranchDetail(branch)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Branch Detail Modal: Top 10 items -->
    <BranchTopItemsModal
      :show="detailModalVisible"
      :cabang="selectedBranch?.cabang || ''"
      :nama-cabang="selectedBranch?.namaCabang || ''"
      :periode="periode"
      @close="closeBranchDetail"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import Card from 'primevue/card'
import Skeleton from 'primevue/skeleton'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import BranchTopItemsModal from './BranchTopItemsModal.vue'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  periode: { type: String, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  branches: { type: Array, default: () => [] },
})

defineEmits(['refresh'])

const detailModalVisible = ref(false)
const selectedBranch = ref(null)

const periodeDisplay = computed(() => {
  if (!props.periode) return ''
  const year = '20' + props.periode.slice(0, 2)
  const month = props.periode.slice(2)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  return `${monthNames[parseInt(month) - 1] || month} ${year}`
})

const sortedBranches = computed(() => {
  return [...props.branches].sort((a, b) => {
    const aMax = Math.abs(a.maxPositive?.sesui || 0)
    const bMax = Math.abs(b.maxPositive?.sesui || 0)
    return bMax - aMax
  })
})

// Chart: Positive extremes
const chartDataPositive = computed(() => {
  const withPos = props.branches.filter(b => b.maxPositive)
    .sort((a, b) => b.maxPositive.sesui - a.maxPositive.sesui)
    .slice(0, 10)

  return {
    labels: withPos.map(b => b.cabang),
    datasets: [{
      label: 'Plus Terbesar',
      data: withPos.map(b => b.maxPositive.sesui),
      backgroundColor: 'rgba(16, 185, 129, 0.75)',
      borderColor: 'rgba(16, 185, 129, 1)',
      borderWidth: 2,
      borderRadius: 6,
      barPercentage: 0.6,
    }],
  }
})

const chartOptionsPositive = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: ctx => `Rp ${(ctx.parsed.x || 0).toLocaleString('id-ID')}`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.06)' },
      ticks: {
        font: { size: 11 },
        callback: v => v >= 1000000 ? `Rp ${(v / 1000000).toFixed(0)}jt` : `Rp ${(v / 1000).toFixed(0)}rb`,
      },
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11, weight: '600' } },
    },
  },
}

// Chart: Negative extremes
const chartDataNegative = computed(() => {
  const withNeg = props.branches.filter(b => b.maxNegative)
    .sort((a, b) => a.maxNegative.sesui - b.maxNegative.sesui)
    .slice(0, 10)

  return {
    labels: withNeg.map(b => b.cabang),
    datasets: [{
      label: 'Minus Terbesar',
      data: withNeg.map(b => Math.abs(b.maxNegative.sesui)),
      backgroundColor: 'rgba(239, 68, 68, 0.75)',
      borderColor: 'rgba(239, 68, 68, 1)',
      borderWidth: 2,
      borderRadius: 6,
      barPercentage: 0.6,
    }],
  }
})

const chartOptionsNegative = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: ctx => `Rp ${(ctx.parsed.x || 0).toLocaleString('id-ID')}`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.06)' },
      ticks: {
        font: { size: 11 },
        callback: v => v >= 1000000 ? `Rp ${(v / 1000000).toFixed(0)}jt` : `Rp ${(v / 1000).toFixed(0)}rb`,
      },
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11, weight: '600' } },
    },
  },
}

function formatCurrency(value) {
  const num = Number(value) || 0
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num)
}

function openBranchDetail(branch) {
  selectedBranch.value = branch
  detailModalVisible.value = true
}

function closeBranchDetail() {
  detailModalVisible.value = false
  selectedBranch.value = null
}
</script>

<style scoped>
.branch-recap-panel { margin-bottom: 1.5rem; }
.recap-card { border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
.recap-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
  padding: 0.85rem 1.25rem; color: white;
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;
}
.recap-header-left { display: flex; align-items: center; gap: 0.65rem; }
.recap-header-left i { font-size: 1.2rem; opacity: 0.9; }
.recap-title { margin: 0; font-size: 1rem; font-weight: 600; }
.recap-header-right { display: flex; align-items: center; gap: 0.75rem; }
.recap-periode { font-size: 0.8rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.65rem; border-radius: 6px; font-weight: 500; }

.recap-loading { padding: 1.25rem; }
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }

.recap-error, .recap-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 200px; color: #9ca3af; gap: 0.75rem; padding: 2rem;
}
.recap-error i, .recap-empty i { font-size: 2.5rem; opacity: 0.5; }
.recap-error p, .recap-empty p { margin: 0; font-size: 0.9rem; }
.recap-error { color: #ef4444; }

.recap-content { padding: 1.25rem; }

/* Chart sections */
.chart-section {
  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem;
  margin-bottom: 1rem;
}
.chart-header-inline {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.chart-title-wrap { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.9rem; color: #374151; }
.chart-icon-positive { color: #10b981; font-size: 1rem; }
.chart-icon-negative { color: #ef4444; font-size: 1rem; }
.chart-hint { font-size: 0.72rem; color: #6b7280; }
.chart-container { height: 280px; position: relative; }

/* Table */
.section-title {
  display: flex; align-items: center; gap: 0.5rem;
  margin: 0 0 0.75rem; font-size: 0.9rem; font-weight: 600; color: #374151;
}
.section-count { font-size: 0.75rem; color: #6b7280; font-weight: 500; margin-left: auto; }

.branch-table-wrap { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
.branch-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; white-space: nowrap; }
.branch-table th {
  background: #f1f5f9; padding: 0.55rem 0.6rem; text-align: left;
  font-weight: 700; color: #374151; border-bottom: 2px solid #e2e8f0;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.02em;
}
.branch-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
.branch-table tbody tr { cursor: pointer; transition: background 0.15s ease; }
.branch-table tbody tr:hover { background: #e0f2fe; }
.branch-table tbody tr:last-child td { border-bottom: none; }
.has-extreme td:first-child { border-left: 3px solid #3b82f6; }

.branch-info { display: flex; align-items: center; gap: 0.4rem; }
.branch-tag { font-weight: 700; font-size: 0.7rem; }

.value-positive { color: #059669; font-weight: 700; font-family: monospace; font-size: 0.8rem; }
.value-negative { color: #dc2626; font-weight: 700; font-family: monospace; font-size: 0.8rem; }
.no-data { color: #9ca3af; }
.item-code { font-family: monospace; font-size: 0.75rem; color: #374151; cursor: help; }
.store-code { font-size: 0.7rem; color: #6b7280; font-family: monospace; }

.text-right { text-align: right; }
.text-center { text-align: center; }

@media (max-width: 768px) {
  .recap-header { flex-direction: column; align-items: flex-start; }
  .chart-container { height: 220px; }
  .recap-content { padding: 0.75rem; }
}
</style>
