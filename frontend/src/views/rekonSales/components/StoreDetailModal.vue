<template>
  <Dialog v-model:visible="localVisible" header="Detail Bulanan" :modal="true" :style="{ width: '1000px' }">
    <div v-if="detailLoading && !detail" class="detail-loading">
      <i class="pi pi-spinner pi-spin"></i>
      <span>Memuat detail toko...</span>
    </div>
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
            <template #empty>
              <div class="empty-tab"><i class="pi pi-calendar mr-2"></i>Tidak ada rincian harian</div>
            </template>
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

        <TabPanel v-if="hasDifferences" header="Selisih Mtran & Closing Detail">
          <div class="shift-hint">
            <i class="pi pi-info-circle"></i>
            <span>Klik baris untuk melihat detail item transaksi secara live dari toko.</span>
          </div>
          <DataTable :value="differencesData" :dataKey="shiftId" size="small" stripedRows
            @row-click="onRowClick" :selection="selectedShift" selectionMode="single">
            <template #empty>
              <div class="empty-tab"><i class="pi pi-minus-circle mr-2"></i>Tidak ada data selisih</div>
            </template>
            <Column field="TANGGAL" header="Tanggal" />
            <Column field="STATION" header="Station" />
            <Column field="SHIFT" header="Shift" />
            <Column field="NET_MTRAN" header="NET MTRAN" class="text-right">
              <template #body="{ data }">{{ formatDecimal(data.NET_MTRAN) }}</template>
            </Column>
            <Column field="NET_ClosingDetail" header="NET Closing Detail" class="text-right">
              <template #body="{ data }">{{ formatDecimal(data.NET_ClosingDetail) }}</template>
            </Column>
            <Column field="SEL" header="Selisih" class="text-right">
              <template #body="{ data }">
                <span :class="amountClass(data.SEL)">{{ formatDecimal(data.SEL) }}</span>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="Kode Pesanan">
          <div v-for="d in dailyIssues" :key="d.tanggal" class="daily-block">
            <h4>{{ d.tanggal }}</h4>
            <DataTable :value="d.issues" :loading="kodeLoading" size="small" stripedRows>
              <template #empty>
                <div class="empty-tab"><i class="pi pi-check-circle mr-2"></i>Tidak ada masalah kode pesanan</div>
              </template>
              <Column field="SUBKEY" header="Subkey" />
              <Column field="KODEPESANANTOKO" header="Kode Toko" />
              <Column field="KODEPSANANGL" header="Kode GL" />
              <Column field="SELKODE" header="Selisih" class="text-right" />
            </DataTable>
          </div>
        </TabPanel>

        <TabPanel header="Cek SHOP">
          <div v-if="!shopCheckData" class="empty-tab">
            <i class="pi pi-check-circle mr-2"></i>Tidak ada selisih SHOP tercatat untuk toko ini.
          </div>
          <template v-else>
            <div class="detail-grid">
              <div>
                <strong>Status</strong>
                <div class="shop-status">
                  <Tag v-if="shopCheckData.STATUS === 'B'" value="Ada SHOP Beda" severity="warning" icon="pi pi-exclamation-triangle" rounded />
                  <Tag v-else-if="shopCheckData.STATUS === 'OK'" value="SHOP OK" severity="success" icon="pi pi-check" rounded />
                  <Tag v-else value="Belum dicek" severity="secondary" rounded />
                </div>
              </div>
              <div><strong>Transaksi Beda</strong><div>{{ formatNumber(shopCheckData.JUMLAH_TRX_BEDA || 0) }}</div></div>
              <div><strong>Kode SHOP Asing</strong><div>{{ formatNumber(shopCheckData.JUMLAH_SHOP_ASING || 0) }}</div></div>
              <div><strong>Terakhir Dicek</strong><div>{{ formatDateTime(shopCheckData.UPDTIME) }}</div></div>
            </div>
            <h4>Kode SHOP Asing per Kode</h4>
            <DataTable :value="shopListData" size="small" stripedRows>
              <template #empty>
                <div class="empty-tab"><i class="pi pi-check-circle mr-2"></i>Tidak ada SHOP asing</div>
              </template>
              <Column field="SHOP" header="SHOP Asing" />
              <Column field="JUMLAH_TRX" header="Jumlah Transaksi" class="text-right">
                <template #body="{ data }">{{ formatNumber(data.JUMLAH_TRX) }}</template>
              </Column>
              <Column field="JUMLAH_TGL" header="Jumlah Tanggal" class="text-right">
                <template #body="{ data }">{{ formatNumber(data.JUMLAH_TGL) }}</template>
              </Column>
              <Column field="TGL_AWAL" header="Dari Tanggal" />
              <Column field="TGL_AKHIR" header="Sampai Tanggal" />
            </DataTable>
            <div class="shop-items-hint">
              <i class="pi pi-search"></i>
              <span>Lihat contoh item transaksi dengan SHOP beda langsung dari DB toko.</span>
              <Button label="Lihat Item" icon="pi pi-search" size="small" @click="emitViewShopCheck" />
            </div>
          </template>
        </TabPanel>
      </TabView>
      <div class="dialog-actions">
        <Button label="Catatan" icon="pi pi-pencil" class="p-button-text" @click="emitOpenNote" />
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
import { formatNumber, formatDecimal, formatDateTime, getSelisihClass } from '../utils/formatters';
import Tag from 'primevue/tag';

