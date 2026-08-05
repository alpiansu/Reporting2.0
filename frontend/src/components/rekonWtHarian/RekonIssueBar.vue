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

<style scoped src="./RekonIssueBar.style.css"></style>
