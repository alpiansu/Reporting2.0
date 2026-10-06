<template>
  <div class="rekon-wt-harian-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-history"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Rekonsiliasi WT Harian</h1>
          <p class="header-subtitle">
            Informasi selisih transaksi antara WRC dan toko harian
          </p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Active Filter Badge -->
        <div v-if="activePeriode" class="active-filter-badge">
          <i class="pi pi-calendar"></i>
          <span>Periode: <strong>{{ formatDisplayPeriode(activePeriode) }}</strong></span>
          <span v-if="activeCab" class="cab-sub-badge">Cabang: {{ activeCab }}</span>
        </div>

        <!-- Refresh Button -->
        <button
          type="button"
          class="btn-header-secondary"
          @click="triggerRefresh"
          title="Muat ulang hasil rekonsiliasi WT harian"
        >
          <i class="pi pi-refresh"></i>
          <span>Refresh Data</span>
        </button>
      </div>
    </header>

    <div class="content-container">
      <!-- Form Section -->
      <RekonWtHarianForm @view-results="handleViewResults" />
      
      <!-- Results Section -->
      <div v-if="showResults" class="results-section">
        <RekonWtHarianResults 
          ref="resultsComponent"
          :cab="activeCab" 
          :periode="activePeriode" 
          :auto-load="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import RekonWtHarianForm from '../../components/rekonWtHarian/RekonWtHarianForm.vue';
import RekonWtHarianResults from '../../components/rekonWtHarian/RekonWtHarianResults.vue';

// State
const activeCab = ref('');
const activePeriode = ref('');
const resultsComponent = ref(null);

// Computed
const showResults = computed(() => {
  return !!activePeriode.value;
});

const formatDisplayPeriode = (val) => {
  if (!val) return '';
  if (val.length === 4) {
    return `${val.substring(2, 4)}/20${val.substring(0, 2)}`;
  }
  return val;
};

// Methods
const handleViewResults = (data) => {
  activeCab.value = data.cab;
  activePeriode.value = data.periode;
  
  if (resultsComponent.value) {
    setTimeout(() => {
      if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
        resultsComponent.value.loadResults();
      }
    }, 200);
  }
};

const triggerRefresh = () => {
  if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
    resultsComponent.value.loadResults({}, true);
  }
};
</script>

<style scoped src="./RekonWtHarianView.style.css"></style>