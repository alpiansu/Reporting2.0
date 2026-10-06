<template>
  <div class="rekon-penyesuaian-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-sliders-h"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Hasil Rekonsiliasi Penyesuaian Toko</h1>
          <p class="header-subtitle">
            Informasi nilai penyesuaian toko per H-1 tanggal screening untuk deteksi dini selisih tidak wajar
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
          @click="refreshAll"
          title="Muat ulang hasil rekonsiliasi dan rekap cabang"
        >
          <i class="pi pi-refresh"></i>
          <span>Refresh Hasil</span>
        </button>
      </div>
    </header>

    <div class="content-container">
      <!-- Form Section -->
      <PenyesuaianForm @view-results="handleViewResults" />

      <!-- Branch Recap Panel: max plus/minus items per cabang -->
      <div v-if="showResults" class="branch-recap-section">
        <BranchRecapPanel
          :periode="activePeriode"
          :loading="branchLoading"
          :error="branchError"
          :branches="branchData"
          @refresh="loadBranchExtremes"
        />
      </div>

      <!-- Store Results Section -->
      <div v-if="showResults" class="results-section">
        <PenyesuaianResults
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
import PenyesuaianForm from '../../components/penyesuaian/PenyesuaianForm.vue';
import PenyesuaianResults from '../../components/penyesuaian/PenyesuaianResults.vue';
import BranchRecapPanel from '../../components/penyesuaian/BranchRecapPanel.vue';
import { penyesuaianService } from '../../services/index.js';

// State
const activeCab = ref('');
const activePeriode = ref('');
const resultsComponent = ref(null);
const branchData = ref([]);
const branchLoading = ref(false);
const branchError = ref('');

// Computed
const showResults = computed(() => {
  return !!activePeriode.value;
});

// Methods
async function loadBranchExtremes() {
  if (!activePeriode.value) return;
  branchLoading.value = true;
  branchError.value = '';
  try {
    const res = await penyesuaianService.getBranchExtremes(activePeriode.value);
    branchData.value = res?.data?.data || [];
  } catch (e) {
    branchError.value = e?.response?.data?.message || e.message || 'Gagal memuat rekap cabang';
    branchData.value = [];
  } finally {
    branchLoading.value = false;
  }
}

function handleViewResults(data) {
  activeCab.value = data.cab;
  activePeriode.value = data.periode;

  // Load branch extremes
  loadBranchExtremes();

  // Force refresh of results component if it exists
  if (resultsComponent.value) {
    setTimeout(() => {
      if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
        resultsComponent.value.loadResults();
      } else {
        console.warn('loadResults function not available on resultsComponent');
      }
    }, 200);
  }
}

function refreshAll() {
  loadBranchExtremes();
  if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
    resultsComponent.value.loadResults();
  }
}
</script>

<style scoped src="./index.style.css"></style>
