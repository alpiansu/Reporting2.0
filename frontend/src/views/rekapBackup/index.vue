<template>
  <div class="rekap-backup-view">
    <PageHeader
      title="Rekap Status Backup Data"
      subtitle="Harian & Bulanan"
      description="Pantau status kelengkapan data backup harian dan bulanan per cabang secara cepat."
    />
    
    <div class="content-container">
      <!-- Filter and Actions Section -->
      <Card class="shadow-1 border-round-xl mb-3">
        <template #content>
          <div class="flex flex-wrap gap-3 align-items-end">
            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium">Rentang Tahun (Khusus Export)</label>
              <div class="flex gap-2">
                <Dropdown 
                  v-model="selectedStartYear" 
                  :options="startYearOptions" 
                  placeholder="Tahun Awal" 
                  class="w-8rem"
                />
                <Dropdown 
                  v-if="selectedStartYear !== 'All'"
                  v-model="selectedEndYear" 
                  :options="endYearOptions" 
                  placeholder="Tahun Akhir" 
                  class="w-8rem"
                />
              </div>
            </div>

            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium">Cabang (Khusus Export)</label>
              <Dropdown 
                v-model="selectedCabang" 
                :options="cabangOptions" 
                placeholder="Pilih Cabang" 
                class="w-12rem"
              />
            </div>

            <div class="flex gap-2 ml-auto">
              <Button 
                label="Export Excel" 
                icon="pi pi-file-excel" 
                class="p-button-success"
                @click="exportExcel"
                :loading="exporting"
              />
              
              <Button 
                icon="pi pi-sync" 
                class="p-button-secondary" 
                v-tooltip.top="'Manual trigger sync WRC untuk toko aktif (gunakan jika perlu)'"
                @click="showSyncWrcModal = true"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Main Table Card -->
      <Card class="shadow-1 border-round-xl">
        <template #content>
          <DataTable
            :value="summaryData"
            :loading="loading"
            responsiveLayout="scroll"
            stripedRows
            class="p-datatable-sm"
            emptyMessage="Tidak ada data ringkasan."
          >
            <Column field="cabang" header="CABANG" sortable style="min-width: 100px"></Column>

            <!-- Group Harian -->
            <Column header="HARIAN" alignHeader="center">
              <template #body="{ data }">
                <div class="flex align-items-center justify-content-between px-2">
                  <div class="flex flex-column">
                    <span class="font-semibold text-primary">{{ data.total_harian || 0 }} files</span>
                    <span class="text-xs text-color-secondary">{{ data.oldest_harian || '-' }} s/d {{ data.newest_harian || '-' }}</span>
                  </div>
                  <Button 
                    icon="pi pi-search" 
                    class="p-button-rounded p-button-text p-button-sm ml-2" 
                    @click="openDialog(data.cabang, 'harian')"
                    v-tooltip.top="'Lihat History Harian'"
                  />
                </div>
              </template>
            </Column>

            <!-- Group Bulanan -->
            <Column header="BULANAN" alignHeader="center">
              <template #body="{ data }">
                <div class="flex align-items-center justify-content-between px-2">
                  <div class="flex flex-column">
                    <span class="font-semibold text-primary">{{ data.total_bln || 0 }} files (IDT)</span>
                    <span class="text-xs text-color-secondary">{{ data.oldest_bln || '-' }} s/d {{ data.newest_bln || '-' }}</span>
                  </div>
                  <Button 
                    icon="pi pi-search" 
                    class="p-button-rounded p-button-text p-button-sm ml-2" 
                    @click="openDialog(data.cabang, 'bulanan')"
                    v-tooltip.top="'Lihat History Bulanan'"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <!-- Detailed Dialog -->
      <DetailDialog
        v-model:visible="dialogVisible"
        :cabang="dialogCabang"
        :type="dialogType"
      />

      <!-- Sync WRC Modal -->
      <Dialog v-model:visible="showSyncWrcModal" header="Manual Sync Toko Aktif WRC" :style="{ width: '400px' }" modal>
        <div class="flex flex-column gap-3 py-3">
          <p class="m-0 text-color-secondary">Gunakan fitur ini hanya jika Anda yakin jumlah toko aktif untuk cabang/periode tertentu belum diperbarui.</p>
          <div class="flex flex-column gap-1">
            <label>Cabang</label>
            <InputText v-model="syncForm.cabang" placeholder="Contoh: G001" />
          </div>
          <div class="flex flex-column gap-1">
            <label>Periode</label>
            <InputText v-model="syncForm.periode" placeholder="YYYYMM (Contoh: 202401)" />
          </div>
        </div>
        <template #footer>
          <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="showSyncWrcModal = false" />
          <Button label="Sync Sekarang" icon="pi pi-check" :loading="syncing" @click="doSyncWrc" autofocus />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import DetailDialog from './components/DetailDialog.vue';

