<template>
  <div class="rekon-wt-harian-view">
    <PageHeader 
      title="Hasil Rekonsiliasi WT Harian" 
      subtitle="Informasi selisih transaksi antara WRC dan toko" 
      description="Halaman ini menampilkan hasil rekonsiliasi yang telah diproses oleh sistem. Rekonsiliasi dilakukan secara otomatis pada waktu tertentu untuk memastikan keakuratan data transaksi antara WRC dan toko."
    />
    
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
import PageHeader from '../../components/PageHeader.vue';
import RekonWtHarianForm from '../../components/rekonWtHarian/RekonWtHarianForm.vue';
import RekonWtHarianResults from '../../components/rekonWtHarian/RekonWtHarianResults.vue';

// State
const activeCab = ref('');
const activePeriode = ref('');
const resultsComponent = ref(null);

// Computed
const showResults = computed(() => {
  // Hanya perlu memeriksa periode, karena cabang bisa kosong (untuk semua cabang)
  return activePeriode.value;
});

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
</script>

<style scoped>
.rekon-wt-harian-view {
  padding: 1.5rem;
}

.content-container {
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 1.25rem;
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--primary-color);
}

.section-subtitle {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.results-section {
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .rekon-wt-harian-view {
    padding: 1rem;
  }
}
</style>