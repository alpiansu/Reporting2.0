<template>
  <div class="cetak-nrb-view">
    <!-- View Header (Modern Single Source of Truth) -->
    <div class="view-header">
      <div class="view-header__left">
        <div class="view-header__icon-badge">
          <i class="pi pi-file-pdf"></i>
        </div>
        <div>
          <h1 class="view-header__title">Cetak Nota Retur Barang (NRB)</h1>
          <p class="view-header__subtitle">Utility cetak ulang dokumen NRB dari toko atau WRC ke format PDF</p>
        </div>
      </div>
      <div class="view-header__actions">
        <div class="active-badge">
          <i class="pi pi-info-circle"></i>
          <span>Format: Dokumen PDF Resmi</span>
        </div>
      </div>
    </div>

    <div class="content-container">
      <CetakNrbForm
        :is-processing="isProcessing"
        @process="handleProcess"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import CetakNrbForm from './components/CetakNrbForm.vue';
import cetakNrbService from '@/services/cetak-nrb.service';
import { useToastService } from '@/utils/toast';

const toast = useToastService();
const isProcessing = ref(false);

const handleProcess = async (formData) => {
  try {
    isProcessing.value = true;
    toast.showInfo('Info', 'Memproses dokumen NRB...', 3000);
    const response = await cetakNrbService.processCetakNrb(formData);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const filename = `NRB_${formData.store}_${formData.bukti_no}.pdf`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.showSuccess('Sukses', 'Dokumen NRB berhasil diunduh');
  } catch (error) {
    let errorMessage = 'Terjadi kesalahan saat memproses';
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

<style scoped src="./index.style.css"></style>
