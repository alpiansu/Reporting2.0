<template>
  <div class="ceklist-prep-closing-view">
    <!-- View Header (Modern Standard Single Source of Truth) -->
    <div class="view-header">
      <div class="view-header__left">
        <div class="view-header__icon-badge">
          <i class="pi pi-server"></i>
        </div>
        <div>
          <h1 class="view-header__title">Ceklist Prepare Closing Server</h1>
          <p class="view-header__subtitle">Monitoring Space HDD, Import IDT, dan Rekap Screening Toko per cabang</p>
        </div>
      </div>
      <div class="view-header__actions">
        <div class="active-filter-badge" v-if="filters.periode">
          <i class="pi pi-filter"></i>
          <span class="font-mono">Periode: {{ formattedPeriode }}</span>
          <span class="badge-separator">&bull;</span>
          <span>Cabang: {{ activeCabangName }}</span>
        </div>
        <Button
          icon="pi pi-refresh"
          label="Muat Data"
          class="p-button-primary p-button-sm action-btn"
          :loading="loading"
          :disabled="!filters.periode"
          @click="loadAll"
        />
        <Button
          icon="pi pi-file-excel"
          label="Export Excel"
          class="p-button-success p-button-sm action-btn"
          :loading="exporting"
          :disabled="!filters.periode"
          @click="handleExport"
        />
      </div>
    </div>

    <div class="content-container">
      <!-- Filter Panel (Unified 1-Row Compact Form) -->
      <div class="filter-panel card">
        <div class="filter-row">
          <div class="filter-group">
            <label class="filter-label">Cabang</label>
            <Dropdown
              v-model="filters.cabang"
              :options="cabangOptions"
              optionLabel="namacab"
              optionValue="kdcab"
              placeholder="Pilih Cabang"
              class="w-full filter-input"
              filter
              filter-placeholder="Cari cabang..."
              @change="loadAll"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Periode</label>
            <Calendar
              v-model="periodeDate"
              view="month"
              dateFormat="mm/yy"
              placeholder="Pilih Bulan/Tahun"
              :maxDate="today"
              showIcon
              class="w-full filter-input"
              @date-select="onPeriodeChange"
            />
          </div>
        </div>
      </div>

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
            :panduan="panduanMap"
            :cabangs="cabangs"
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
            :panduan="panduanMap"
            :cabangs="cabangs"
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
            :panduan="panduanMap"
            :cabangs="cabangs"
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

        <!-- Tab 5: Panduan -->
        <TabPanel>
          <template #header>
            <span class="tab-label"><i class="pi pi-book mr-2"></i>Panduan</span>
          </template>
          <TabPanduan :panduanRows="panduanRows" :loading="panduanLoading" />
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useCabangStore } from '@/stores';
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
import TabPanduan from './components/TabPanduan.vue';
import { useCeklistPrepClosing } from './composables/useCeklistPrepClosing.js';
import * as api from '@/services/ceklistPrepClosing.service.js';

// ─── Composable ───────────────────────────────────────────────────────────────
const {
  filters, periodeDate,
  loading, exporting,
  hddRows, tampungRows, idtRows, rekapData, summary,
  panduanRows, panduanMap, cabangs, panduanLoading,
  loadAll, doExport, loadPanduan,
  handlePeriodeSelect,
} = useCeklistPrepClosing();

// ─── State ────────────────────────────────────────────────────────────────────
const toast = useToast();
const cabangStore = useCabangStore();
const today = ref(new Date());
const activeTab = ref(0);
const cabangOptions = ref([]);

// ─── Badges & Formatting ──────────────────────────────────────────────────────
const formattedPeriode = computed(() => {
  if (!filters.periode) return '-';
  if (filters.periode.length === 4) {
    return `${filters.periode.slice(2, 4)}/20${filters.periode.slice(0, 2)}`;
  }
  return filters.periode;
});

const activeCabangName = computed(() => {
  if (!filters.cabang || filters.cabang === 'All') return 'Semua Cabang';
  const found = cabangOptions.value.find(c => c.kdcab === filters.cabang);
  return found ? `${found.kdcab} - ${found.namacab}` : filters.cabang;
});

function onPeriodeChange() {
  handlePeriodeSelect();
  loadAll();
}

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

  // Cabang dari panduan (mencakup G295 yang tidak ada di m_cabang), fallback m_cabang
  loadPanduan().then(() => {
    if (cabangs.value.length > 0) {
      cabangOptions.value = [
        { kdcab: 'All', namacab: 'SEMUA CABANG' },
        ...cabangs.value,
      ];
    } else {
      cabangOptions.value = [
        { kdcab: 'All', namacab: 'SEMUA CABANG' },
        ...(cabangStore.allCabang || []),
      ];
    }
  });

  loadAll();
});
</script>

<style src="./index.css" scoped></style>
