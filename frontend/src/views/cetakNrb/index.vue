<template>
  <div class="cetak-nrb-view">
    <PageHeader
      title="Cetak NRB"
      subtitle="Utility untuk cetak ulang Nota Retur Barang ke PDF"
      description="Halaman ini memungkinkan Anda untuk melakukan cetak ulang dokumen NRB dari toko atau WRC secara remote. Anda dapat memilih sumber data (Toko atau WRC), cabang, dan toko untuk memproses nomor bukti yang diinginkan."
    />
    <div class="content-container mt-4">
      <CetakNrbForm
        :is-processing="isProcessing"
        @process="handleProcess"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
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

<style scoped>
.cetak-nrb-view { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
.content-container { display: flex; flex-direction: column; }
@media (max-width: 768px) { .cetak-nrb-view { padding: 1rem; } }
</style>
