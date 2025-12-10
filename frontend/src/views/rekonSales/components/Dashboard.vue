<template>
  <div class="dashboard-grid">
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
.summary-card { border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.1); background: #fff; padding: 1.25rem; transition: transform .2s ease, box-shadow .2s ease; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; gap: .25rem; }
.summary-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
.card-header { display: flex; align-items: center; gap: .75rem; margin-bottom: .25rem; }
.card-icon { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-title { font-weight: 600; font-size: 1rem; }
.card-value { font-weight: 700; font-size: 1.125rem; }
.card-subtitle { color: #6b7280; font-size: .75rem; }

@media (max-width: 1024px) { .dashboard-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
@media (max-width: 640px) { .dashboard-grid { grid-template-columns: 1fr; } }
</style>
