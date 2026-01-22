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
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import CetakBpbForm from './components/CetakBpbForm.vue';
import cetakBpbService from '@/services/cetak-bpb.service';
import { useToastService } from '@/utils/toast';

const toast = useToastService();

// State
const isProcessing = ref(false);

// Methods
const handleProcess = async (formData) => {
  try {
    isProcessing.value = true;
    
    toast.showInfo('Info', 'Memproses dokumen BPB...', 3000);
    
    const response = await cetakBpbService.processCetakBpb(formData);
    
    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Set filename
    const filename = `BPB_${formData.store}_${formData.bukti_no}.pdf`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    link.remove();
    window.URL.revokeObjectURL(url);
    
    toast.showSuccess('Sukses', 'Dokumen BPB berhasil diunduh');
    
  } catch (error) {
    let errorMessage = 'Terjadi kesalahan saat memproses';
    
    // Handle blob error response
    if (error.response?.data instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const errorData = JSON.parse(reader.result);
          toast.showError('Error', errorData.message || errorMessage);
        } catch (e) {
          toast.showError('Error', errorMessage);
        }
      };
      reader.readAsText(error.response.data);
      return;
    }
    
    errorMessage = error.response?.data?.message || error.message || errorMessage;
    toast.showError('Error', errorMessage);
    console.error('Process error:', error);
  } finally {
    isProcessing.value = false;
  }
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
