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
          <DataTable :value="dailyMetrics" dataKey="tanggal" size="small" stripedRows class="p-datatable-sm">
            <Column field="tanggal" header="Tanggal" style="min-width: 100px" />
            <Column field="net_mtran" header="NET MTRAN" class="text-right">
              <template #body="{ data }">{{ formatDecimal(data.net_mtran) }}</template>
            </Column>
            <Column field="net_gl" header="NET GL" class="text-right">
              <template #body="{ data }">{{ formatDecimal(data.net_gl) }}</template>
            </Column>
            <Column field="net_cd" header="NET CD" class="text-right">
              <template #body="{ data }">{{ formatDecimal(data.net_cd) }}</template>
            </Column>
            <Column field="sel_net_gl" header="SEL NET GL" class="text-right">
              <template #body="{ data }">
                <span :class="amountClass(data.sel_net_gl)">{{ formatDecimal(data.sel_net_gl) }}</span>
              </template>
            </Column>
            <Column field="sel_net_cd" header="SEL NET CD" class="text-right">
              <template #body="{ data }">
                <span :class="amountClass(data.sel_net_cd)">{{ formatDecimal(data.sel_net_cd) }}</span>
              </template>
            </Column>
            <Column field="sel_ppn_gl" header="SEL PPN GL" class="text-right">
              <template #body="{ data }">
                <span :class="amountClass(data.sel_ppn_gl)">{{ formatDecimal(data.sel_ppn_gl) }}</span>
              </template>
            </Column>
            <Column field="sel_ppn_cd" header="SEL PPN CD" class="text-right">
              <template #body="{ data }">
                <span :class="amountClass(data.sel_ppn_cd)">{{ formatDecimal(data.sel_ppn_cd) }}</span>
              </template>
            </Column>
          </DataTable>
        </TabPanel>
        <TabPanel header="Differences">
          <div v-for="d in dailyDifferences" :key="d.tanggal" class="daily-block">
            <h4>{{ d.tanggal }}</h4>
            <DataTable :value="d.rows" :loading="diffLoading" dataKey="DOCNO" size="small" stripedRows>
              <Column field="DOCNO" header="DOCNO" />
              <Column field="SEQNO" header="SEQNO" />
              <Column field="NET_MTRAN" header="NET MTRAN" class="text-right">
                <template #body="{ data }">{{ formatDecimal(data.NET_MTRAN) }}</template>
              </Column>
              <Column field="NET_CD" header="NET CD" class="text-right">
                <template #body="{ data }">{{ formatDecimal(data.NET_CD) }}</template>
              </Column>
              <Column field="SEL_NET_CD" header="SEL NET CD" class="text-right">
                <template #body="{ data }">
                  <span :class="amountClass(data.SEL_NET_CD)">{{ formatDecimal(data.SEL_NET_CD) }}</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header="Kode Pesanan">
          <div v-for="d in dailyIssues" :key="d.tanggal" class="daily-block">
            <h4>{{ d.tanggal }}</h4>
            <DataTable :value="d.issues" :loading="kodeLoading" size="small" stripedRows>
              <Column field="SUBKEY" header="Subkey" />
              <Column field="KODEPESANANTOKO" header="Kode Toko" />
              <Column field="KODEPSANANGL" header="Kode GL" />
              <Column field="SELKODE" header="Selisih" class="text-right" />
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
import { formatNumber, formatDecimal } from '../utils/formatters';

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

const summary = computed(() => (props.detail?.data?.summary || props.detail?.summary || props.detail || {}));
const dailyMetrics = computed(() => (props.detail?.data?.daily || props.detail?.daily || (props.detail?.data ? [props.detail.data] : props.detail ? [props.detail] : [])));
const dailyDifferences = computed(() => {
  const diffs = props.differences?.data || props.differences;
  return Array.isArray(diffs) ? [{ tanggal: summary.value?.TANGGAL || '', rows: diffs }] : (diffs?.daily || []);
});
const dailyIssues = computed(() => {
  const issues = props.kodePesananIssues?.data || props.kodePesananIssues;
  return Array.isArray(issues) ? [{ tanggal: summary.value?.TANGGAL || '', issues: issues }] : (issues?.daily || []);
});
</script>

<style scoped>
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; margin-bottom: 1rem; }
.dialog-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .75rem; }
.amount-positive { color: #10b981; font-weight: 600; }
.amount-negative { color: #ef4444; font-weight: 600; }
:deep(.text-right) { text-align: right !important; }
:deep(.p-datatable-thead > tr > th.text-right) { text-align: right !important; justify-content: flex-end; }
</style>