const toast = useToast();

const loading = ref(false);
const summaryData = ref([]);

// Filter states
const startYearOptions = ref(['All']);
const selectedStartYear = ref('All');
const selectedEndYear = ref('');
const endYearOptions = computed(() => {
  if (selectedStartYear.value === 'All') return [];
  return startYearOptions.value.filter(y => y !== 'All' && y >= selectedStartYear.value);
});

const cabangOptions = ref(['All']);
const selectedCabang = ref('All');

const exporting = ref(false);

// Dialog states
const dialogVisible = ref(false);
const dialogCabang = ref('');
const dialogType = ref('harian');

// Sync WRC states
const showSyncWrcModal = ref(false);
const syncing = ref(false);
const syncForm = ref({ cabang: '', periode: '' });

const fetchSummary = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/rekap-backup/summary');
    summaryData.value = res.data;
    
    // Extract unique cabangs for filter
    const cabangs = [...new Set(res.data.map(d => d.cabang))].sort();
    cabangOptions.value = ['All', ...cabangs];
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data summary', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const fetchYears = async () => {
  try {
    const res = await axios.get('/api/rekap-backup/years');
    if (res.data && res.data.length > 0) {
      const { oldest_year, newest_year } = res.data[0];
      if (oldest_year && newest_year) {
        const years = [];
        for (let y = parseInt(oldest_year); y <= parseInt(newest_year); y++) {
          years.push(y.toString());
        }
        startYearOptions.value = ['All', ...years];
      }
    }
  } catch (err) {
    console.error('Error fetching years:', err);
  }
};

const exportExcel = async () => {
  exporting.value = true;
  try {
    const params = new URLSearchParams();
    if (selectedCabang.value && selectedCabang.value !== 'All') {
      params.append('cabang', selectedCabang.value);
    }
    if (selectedStartYear.value && selectedStartYear.value !== 'All') {
      params.append('startYear', selectedStartYear.value);
      params.append('endYear', selectedEndYear.value || selectedStartYear.value);
    }

    const response = await axios.get(`/api/rekap-backup/export?${params.toString()}`, {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from header if possible, else default
    let filename = 'RekapBackup.xlsx';
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
        var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        var matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal export file excel', life: 3000 });
  } finally {
    exporting.value = false;
  }
};

const openDialog = (cabang, type) => {
  dialogCabang.value = cabang;
  dialogType.value = type;
  dialogVisible.value = true;
};

const doSyncWrc = async () => {
  if (!syncForm.value.cabang || !syncForm.value.periode) {
    toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Cabang dan Periode wajib diisi', life: 3000 });
    return;
  }
  syncing.value = true;
  try {
    await axios.post('/api/rekap-backup/sync-wrc', syncForm.value);
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data Toko Aktif berhasil disinkronisasi', life: 3000 });
    showSyncWrcModal.value = false;
    fetchSummary(); // Refresh data
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal sinkronisasi WRC', life: 3000 });
  } finally {
    syncing.value = false;
  }
};

onMounted(() => {
  fetchSummary();
  fetchYears();
});
</script>

<style scoped>
.rekap-backup-view {
  padding: 1.5rem;
}

.content-container {
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .rekap-backup-view {
    padding: 1rem;
  }
}
</style>
