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

<style scoped src="./BranchRecapPanel.style.css"></style>
