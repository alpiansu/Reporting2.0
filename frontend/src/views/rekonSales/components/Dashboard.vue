<template>
  <div class="dashboard-grid">
    <template v-if="!summary">
      <div class="empty-dashboard">
        <i class="pi pi-chart-bar empty-icon"></i>
        <p class="empty-text">Belum ada ringkasan. Pilih periode dan jalankan screening.</p>
      </div>
    </template>
    <template v-else>
      <div class="summary-card" :class="{ 'summary-card--warning': card.warning }" v-for="card in cards" :key="card.key">
        <div class="card-header">
          <div class="card-icon">
            <i :class="card.icon"></i>
          </div>
          <div class="card-title">{{ card.title }}</div>
        </div>
        <div class="card-value" :class="{ 'card-value--warning': card.warning }">{{ card.format ? card.format(card.value) : card.value }}</div>
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
  { key: 'total_sel_ppn_cd', title: 'Total SEL PPN CD', value: getSummaryValue('total_sel_ppn_cd'), icon: 'pi pi-percentage', subtitle: 'Agregat', format: formatNumber },
  { key: 'total_stores_shop_beda', title: 'Toko SHOP Beda', value: getSummaryValue('total_stores_shop_beda'), icon: 'pi pi-exclamation-circle', subtitle: 'mtran.SHOP ≠ KDTK', format: formatNumber, warning: true }
]);
</script>

<style scoped src="./Dashboard.style.css"></style>
