<template>
  <Dialog v-model:visible="localVisible" header="Detail Harian" :modal="true" :style="{ width: '900px' }">
    <div v-if="detail">
      <TabView>
        <TabPanel header="Ringkasan">
          <div class="detail-grid">
            <div><strong>Toko</strong><div>{{ detail.KDTK }} - {{ detail.NAMA }}</div></div>
            <div><strong>Cabang</strong><div>{{ detail.CABANG || detail.CAB || '-' }}</div></div>
            <div><strong>Tanggal</strong><div>{{ detail.TANGGAL }}</div></div>
            <div><strong>NET MTRAN</strong><div>{{ formatNumber(detail.NET_MTRAN) }}</div></div>
            <div><strong>NET GL</strong><div>{{ formatNumber(detail.NET_GL) }}</div></div>
            <div><strong>NET Closing Detail</strong><div>{{ formatNumber(detail.NET_CLOSINGDETAIL) }}</div></div>
            <div><strong>SEL NET GL</strong><div :class="amountClass(detail.SEL_NET_GL)">{{ formatNumber(detail.SEL_NET_GL) }}</div></div>
            <div><strong>SEL NET CD</strong><div :class="amountClass(detail.SEL_NET_CD)">{{ formatNumber(detail.SEL_NET_CD) }}</div></div>
          </div>
        </TabPanel>
        <TabPanel header="Differences">
          <DataTable :value="differences" :loading="diffLoading" dataKey="DOCNO">
            <Column field="DOCNO" header="DOCNO" />
            <Column field="SEQNO" header="SEQNO" />
            <Column field="NET_MTRAN" header="NET MTRAN" />
            <Column field="NET_CD" header="NET CD" />
            <Column field="SEL_NET_CD" header="SEL NET CD" />
          </DataTable>
        </TabPanel>
        <TabPanel header="Kode Pesanan">
          <DataTable :value="kodePesananIssues" :loading="kodeLoading" dataKey="id">
            <Column field="SUBKEY" header="Subkey" />
            <Column field="KODEPESANANTOKO" header="Kode Toko" />
            <Column field="KODEPSANANGL" header="Kode GL" />
            <Column field="SELKODE" header="Selisih" />
          </DataTable>
        </TabPanel>
      </TabView>
      <div class="dialog-actions">
        <Button label="Catatan" icon="pi pi-pencil" class="p-button-text" @click="$emit('open-note', detail)" />
        <Button label="Re-screen" icon="pi pi-refresh" class="p-button-text" @click="$emit('re-screen', detail)" />
        <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="localVisible=false" />
      </div>
    </div>
  </Dialog>
  </template>

<script setup>
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { formatNumber } from '../utils/formatters';

const props = defineProps({
  visible: { type: Boolean, default: false },
  detail: { type: Object, default: () => null },
  differences: { type: Array, default: () => [] },
  diffLoading: { type: Boolean, default: false },
  kodePesananIssues: { type: Array, default: () => [] },
  kodeLoading: { type: Boolean, default: false }
});

const emit = defineEmits(['open-note', 're-screen', 'update:visible']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));

const amountClass = (n) => Number(n || 0) >= 0 ? 'amount-positive' : 'amount-negative';
</script>

<style scoped>
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; margin-bottom: 1rem; }
.dialog-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .75rem; }
.amount-positive { color: #10b981; }
.amount-negative { color: #ef4444; }
</style>
