<template>
  <Card class="issue-bar-card">
    <template #header>
      <div class="bar-header">
        <h3 class="bar-title">
          <i class="pi pi-exclamation-triangle"></i>
          Toko Bermasalah
        </h3>
        <div class="bar-header-right">
          <div class="bar-tolerance-badge" title="Nilai toleransi selisih (dari konfigurasi)">
            <i class="pi pi-sliders-h"></i>
            Rp {{ formatNumber(toleranceAmount) }}
          </div>
        </div>
      </div>
    </template>
    <template #content>
      <div class="bar-body">
        <!-- Loading State -->
        <div v-if="loading" class="bar-loading">
          <Skeleton width="100%" height="180px" />
        </div>

        <!-- Chart -->
        <div v-else-if="hasData" class="bar-layout">
          <!-- Large Issue Count Display -->
          <div class="bar-count-display">
            <div class="bar-count-main">
              <span class="bar-count-value" :style="{ color: barColor }">
                {{ summary.stores_to_follow_up || 0 }}
              </span>
              <span class="bar-count-label">Perlu Follow Up</span>
            </div>
            <div class="bar-count-total">
              <span class="bar-count-from">dari</span>
              <span class="bar-count-total-value">{{ summary.total_stores || 0 }}</span>
              <span class="bar-count-from">total toko</span>
            </div>
          </div>

          <!-- Horizontal Bar -->
          <div class="bar-visual">
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{
                  width: fillPercent + '%',
                  background: barGradient,
                }"
              >
                <span v-if="fillPercent > 15" class="bar-fill-label">
                  {{ fillPercent.toFixed(1) }}%
                </span>
              </div>
              <div
                v-if="fillPercent <= 15"
                class="bar-fill-label-outside"
                :style="{ color: barColor }"
              >
                {{ fillPercent.toFixed(1) }}%
              </div>
            </div>
            <div class="bar-axis">
              <span class="bar-axis-label bar-axis-ideal">0</span>
              <span class="bar-axis-label bar-axis-mid">{{ Math.round(summary.total_stores / 2) }}</span>
              <span class="bar-axis-label bar-axis-max">{{ summary.total_stores }}</span>
            </div>
          </div>

          <!-- Status Message -->
          <div class="bar-message" :class="messageClass">
            <i :class="messageIcon"></i>
            <span>{{ statusMessage }}</span>
          </div>
        </div>

        <!-- No Data -->
        <div v-else class="bar-empty">
          <i class="pi pi-check-circle"></i>
          <p>Belum ada data rekonsiliasi untuk ditampilkan</p>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { computed } from 'vue';
import Card from 'primevue/card';
import Skeleton from 'primevue/skeleton';

const props = defineProps({
  summary: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  toleranceAmount: {
    type: Number,
    default: undefined,
  },
});

const hasData = computed(() => {
  return (
    props.summary &&
    typeof props.summary.total_stores === 'number' &&
    props.summary.total_stores > 0
  );
});

const storesToFollowUp = computed(() => props.summary.stores_to_follow_up || 0);
const totalStores = computed(() => props.summary.total_stores || 0);

const fillPercent = computed(() => {
  if (!totalStores.value) return 0;
  return (storesToFollowUp.value / totalStores.value) * 100;
});

// Hanya 2 state: 0 (hijau) atau >0 (merah — perlu follow-up)
const barColor = computed(() => {
  return storesToFollowUp.value === 0 ? '#10b981' : '#ef4444';
});

const barGradient = computed(() => {
  if (storesToFollowUp.value === 0) return 'linear-gradient(90deg, #10b981, #34d399)';
  return 'linear-gradient(90deg, #ef4444, #dc2626)';
});

const messageClass = computed(() => {
  return storesToFollowUp.value === 0 ? 'message-ok' : 'message-bad';
});

const messageIcon = computed(() => {
  return storesToFollowUp.value === 0 ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle';
});

const statusMessage = computed(() => {
  if (!hasData.value) return '';
  
  if (storesToFollowUp.value === 0) {
    return 'Semua toko sudah di-follow up — Tidak ada toko yang perlu ditindaklanjuti.';
  }
  
  const pct = fillPercent.value.toFixed(1);
  return `${storesToFollowUp.value} dari ${totalStores.value} toko (${pct}%) PERLU SEGERA di-follow up!`;
});

const formatNumber = (value) => {
  return new Intl.NumberFormat('id-ID').format(value || 0);
};
</script>

<style scoped>
.issue-bar-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  height: 100%;
}

.bar-header {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  padding: 1rem 1.25rem;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bar-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bar-title i {
  font-size: 1.15rem;
  color: #f59e0b;
}

.bar-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.bar-target-badge {
  font-size: 0.72rem;
  padding: 0.25rem 0.6rem;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 6px;
  color: #34d399;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.bar-target-badge i {
  font-size: 0.65rem;
}

.bar-tolerance-badge {
  font-size: 0.72rem;
  padding: 0.25rem 0.6rem;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.bar-tolerance-badge i {
  font-size: 0.65rem;
  opacity: 0.7;
}

.bar-body {
  padding: 1.5rem;
  min-height: 200px;
}

.bar-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.bar-layout {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Large Issue Count Display */
.bar-count-display {
  text-align: center;
  padding: 0.5rem 0;
}

.bar-count-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.bar-count-value {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
  transition: color 0.3s ease;
}

.bar-count-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bar-count-total {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.25rem;
}

.bar-count-from {
  font-size: 0.8rem;
  color: #94a3b8;
}

.bar-count-total-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

/* Horizontal Bar */
.bar-visual {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bar-track {
  width: 100%;
  height: 32px;
  background: #f1f5f9;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
}

.bar-fill {
  height: 100%;
  border-radius: 16px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  min-width: 0;
  position: relative;
}

.bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 50%,
    rgba(0, 0, 0, 0.05) 100%
  );
}

.bar-fill-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
}

.bar-fill-label-outside {
  position: absolute;
  right: -4rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  font-weight: 700;
}

.bar-axis {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}

.bar-axis-label {
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 500;
}

.bar-axis-ideal {
  color: #10b981;
  font-weight: 700;
}

/* Status Message */
.bar-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.4;
}

.bar-message i {
  font-size: 1rem;
  flex-shrink: 0;
}

.message-ok {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.message-ok i {
  color: #10b981;
}

.message-warn {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.message-warn i {
  color: #f59e0b;
}

.message-bad {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.message-bad i {
  color: #ef4444;
}

/* Empty State */
.bar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #9ca3af;
  gap: 0.5rem;
}

.bar-empty i {
  font-size: 2.5rem;
  opacity: 0.5;
  color: #10b981;
}

.bar-empty p {
  margin: 0;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .bar-count-value {
    font-size: 2.25rem;
  }

  .bar-body {
    padding: 1.25rem;
  }
}

@media (max-width: 576px) {
  .bar-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .bar-header-right {
    justify-content: center;
  }
}
</style>
