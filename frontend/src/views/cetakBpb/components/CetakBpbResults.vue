<template>
  <div v-if="results" class="cetak-bpb-results-card card mt-4">
    <div class="results-header">
      <div class="result-title-section">
        <i class="pi pi-info-circle info-icon"></i>
        <div class="title-text">
          <h3 class="results-title">Hasil Proses Cetak BPB</h3>
          <p class="results-subtitle">Ringkasan status pemrosesan dari tiap toko</p>
        </div>
      </div>
      <div class="summary-badges">
        <Tag severity="success" :value="`${results.success} Success`" class="mr-2" />
        <Tag v-if="results.failed && results.failed.length > 0" severity="danger" :value="`${results.failed.length} Failed`" />
      </div>
    </div>

    <div class="stats-grid mt-4">
      <div class="stat-card">
        <span class="stat-label">Total Toko</span>
        <span class="stat-value">{{ results.total }}</span>
      </div>
      <div class="stat-card success">
        <span class="stat-label">Berhasil</span>
        <span class="stat-value">{{ results.success }}</span>
      </div>
      <div class="stat-card failed">
        <span class="stat-label">Gagal</span>
        <span class="stat-value">{{ results.failed?.length || 0 }}</span>
      </div>
    </div>

    <!-- Failed Stores Table -->
    <div v-if="results.failed && results.failed.length > 0" class="failed-section mt-4">
      <h4 class="section-title text-red-600 mb-2">
        <i class="pi pi-times-circle mr-2"></i>Daftar Toko Gagal
      </h4>
      <DataTable :value="results.failed" class="p-datatable-sm" responsiveLayout="scroll">
        <Column field="storeCode" header="Kode Toko" sortable style="width: 20%"></Column>
        <Column field="error" header="Pesan Error" style="width: 80%">
          <template #body="{ data }">
            <span class="text-red-500">{{ data.error }}</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Output Files Info (Optional) -->
    <div v-if="results.outputFiles && results.outputFiles.length > 0" class="output-section mt-4">
      <h4 class="section-title text-green-600 mb-2">
        <i class="pi pi-check-circle mr-2"></i>File Berhasil Dibuat
      </h4>
      <p class="text-gray-600">
        {{ results.outputFiles.length }} file PDF telah digenerate di server. 
        <br/>
        <small>Lokasi: <code>backend/output/bpb/</code></small>
      </p>
    </div>
  </div>
</template>

<script setup>
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';

const props = defineProps({
  results: {
    type: Object,
    default: null
  }
});
</script>

<style scoped>
.cetak-bpb-results-card {
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 1rem;
}

.result-title-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.info-icon {
  font-size: 1.5rem;
  color: #3b82f6;
}

.results-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.results-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-card {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid #e2e8f0;
}

.stat-card.success {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.stat-card.failed {
  background: #fef2f2;
  border-color: #fecaca;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
}

.stat-card.success .stat-value {
  color: #16a34a;
}

.stat-card.failed .stat-value {
  color: #dc2626;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
