<template>
  <div class="ceklist-prep-closing-view">
    <!-- Page Header — mengikuti pola prepClosing -->
    <PageHeader
      title="Ceklist Prepare Closing"
      subtitle="Monitoring Space HDD, Import IDT, dan Rekap Screening Toko"
      description="Halaman ini menampilkan checklist kesiapan closing server per periode, meliputi kondisi ruang HDD, status import IDT, dan rekap hasil screening toko." />

    <div class="content-container">
      <!-- Filter — menggunakan RekonFormComponent yang sama -->
      <RekonFormComponent :formData="{ cab: filters.cabang, periode: filters.periode }">
        <template #title>Filter Ceklist Prepare Closing</template>
        <template #description>Pilih cabang dan periode untuk melihat data checklist server.</template>
        <template #cab>
          <Dropdown v-model="filters.cabang" :options="cabangOptions"
            optionLabel="namacab" optionValue="kdcab"
            placeholder="Pilih Cabang" class="w-full" />
        </template>
        <template #periode>
          <Calendar v-model="periodeDate" view="month" dateFormat="mm/yy"
            placeholder="Pilih Bulan/Tahun" :maxDate="today" showIcon class="w-full"
            @date-select="handlePeriodeSelect" />
        </template>
        <template #actions>
          <Button icon="pi pi-refresh" label="Muat Data" class="p-button-primary"
            style="margin-right:4px" :loading="loading" :disabled="!filters.periode"
            @click="loadAll" />
          <Button icon="pi pi-file-excel" label="Export Excel" class="p-button-success"
            :loading="exporting" :disabled="!filters.periode" @click="handleExport" />
        </template>
      </RekonFormComponent>

      <!-- Summary chips -->
      <div v-if="summary && !loading" class="summary-chips-row">
        <div class="summary-chip chip-hdd">
          <i class="pi pi-database chip-icon"></i>
          <span class="chip-label">Space HDD</span>
          <span class="chip-count">{{ summary.spaceHdd?.total ?? 0 }}</span>
          <span v-if="summary.spaceHdd?.critical > 0" class="chip-badge chip-warn">
            {{ summary.spaceHdd.critical }} kritis
          </span>
        </div>
        <div class="summary-chip chip-tampung">
          <i class="pi pi-hdd chip-icon"></i>
          <span class="chip-label">HDD Tampung</span>
          <span class="chip-count">{{ summary.spaceTampung?.total ?? 0 }}</span>
        </div>
        <div class="summary-chip chip-idt">
          <i class="pi pi-check-square chip-icon"></i>
          <span class="chip-label">Import IDT</span>
          <span class="chip-count">{{ summary.importIdt?.done ?? 0 }} / {{ summary.importIdt?.total ?? 0 }}</span>
        </div>
        <div class="summary-chip chip-screening">
          <i class="pi pi-search chip-icon"></i>
          <span class="chip-label">Screening Issues</span>
          <span class="chip-count">{{ summary.rekapScreening?.total ?? 0 }}</span>
        </div>
      </div>

      <!-- Tab Panel -->
      <TabView v-model:activeIndex="activeTab" class="ceklist-tabs">

        <!-- Tab 1: Space HDD Bulanan -->
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-database mr-2"></i>Space HDD Bulanan</span>
          </template>
          <TabSpaceHdd
            ref="tabHdd"
            :rows="hddRows"
            :loading="loading"
            :periode="filters.periode"
            @refresh="loadAll"
            @delete="(row) => askDelete('hdd', row)" />
        </TabPanel>

        <!-- Tab 2: Space HDD Tampung -->
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-hdd mr-2"></i>Space HDD Tampung</span>
          </template>
          <TabSpaceTampung
            ref="tabTampung"
            :rows="tampungRows"
            :loading="loading"
            :periode="filters.periode"
            @refresh="loadAll"
            @delete="(row) => askDelete('tampung', row)" />
        </TabPanel>

        <!-- Tab 3: Import IDT -->
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-check-square mr-2"></i>Import IDT</span>
          </template>
          <TabImportIdt
            :rows="idtRows"
            :loading="loading"
            :periode="filters.periode"
            @refresh="loadAll"
            @delete="(row) => askDelete('idt', row)" />
        </TabPanel>

        <!-- Tab 4: Rekap Screening -->
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-search mr-2"></i>Rekap Screening Toko</span>
            <Badge v-if="rekapData.total > 0" :value="rekapData.total" severity="danger" class="ml-2" />
          </template>
          <TabRekapScreening :data="rekapData" :loading="loading" />
        </TabPanel>
      </TabView>

      <!-- Confirm Delete Dialog (inline, tanpa ConfirmationService) -->
      <Dialog v-model:visible="confirmDlg.visible" :header="confirmDlg.header"
        modal :style="{ width: '380px' }">
        <div class="confirm-body">
          <i class="pi pi-exclamation-triangle confirm-icon"></i>
          <p>{{ confirmDlg.message }}</p>
        </div>
        <template #footer>
          <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="confirmDlg.visible = false" />
          <Button label="Hapus" icon="pi pi-trash" class="p-button-danger" @click="runDelete" />
        </template>
      </Dialog>

      <Toast />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useCabangStore } from '@/stores';
