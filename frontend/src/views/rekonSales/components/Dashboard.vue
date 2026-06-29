<template>
  <div class="dashboard-grid">
    <template v-if="!summary">
      <div class="empty-dashboard">
        <i class="pi pi-chart-bar empty-icon"></i>
        <p class="empty-text">Belum ada ringkasan. Pilih periode dan jalankan screening.</p>
      </div>
    </template>
    <template v-else>
      <div class="summary-card" v-for="card in cards" :key="card.key">
        <div class="card-header">
          <div class="card-icon">
            <i :class="card.icon"></i>
          </div>
          <div class="card-title">{{ card.title }}</div>
        </div>
        <div class="card-value">{{ card.format ? card.format(card.value) : card.value }}</div>
        <div class="card-subtitle">{{ card.subtitle }}</div>
      </div>
    </template>
  </div>
  </template>

<script setup>
import { computed } from 'vue';
import { formatNumber } from '../utils/formatters';

const props = defineProps({
  summary: { type: Object, default: () => ({}) }
});

const getSummaryValue = (key) => {
  return props.summary?.data?.[key]
    ?? props.summary?.[key]
    ?? 0;
};

const cards = computed(() => [
  { key: 'total_stores', title: 'Total Toko', value: getSummaryValue('total_stores'), icon: 'pi pi-shopping-bag', subtitle: 'Toko aktif', format: formatNumber },
  { key: 'total_issues', title: 'Total Issues', value: getSummaryValue('total_issues'), icon: 'pi pi-exclamation-triangle', subtitle: 'Masalah terdeteksi', format: formatNumber },
  { key: 'total_sel_net_gl', title: 'Total SEL NET GL', value: getSummaryValue('total_sel_net_gl'), icon: 'pi pi-chart-line', subtitle: 'Agregat', format: formatNumber },
  { key: 'total_sel_net_cd', title: 'Total SEL NET CD', value: getSummaryValue('total_sel_net_cd'), icon: 'pi pi-chart-line', subtitle: 'Agregat', format: formatNumber },
  { key: 'total_sel_ppn_gl', title: 'Total SEL PPN GL', value: getSummaryValue('total_sel_ppn_gl'), icon: 'pi pi-percentage', subtitle: 'Agregat', format: formatNumber },
  { key: 'total_sel_ppn_cd', title: 'Total SEL PPN CD', value: getSummaryValue('total_sel_ppn_cd'), icon: 'pi pi-percentage', subtitle: 'Agregat', format: formatNumber }
]);
</script>

<style scoped>
.dashboard-grid { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 1rem; align-items: stretch; }
.summary-card { border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.1); background: var(--surface-color); padding: 1.25rem; transition: transform .2s ease, box-shadow .2s ease; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; gap: .25rem; }
.summary-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
.card-header { display: flex; align-items: center; gap: .75rem; margin-bottom: .25rem; }
.card-icon { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-darken) 100%); color: white; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-title { font-weight: 600; font-size: 1rem; color: var(--text-color); }
.card-value { font-weight: 700; font-size: 1.125rem; color: var(--text-color); }
.card-subtitle { color: var(--text-color-secondary); font-size: .75rem; }
.empty-dashboard { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--text-color-secondary); border-radius: 10px; background: var(--surface-color); box-shadow: 0 2px 8px rgba(0,0,0,.1); }
.empty-dashboard .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-dashboard .empty-text { font-size: 1rem; text-align: center; margin: 0; }

.summary-card {
  animation: cardFadeIn 0.4s ease-out both;
}
.summary-card:nth-child(1) { animation-delay: 0.05s; }
.summary-card:nth-child(2) { animation-delay: 0.10s; }
.summary-card:nth-child(3) { animation-delay: 0.15s; }
.summary-card:nth-child(4) { animation-delay: 0.20s; }
.summary-card:nth-child(5) { animation-delay: 0.25s; }
.summary-card:nth-child(6) { animation-delay: 0.30s; }

@keyframes cardFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1024px) { .dashboard-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
@media (max-width: 640px) { .dashboard-grid { grid-template-columns: 1fr; } }
</style>
