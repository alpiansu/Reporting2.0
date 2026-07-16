<template>
  <div class="cetak-bpb-view">
    <PageHeader
      title="Cetak Dokumen"
      subtitle="Utility untuk cetak ulang Bukti Penerimaan Barang (BPB) dan Nota Retur Barang (NRB) ke PDF"
      description="Halaman ini memungkinkan Anda untuk melakukan cetak ulang dokumen BPB atau NRB dari toko secara remote. Pilih tab dokumen yang ingin dicetak, lalu isi form yang tersedia."
    />

    <div class="content-container mt-4">
      <TabView v-model:activeIndex="activeTab">
        <TabPanel header="Cetak BPB">
          <CetakBpbForm
            :is-processing="isProcessingBpb"
            @process="handleProcessBpb"
          />
        </TabPanel>
        <TabPanel header="Cetak NRB">
          <CetakNrbForm
            :is-processing="isProcessingNrb"
            @process="handleProcessNrb"
          />
        </TabPanel>
      </TabView>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import CetakBpbForm from './components/CetakBpbForm.vue';
import CetakNrbForm from '@/views/cetakNrb/components/CetakNrbForm.vue';
import cetakBpbService from '@/services/cetak-bpb.service';
import cetakNrbService from '@/services/cetak-nrb.service';
import { useToastService } from '@/utils/toast';

const toast = useToastService();

const activeTab = ref(0);
const isProcessingBpb = ref(false);
const isProcessingNrb = ref(false);

const downloadBlob = (response, filename) => {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const handleBlobError = (error, defaultMsg) => {
  let errorMessage = defaultMsg;
  if (error.response?.data instanceof Blob) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const errorData = JSON.parse(reader.result);
        toast.showError('Error', errorData.message || errorMessage);
      } catch {
        toast.showError('Error', errorMessage);
      }
    };
    reader.readAsText(error.response.data);
    return;
  }
  errorMessage = error.response?.data?.message || error.message || errorMessage;
  toast.showError('Error', errorMessage);
};

const handleProcessBpb = async (formData) => {
  try {
    isProcessingBpb.value = true;
    toast.showInfo('Info', 'Memproses dokumen BPB...', 3000);
    const response = await cetakBpbService.processCetakBpb(formData);
    downloadBlob(response, `BPB_${formData.store}_${formData.bukti_no}.pdf`);
    toast.showSuccess('Sukses', 'Dokumen BPB berhasil diunduh');
  } catch (error) {
    handleBlobError(error, 'Terjadi kesalahan saat memproses BPB');
    console.error('BPB process error:', error);
  } finally {
    isProcessingBpb.value = false;
  }
};

const handleProcessNrb = async (formData) => {
  try {
    isProcessingNrb.value = true;
    toast.showInfo('Info', 'Memproses dokumen NRB...', 3000);
    const response = await cetakNrbService.processCetakNrb(formData);
    downloadBlob(response, `NRB_${formData.store}_${formData.bukti_no}.pdf`);
    toast.showSuccess('Sukses', 'Dokumen NRB berhasil diunduh');
  } catch (error) {
    handleBlobError(error, 'Terjadi kesalahan saat memproses NRB');
    console.error('NRB process error:', error);
  } finally {
    isProcessingNrb.value = false;
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

:deep(.p-tabview-panels) {
  padding: 0;
}

:deep(.p-tabview-panel) {
  padding: 0;
}

@media (max-width: 768px) {
  .cetak-bpb-view {
    padding: 1rem;
  }
}
</style>
