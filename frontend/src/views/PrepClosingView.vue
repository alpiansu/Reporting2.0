<template>
  <div class="prep-closing-view">
    <PageHeader 
      title="Screening Persiapan Closing" 
      subtitle="Informasi kesiapan data untuk proses closing" 
      description="Halaman ini menampilkan hasil screening yang telah diproses oleh sistem. Screening dilakukan untuk memastikan kesiapan data sebelum proses closing periode."
    />
    
    <div class="content-container">
      <!-- Form Section -->
      <PrepClosingForm @view-results="handleViewResults" />
      
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
import { ref, computed, nextTick } from 'vue';
import PageHeader from '../components/prepClosing/PageHeader.vue';
import PrepClosingForm from '../components/prepClosing/PrepClosingForm.vue';
import PrepClosingResults from '../components/prepClosing/PrepClosingResults.vue';

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
const handleViewResults = async (data) => {
  console.log('handleViewResults called with data:', data);
  
  // Validate data before processing
  if (!data || typeof data !== 'object') {
    console.warn('Invalid data received in handleViewResults:', data);
    return;
  }
  
  // Update reactive values safely
  activeCab.value = data.cab || '';
  activePeriode.value = data.periode || '';
  
  // Use nextTick to ensure DOM updates are complete
  await nextTick();
  
  // Force refresh of results component if it exists
  if (resultsComponent.value) {
    console.log('Calling loadResults on resultsComponent');
    try {
      // Ensure component is properly mounted and function exists
      if (typeof resultsComponent.value.loadResults === 'function') {
        await resultsComponent.value.loadResults();
      } else {
        console.warn('loadResults function not available on resultsComponent');
      }
    } catch (error) {
      console.error('Error calling loadResults:', error);
    }
  }
};

const getCabangDisplay = (cab) => {
  if (cab === '' || cab === 'SEMUA') {
    return 'SEMUA CABANG';
  }
  return cab;
};

const formatPeriode = (periode) => {
  if (!periode || periode.length !== 4) return periode;
  
  const year = '20' + periode.substring(0, 2);
  const month = parseInt(periode.substring(2, 4));
  
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