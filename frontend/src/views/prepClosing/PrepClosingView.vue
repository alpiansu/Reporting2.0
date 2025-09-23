<template>
  <div class="prep-closing-view">
    <PageHeader 
      title="Persiapan Closing" 
      subtitle="Screening dan monitoring kesiapan data sebelum proses closing" 
      description="Halaman ini digunakan untuk melakukan screening data WRC dan kesiapan toko sebelum proses closing. Sistem akan melakukan pengecekan otomatis terhadap data saldo dan kondisi toko untuk memastikan kesiapan proses closing."
    />
    
    <div class="content-container">
      <!-- Form Section -->
      <PrepClosingForm @start-screening="handleStartScreening" />
      
      <!-- Results Section -->
      <div v-if="showResults" class="results-section">
        <PrepClosingResults 
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
import PageHeader from '../../components/prepClosing/PageHeader.vue';
import PrepClosingForm from '../../components/prepClosing/PrepClosingForm.vue';
import PrepClosingResults from '../../components/prepClosing/PrepClosingResults.vue';

// State
const activeCab = ref('');
const activePeriode = ref('');
const resultsComponent = ref(null);

// Computed
const showResults = computed(() => {
  // Show results when we have both cab and periode
  return activeCab.value && activePeriode.value;
});

// Methods
const handleStartScreening = (data) => {
  console.log('handleStartScreening called with data:', data);
  activeCab.value = data.cab;
  activePeriode.value = data.periode;
  
  // Force refresh of results component if it exists
  if (resultsComponent.value) {
    console.log('Calling loadResults on resultsComponent');
    // Ensure component is rendered and loadResults function is available
    setTimeout(() => {
      if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
        resultsComponent.value.loadResults();
      } else {
        console.warn('loadResults function not available on resultsComponent');
      }
    }, 200);
  }
};

const getCabangDisplay = (cab) => {
  if (cab === '' || cab === 'SEMUA') {
    return 'SEMUA CABANG';
  }
  return cab;
};

const formatPeriode = (periode) => {
  if (!periode || periode.length !== 6) return periode;
  
  const year = periode.substring(0, 4);
  const month = parseInt(periode.substring(4, 6));
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
};
</script>

<style scoped>
.prep-closing-view {
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
  .prep-closing-view {
    padding: 1rem;
  }
}
</style>