import PageHeader from '@/components/PageHeader.vue';
import RekonFormComponent from '@/components/common/RekonFormComponent.vue';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Badge from 'primevue/badge';
import Dialog from 'primevue/dialog';
import Toast from 'primevue/toast';

import TabSpaceHdd from './components/TabSpaceHdd.vue';
import TabSpaceTampung from './components/TabSpaceTampung.vue';
import TabImportIdt from './components/TabImportIdt.vue';
import TabRekapScreening from './components/TabRekapScreening.vue';
import { useCeklistPrepClosing } from './composables/useCeklistPrepClosing.js';
import * as api from '@/services/ceklistPrepClosing.service.js';

// ─── Composable ───────────────────────────────────────────────────────────────
const {
  filters, periodeDate,
  loading, exporting,
  hddRows, tampungRows, idtRows, rekapData, summary,
  loadAll, doExport,
  handlePeriodeSelect,
} = useCeklistPrepClosing();

// ─── State ────────────────────────────────────────────────────────────────────
const toast = useToast();
const cabangStore = useCabangStore();
const today = ref(new Date());
const activeTab = ref(0);
const cabangOptions = ref([]);

// ─── Confirm Delete ───────────────────────────────────────────────────────────
const confirmDlg = reactive({ visible: false, header: '', message: '', type: '', row: null });

function askDelete(type, row) {
  const labels = { hdd: `Space HDD KDCAB ${row.KDCAB}`, tampung: `Space HDD Tampung CAB ${row.CAB}`, idt: `Import IDT KDCAB ${row.KDCAB}` };
  confirmDlg.header  = 'Konfirmasi Hapus';
  confirmDlg.message = `Hapus data ${labels[type]}?`;
  confirmDlg.type    = type;
  confirmDlg.row     = row;
  confirmDlg.visible = true;
}

async function runDelete() {
  confirmDlg.visible = false;
  try {
    const { type, row } = confirmDlg;
    if (type === 'hdd')     await api.deleteSpaceHdd(row.KDCAB, filters.periode);
    if (type === 'tampung') await api.deleteSpaceTampung(row.CAB, filters.periode);
    if (type === 'idt')     await api.deleteImportIdt(row.KDCAB, filters.periode);
    toast.add({ severity: 'success', summary: 'Dihapus', detail: 'Data berhasil dihapus', life: 3000 });
    await loadAll();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
async function handleExport() {
  try {
    await doExport();
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'File Excel berhasil diunduh', life: 3000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  filters.periode = y + m;
  periodeDate.value = now;

  cabangOptions.value = [
    { kdcab: 'All', namacab: 'SEMUA CABANG' },
    ...(cabangStore.allCabang || []),
  ];

  loadAll();
});
</script>

<style src="./index.css" scoped></style>
