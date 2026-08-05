<template>
  <div class="chart-section">
    <Card class="chart-section-card">
      <template #header>
        <div class="chart-header">
          <h3 class="chart-title">
            <i class="pi pi-chart-pie"></i>
            Rangkuman Status per Cabang
          </h3>
          <div class="chart-legend-inline">
            <span class="legend-item">
              <span class="legend-dot" style="background: #ef4444;"></span>
              File HR Tidak Ada
            </span>
            <span class="legend-item">
              <span class="legend-dot" style="background: #f59e0b;"></span>
              Data Perlu Dicek
            </span>
            <span class="legend-item">
              <span class="legend-dot" style="background: #10b981;"></span>
              OK
            </span>
          </div>
        </div>
      </template>
      <template #content>
        <!-- Loading -->
        <div v-if="loading" class="chart-loading">
          <div class="skeleton-grid">
            <Skeleton v-for="n in 6" :key="n" width="100%" height="260px" borderRadius="12px" />
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="chart-state">
          <i class="pi pi-exclamation-triangle"></i>
          <p>Gagal memuat data chart</p>
          <Button label="Coba Lagi" icon="pi pi-refresh" class="p-button-sm p-button-outlined" @click="$emit('retry')" />
        </div>

        <!-- Empty -->
        <div v-else-if="!dataItems.length" class="chart-state">
          <i class="pi pi-chart-pie"></i>
          <p>Pilih periode untuk menampilkan chart</p>
        </div>

        <!-- Pie Chart Grid -->
        <div v-else class="pie-grid">
          <div
            v-for="item in dataItems"
            :key="item.KODE_GUDANG"
            class="pie-card-wrapper"
          >
            <Card class="pie-card">
              <template #header>
                <div class="pie-card-header">
                  <Tag :value="item.KODE_GUDANG" severity="info" class="cabang-tag" />
                  <span class="pie-total">{{ item.total }} records</span>
                </div>
              </template>
              <template #content>
                <div class="pie-container">
                  <Pie :data="getPieData(item)" :options="pieOptions" />
                </div>
                <div class="pie-stats">
                  <div class="pie-stat ok">
                    <span class="pie-stat-value">{{ item.ok }}</span>
                    <span class="pie-stat-label">OK</span>
                  </div>
                  <div class="pie-stat file-hr">
                    <span class="pie-stat-value">{{ item.file_hr_tidak_ada }}</span>
                    <span class="pie-stat-label">HR Tidak Ada</span>
                  </div>
                  <div class="pie-stat perlu-dicek">
                    <span class="pie-stat-value">{{ item.data_perlu_dicek || 0 }}</span>
                    <span class="pie-stat-label">Perlu Dicek</span>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Pie } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
} from 'chart.js';
import Card from 'primevue/card';
import Skeleton from 'primevue/skeleton';
import Button from 'primevue/button';
import Tag from 'primevue/tag';

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale);

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['retry']);

const dataItems = computed(() => Array.isArray(props.items) ? props.items : []);

const COLORS = {
  ok: ['#10b981', '#059669'],
  fileHr: ['#ef4444', '#dc2626'],
  perluDicek: ['#f59e0b', '#d97706'],
};

function getPieData(item) {
  const ok = Number(item.ok) || 0;
  const fileHr = Number(item.file_hr_tidak_ada) || 0;
  const perluDicek = Number(item.data_perlu_dicek) || 0;

  return {
    labels: ['OK', 'File HR Tidak Ada', 'Data Perlu Dicek'],
    datasets: [{
      data: [ok, fileHr, perluDicek],
      backgroundColor: [COLORS.ok[0], COLORS.fileHr[0], COLORS.perluDicek[0]],
      hoverBackgroundColor: [COLORS.ok[1], COLORS.fileHr[1], COLORS.perluDicek[1]],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverBorderWidth: 3,
    }],
  };
}

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '45%',
  animation: {
    animateRotate: true,
    animateScale: true,
    duration: 700,
    easing: 'easeInOutQuart',
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      padding: 10,
      titleFont: { size: 12, weight: 'bold' },
      bodyFont: { size: 11 },
      cornerRadius: 6,
      displayColors: true,
      callbacks: {
        label(context) {
          const label = context.label || '';
          const value = context.parsed || 0;
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
          return `${label}: ${value} (${pct}%)`;
        },
      },
    },
  },
};
</script>

<style scoped src="./RekonsiliasiChart.style.css"></style>
