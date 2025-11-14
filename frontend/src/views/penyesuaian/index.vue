<template>
    <div class="rekon-virtual-mrg-view">
        <PageHeader title="Hasil Rekonsiliasi Penyesuaian Toko"
            subtitle="Informasi Nilai Penyesuaian berdasarkan data toko"
            description="Halaman ini menampilkan hasil rekonsiliasi nilai penyesuaian dari toko per h-1 tanggal screening untuk deteksi dini terkait nilai penyesuaian yang tidak wajar." />

        <div class="content-container">
            <!-- Form Section -->
            <PenyesuaianForm @view-results="handleViewResults" />

            <!-- Results Section -->
            <div v-if="showResults" class="results-section">
                <PenyesuaianResults ref="resultsComponent" :cab="activeCab" :periode="activePeriode"
                    :auto-load="true" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PageHeader from '../../components/PageHeader.vue';
import PenyesuaianForm from '../../components/penyesuaian/PenyesuaianForm.vue';
import PenyesuaianResults from '../../components/penyesuaian/PenyesuaianResults.vue';

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

    // Force refresh of results component if it exists
    // Gunakan nextTick untuk memastikan komponen sudah dirender
    if (resultsComponent.value) {
        // Pastikan komponen sudah dirender dan fungsi loadResults tersedia
        setTimeout(() => {
            if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
                resultsComponent.value.loadResults();
            } else {
                console.warn('loadResults function not available on resultsComponent');
            }
        }, 200);
    }
};
</script>

<style scoped>
.rekon-virtual-mrg-view {
    padding: 1.5rem;
}

.content-container {
    display: flex;
    flex-direction: column;
}

.results-section {
    margin-top: 1rem;
}

@media (max-width: 768px) {
    .rekon-virtual-mrg-view {
        padding: 1rem;
    }
}
</style>
