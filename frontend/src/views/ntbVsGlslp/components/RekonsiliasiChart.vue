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

<style scoped>
.chart-section {
  margin-bottom: 1rem;
}

.chart-section-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.chart-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
  padding: 0.85rem 1.25rem;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chart-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chart-title i {
  font-size: 1.15rem;
}

.chart-legend-inline {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.12);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* States */
.chart-loading {
  padding: 1.25rem;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.chart-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  color: #9ca3af;
  gap: 0.5rem;
  padding: 2rem;
}

.chart-state i {
  font-size: 2.5rem;
  opacity: 0.5;
}

.chart-state p {
  margin: 0;
  font-size: 0.875rem;
}

/* Pie Grid */
.pie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  padding: 1.25rem;
}

.pie-card-wrapper {
  break-inside: avoid;
}

.pie-card {
  border-radius: 10px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pie-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.pie-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #f0f0f0;
}

.cabang-tag {
  font-weight: 700;
  font-size: 0.85rem;
}

.pie-total {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.pie-container {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0;
}

.pie-stats {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.pie-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  background: #f9fafb;
  min-width: 60px;
}

.pie-stat-value {
  font-size: 1rem;
  font-weight: 700;
}

.pie-stat-label {
  font-size: 0.6rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.pie-stat.ok .pie-stat-value { color: #10b981; }
.pie-stat.file-hr .pie-stat-value { color: #ef4444; }
.pie-stat.perlu-dicek .pie-stat-value { color: #f59e0b; }

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .pie-grid {
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }
  .pie-container {
    height: 180px;
  }
}
</style>
