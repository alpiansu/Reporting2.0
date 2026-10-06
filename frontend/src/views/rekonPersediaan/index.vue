<template>
  <div class="rekon-persediaan-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-box"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Rekon Persediaan</h1>
          <p class="header-subtitle">
            Rekonsiliasi HPP Store vs WRC (Bulanan)
          </p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Active Filter Badge -->
        <div v-if="activeFilters?.periode" class="active-filter-badge">
          <i class="pi pi-calendar"></i>
          <span>Periode: <strong>{{ formatDisplayPeriode(activeFilters.periode) }}</strong></span>
          <span v-if="activeFilters.cab" class="cab-sub-badge">Cabang: {{ activeFilters.cab }}</span>
        </div>

        <!-- Refresh Button -->
        <button
          type="button"
          class="btn-header-secondary"
          @click="handleRefresh"
          title="Muat ulang hasil rekonsiliasi persediaan"
        >
          <i class="pi pi-refresh"></i>
          <span>Refresh Data</span>
        </button>
      </div>
    </header>
    
    <div class="content-container">
      <RekonPersediaanForm @view-results="handleViewResults" @screening-started="handleScreeningStarted" />

      <div class="results-section">
        <RekonPersediaanTable ref="rekonTable" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import RekonPersediaanForm from './components/RekonPersediaanForm.vue';
import RekonPersediaanTable from './components/RekonPersediaanTable.vue';
import './RekonPersediaan.style.css';

const rekonTable = ref(null);
const activeFilters = ref(null);

const formatDisplayPeriode = (val) => {
  if (!val) return '';
  if (val.length === 4) {
    return `${val.substring(2, 4)}/20${val.substring(0, 2)}`;
  }
  return val;
};

const handleViewResults = (filters) => {
  activeFilters.value = filters;
  if (rekonTable.value) {
    rekonTable.value.refresh(filters);
  }
};

const handleRefresh = () => {
  if (rekonTable.value) {
    rekonTable.value.refresh(activeFilters.value);
  }
};

const handleScreeningStarted = () => {
  // Logic after screening starts
};
</script>

<style scoped src="./index.style.css"></style>
