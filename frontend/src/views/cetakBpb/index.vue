<template>
  <div class="cetak-bpb-view">
    <PageHeader 
      title="Cetak BPB" 
      subtitle="Utility untuk cetak ulang Bukti Penerimaan Barang ke PDF" 
      description="Halaman ini memungkinkan Anda untuk melakukan screening dan cetak ulang dokumen BPB dari toko secara remote. Anda dapat memilih cabang tertentu atau toko-toko spesifik untuk memproses nomor bukti yang diinginkan."
    />
    
    <div class="content-container mt-4">
      <!-- Form Section -->
      <CetakBpbForm 
        :is-processing="isProcessing"
        @process="handleProcess"
        @complete="handleComplete"
      />
      
      <!-- Results Section -->
      <transition name="fade">
        <CetakBpbResults 
          v-if="results && !isProcessing" 
          :results="results" 
        />
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import CetakBpbForm from './components/CetakBpbForm.vue';
import CetakBpbResults from './components/CetakBpbResults.vue';
import cetakBpbService from '@/services/cetak-bpb.service';
import { useToastService } from '@/utils/toast';

const toast = useToastService();

// State
const isProcessing = ref(false);
const results = ref(null);

// Methods
const handleProcess = async (formData) => {
  try {
    isProcessing.value = true;
    results.value = null;
    
    toast.showInfo('Info', 'Memulai proses cetak BPB...', 3000);
    
    const response = await cetakBpbService.processCetakBpb(formData);
    
    // Response handling handled by handleComplete via event from form if success
    // but we also get it here. In this module, the service returns the result directly.
    // However, the progress tracking is handled inside the form.
    // We'll set results here when the API call finishes.
    
    results.value = response;
    
    if (response.success > 0) {
      toast.showSuccess('Sukses', `Berhasil memproses ${response.success} toko`);
    } else if (response.failed && response.failed.length > 0) {
      toast.showWarn('Peringatan', 'Proses selesai namun semua toko gagal');
    }
    
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Terjadi kesalahan saat memproses';
    toast.showError('Error', errorMessage);
    console.error('Process error:', error);
  } finally {
    isProcessing.value = false;
  }
};

const handleComplete = (data) => {
  // If we want to handle completion from the event source instead of the direct API call
  console.log('Progress completed event received:', data);
};
</script>

<style scoped>
.cetak-bpb-view {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.content-container {
  display: flex;
  flex-direction: column;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .cetak-bpb-view {
    padding: 1rem;
  }
}
</style>