const props = defineProps({
  visible: { type: Boolean, default: false },
  detail: { type: Object, default: () => null },
  detailLoading: { type: Boolean, default: false },
  differences: { type: [Array, Object], default: () => [] },
  diffLoading: { type: Boolean, default: false },
  kodePesananIssues: { type: [Array, Object], default: () => [] },
  kodeLoading: { type: Boolean, default: false },
  shopCheck: { type: Object, default: null },
});

const emit = defineEmits(['open-note', 'update:visible', 'view-live-check', 'view-shop-check']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));

const selectedShift = ref(null);

const amountClass = getSelisihClass;

const summary = computed(() => (props.detail?.data?.summary || props.detail?.summary || props.detail || {}));
const dailyMetrics = computed(() => (props.detail?.data?.daily || props.detail?.daily || (props.detail?.data ? [props.detail.data] : props.detail ? [props.detail] : [])));
const notesList = computed(() => (props.detail?.data?.notes || props.detail?.notes || []));
const dailyNote = computed(() => {
  const firstDate = dailyMetrics.value[0]?.tanggal;
  if (!firstDate || !notesList.value.length) return null;
  return notesList.value.find(n => n.tanggal === firstDate) || notesList.value[0] || null;
});

const differencesData = computed(() => {
  const diffs = props.differences?.data || props.differences;
  if (Array.isArray(diffs)) return diffs;
  if (diffs?.daily) return diffs.daily;
  return [];
});

const hasDifferences = computed(() => differencesData.value.length > 0);

const shiftId = (row) => `${row.TANGGAL}|${row.STATION}|${row.SHIFT}`;

const onRowClick = (event) => {
  const row = event.data;
  emit('view-live-check', {
    kdtk: summary.value.KDTK,
    month: summary.value.month,
    year: summary.value.year,
    tanggal: row.TANGGAL,
    station: row.STATION,
    shift: row.SHIFT,
  });
};

const dailyIssues = computed(() => {
  const issues = props.kodePesananIssues?.data || props.kodePesananIssues;
  return Array.isArray(issues) ? [{ tanggal: summary.value?.TANGGAL || '', issues: issues }] : (issues?.daily || []);
});

const shopCheckData = computed(() => props.shopCheck || null);
const shopListData = computed(() => (props.shopCheck?.LIST_SHOP || []));

const emitViewShopCheck = () => {
  emit('view-shop-check', { kdtk: summary.value.KDTK });
};

const emitOpenNote = () => {
  emit('open-note', {
    KDTK: summary.value.KDTK,
    NAMA: summary.value.NAMA || '-',
    CAB: summary.value.CAB || props.detail?.CAB || '-',
    TANGGAL: dailyMetrics.value[0]?.tanggal || '',
    note: dailyNote.value,
  });
};
</script>

<style scoped src="./StoreDetailModal.style.css"></style>
