<template>
  <div class="cetak-bpb-view">
    <!-- View Header (Modern Single Source of Truth) -->
    <div class="view-header">
      <div class="view-header__left">
        <div class="view-header__icon-badge">
          <i class="pi pi-print"></i>
        </div>
        <div>
          <h1 class="view-header__title">Cetak Dokumen Toko</h1>
          <p class="view-header__subtitle">Utility cetak ulang Bukti Penerimaan Barang (BPB) dan Nota Retur Barang (NRB) ke format PDF</p>
        </div>
      </div>
      <div class="view-header__actions">
        <div class="active-tab-badge">
          <i :class="activeTab === 0 ? 'pi pi-file' : 'pi pi-file-export'"></i>
          <span>Mode: {{ activeTab === 0 ? 'Cetak BPB' : 'Cetak NRB' }}</span>
        </div>
      </div>
    </div>

    <div class="content-container">
      <TabView v-model:activeIndex="activeTab" class="cetak-tabs">
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-file mr-2"></i>Cetak BPB</span>
          </template>
          <CetakBpbForm
            :is-processing="isProcessingBpb"
            @process="handleProcessBpb"
          />
        </TabPanel>
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-file-export mr-2"></i>Cetak NRB</span>
          </template>
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

<style scoped src="./index.style.css"></style>
