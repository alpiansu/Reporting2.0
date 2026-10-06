<template>
  <div class="rekon-virtual-mrg-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-calculator"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Hasil Rekonsiliasi Saldo Virtual Margin Based</h1>
          <p class="header-subtitle">
            Informasi saldo virtual berdasarkan margin produk per toko &amp; deteksi selisih stok secara otomatis
          </p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Active Filter Badge -->
        <div v-if="activePeriode" class="active-filter-badge">
          <i class="pi pi-calendar"></i>
          <span>Periode: <strong>{{ activePeriode }}</strong></span>
          <span v-if="activeCab" class="cab-sub-badge">Cabang: {{ activeCab }}</span>
        </div>

        <!-- Refresh Button -->
        <button
          v-if="showResults"
          type="button"
          class="btn-header-secondary"
          @click="refreshResults"
          title="Muat ulang hasil rekonsiliasi"
        >
          <i class="pi pi-refresh"></i>
          <span>Refresh Hasil</span>
        </button>
      </div>
    </header>

    <div class="content-container">
      <!-- Form Section -->
      <RekonVirtualMrgForm @view-results="handleViewResults" />
      
      <!-- Results Section -->
      <div v-if="showResults" class="results-section">
        <RekonVirtualMrgResults 
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
import RekonVirtualMrgForm from '../../components/rekonVirtualMrg/RekonVirtualMrgForm.vue';
import RekonVirtualMrgResults from '../../components/rekonVirtualMrg/RekonVirtualMrgResults.vue';

// State
const activeCab = ref('');
const activePeriode = ref('');
const resultsComponent = ref(null);

// Computed
const showResults = computed(() => {
  return !!activePeriode.value;
});

// Methods
const handleViewResults = (data) => {
  activeCab.value = data.cab;
  activePeriode.value = data.periode;
  
  if (resultsComponent.value) {
    setTimeout(() => {
      if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
        resultsComponent.value.loadResults();
      } else {
        console.warn('loadResults function not available on resultsComponent');
      }
    }, 200);
  }
};

const refreshResults = () => {
  if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
    resultsComponent.value.loadResults();
  }
};
</script>

<style scoped src="./index.style.css"></style>
