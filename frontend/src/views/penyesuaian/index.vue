<template>
  <div class="rekon-penyesuaian-view">
    <PageHeader
      title="Hasil Rekonsiliasi Penyesuaian Toko"
      subtitle="Informasi Nilai Penyesuaian berdasarkan data toko"
      description="Halaman ini menampilkan hasil rekonsiliasi nilai penyesuaian dari toko per h-1 tanggal screening untuk deteksi dini terkait nilai penyesuaian yang tidak wajar."
    />

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
import { ref, computed } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import PenyesuaianForm from '../../components/penyesuaian/PenyesuaianForm.vue'
import PenyesuaianResults from '../../components/penyesuaian/PenyesuaianResults.vue'
import BranchRecapPanel from '../../components/penyesuaian/BranchRecapPanel.vue'
import { penyesuaianService } from '../../services/index.js'

// State
const activeCab = ref('')
const activePeriode = ref('')
const resultsComponent = ref(null)
const branchData = ref([])
const branchLoading = ref(false)
const branchError = ref('')

// Computed
const showResults = computed(() => {
  return activePeriode.value
})

// Methods
async function loadBranchExtremes() {
  if (!activePeriode.value) return
  branchLoading.value = true
  branchError.value = ''
  try {
    const res = await penyesuaianService.getBranchExtremes(activePeriode.value)
    branchData.value = res?.data?.data || []
  } catch (e) {
    branchError.value = e?.response?.data?.message || e.message || 'Gagal memuat rekap cabang'
    branchData.value = []
  } finally {
    branchLoading.value = false
  }
}

function handleViewResults(data) {
  activeCab.value = data.cab
  activePeriode.value = data.periode

  // Load branch extremes
  loadBranchExtremes()

  // Force refresh of results component if it exists
  if (resultsComponent.value) {
    setTimeout(() => {
      if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
        resultsComponent.value.loadResults()
      } else {
        console.warn('loadResults function not available on resultsComponent')
      }
    }, 200)
  }
}
</script>

<style scoped src="./index.style.css"></style>
