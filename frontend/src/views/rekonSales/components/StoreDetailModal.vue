<template>
  <Dialog v-model:visible="localVisible" header="Detail Bulanan" :modal="true" :style="{ width: '1000px' }">
    <div v-if="detail">
      <TabView>
        <TabPanel header="Ringkasan">
          <div class="detail-grid">
            <div><strong>Toko</strong><div>{{ summary.KDTK }} - {{ summary.NAMA || '-' }}</div></div>
            <div><strong>Periode</strong><div>{{ summary.year }}-{{ summary.month }}</div></div>
            <div><strong>UPDTIME Terakhir</strong><div>{{ summary.updatetime_latest || '-' }}</div></div>
            <div><strong>Total SEL NET GL</strong><div :class="amountClass(summary.total_sel_net_gl)">{{ formatNumber(summary.total_sel_net_gl) }}</div></div>
            <div><strong>Total SEL NET CD</strong><div :class="amountClass(summary.total_sel_net_cd)">{{ formatNumber(summary.total_sel_net_cd) }}</div></div>
            <div><strong>Total SEL PPN GL</strong><div :class="amountClass(summary.total_sel_ppn_gl)">{{ formatNumber(summary.total_sel_ppn_gl) }}</div></div>
            <div><strong>Total SEL PPN CD</strong><div :class="amountClass(summary.total_sel_ppn_cd)">{{ formatNumber(summary.total_sel_ppn_cd) }}</div></div>
          </div>
          <h4>Rincian per Tanggal</h4>
          <DataTable :value="dailyMetrics" dataKey="tanggal">
            <Column field="tanggal" header="Tanggal" />
            <Column field="net_mtran" header="NET MTRAN" />
            <Column field="net_gl" header="NET GL" />
            <Column field="net_cd" header="NET CD" />
            <Column field="sel_net_gl" header="SEL NET GL" />
            <Column field="sel_net_cd" header="SEL NET CD" />
            <Column field="sel_ppn_gl" header="SEL PPN GL" />
            <Column field="sel_ppn_cd" header="SEL PPN CD" />
          </DataTable>
        </TabPanel>
        <TabPanel header="Differences">
          <div v-for="d in dailyDifferences" :key="d.tanggal" class="daily-block">
            <h4>{{ d.tanggal }}</h4>
            <DataTable :value="d.rows" :loading="diffLoading" dataKey="DOCNO">
              <Column field="DOCNO" header="DOCNO" />
              <Column field="SEQNO" header="SEQNO" />
              <Column field="NET_MTRAN" header="NET MTRAN" />
              <Column field="NET_CD" header="NET CD" />
              <Column field="SEL_NET_CD" header="SEL NET CD" />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header="Kode Pesanan">
          <div v-for="d in dailyIssues" :key="d.tanggal" class="daily-block">
            <h4>{{ d.tanggal }}</h4>
            <DataTable :value="d.issues" :loading="kodeLoading">
              <Column field="SUBKEY" header="Subkey" />
              <Column field="KODEPESANANTOKO" header="Kode Toko" />
              <Column field="KODEPSANANGL" header="Kode GL" />
              <Column field="SELKODE" header="Selisih" />
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
      <div class="dialog-actions">
        <Button label="Catatan" icon="pi pi-pencil" class="p-button-text" @click="$emit('open-note', { KDTK: summary.KDTK, NAMA: summary.NAMA, CAB: summary.CAB || '-' , TANGGAL: dailyMetrics[0]?.tanggal || '' , note: null })" />
        <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="localVisible=false" />
      </div>
    </div>
  </Dialog>
  </template>

<script setup>
import { ref, watch, computed } from 'vue';
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
  differences: { type: [Array, Object], default: () => [] },
  diffLoading: { type: Boolean, default: false },
  kodePesananIssues: { type: [Array, Object], default: () => [] },
  kodeLoading: { type: Boolean, default: false }
});

const emit = defineEmits(['open-note', 'update:visible']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));

const amountClass = (n) => Number(n || 0) >= 0 ? 'amount-positive' : 'amount-negative';

const summary = computed(() => (props.detail?.summary ? props.detail.summary : props.detail || {}));
const dailyMetrics = computed(() => (props.detail?.daily ? props.detail.daily : (props.detail ? [props.detail] : [])));
const dailyDifferences = computed(() => (Array.isArray(props.differences) ? [{ tanggal: summary.value?.TANGGAL || '', rows: props.differences }] : (props.differences?.daily || [])));
const dailyIssues = computed(() => (Array.isArray(props.kodePesananIssues) ? [{ tanggal: summary.value?.TANGGAL || '', issues: props.kodePesananIssues }] : (props.kodePesananIssues?.daily || [])));
</script>

<style scoped>
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; margin-bottom: 1rem; }
.dialog-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .75rem; }
.amount-positive { color: #10b981; }
.amount-negative { color: #ef4444; }
</style>
