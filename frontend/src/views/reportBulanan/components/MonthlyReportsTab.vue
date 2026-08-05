<template>
  <div class="monthly-reports-tab">
    <PageHeader
      title="Laporan Bulanan"
      subtitle="Generate dan kelola laporan bulanan per cabang"
      description="Pilih cabang, periode, dan laporan yang ingin diekspor. Laporan akan diunduh dalam format yang sesuai (Excel / PDF) langsung ke perangkat Anda."
    />

    <div class="content-container">
      <ReportFilterBar
        v-model:cabang="cabang"
        v-model:periode="periode"
        v-model:selectedDate="selectedDate"
        :selected-count="selectedIds.length"
        :is-exporting="isExporting"
        :show-manager-button="true"
        @export-clicked="handleExport"
        @open-manager="showManager = true"
      />
      
      <br />

      <ReportList
        :reports="reportList"
        :loading="loadingReports"
        :disabled="isExporting"
        :job-states="jobStates"
        v-model:selected-ids="selectedIds"
        @refresh="loadReports"
      />

      <!-- Proses & Antrian Export (live via SSE) -->
      <div v-if="exportStore.hasActiveJobs" class="export-status-card card">
        <div class="export-panel__header">
          <h4 class="export-panel__title">
            <i class="pi pi-spin pi-spinner mr-2 text-warn" />
            Proses & Antrian Export
          </h4>
          <Badge :value="`${exportStore.activeJobs.length} aktif`" severity="warn" />
        </div>
        <div class="export-panel__hint">
          2 proses berjalan sekaligus, sisanya menunggu giliran secara adil (FIFO).
          File diunduh otomatis saat selesai — boleh pindah halaman.
        </div>
        <div class="export-job-row" v-for="job in exportStore.activeJobs" :key="job.taskId">
          <div class="export-job__info">
            <span class="export-job__name">{{ job.reportName }}</span>
            <span class="export-job__meta">
              <template v-if="job.status === 'queued'">
                <i class="pi pi-clock mr-1" /> Antrian #{{ job.queuePosition || '...' }}
              </template>
              <template v-else>{{ job.message || 'Memproses...' }}</template>
              &bull; {{ job.cab }} &bull; {{ job.prd }}
            </span>
          </div>
          <div class="export-job__progress">
            <div class="export-progress-track">
              <div
                class="export-progress-fill"
                :class="{ 'fill-queued': job.status === 'queued' }"
                :style="{ width: (job.percentage || 0) + '%' }"
              ></div>
            </div>
            <span class="export-job__pct">{{ job.percentage || 0 }}%</span>
          </div>
          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-danger export-job__cancel"
            v-tooltip.top="'Batalkan export ini'"
            @click="cancelExport(job)"
          />
        </div>
      </div>

      <!-- File Siap Diunduh (panel cadangan — otomatis & manual) -->
      <div v-if="exportStore.hasReadyJobs" class="export-status-card card">
        <div class="export-panel__header">
          <h4 class="export-panel__title">
            <i class="pi pi-download mr-2 text-success" />
            File Siap Diunduh
          </h4>
          <Badge :value="`${exportStore.readyJobs.length} file`" severity="success" />
        </div>
        <div class="export-panel__hint">
          File tersimpan di server 24 jam. Jika unduhan otomatis terlewat (mis. browser memblokir), unduh manual di sini.
        </div>
        <div class="export-job-row" v-for="job in exportStore.readyJobs" :key="job.taskId">
          <div class="export-job__info">
            <span class="export-job__name">{{ job.reportName }}</span>
            <span class="export-job__meta">{{ job.cab }} &bull; {{ job.prd }}</span>
          </div>
          <Button
            label="Unduh"
            icon="pi pi-download"
            class="p-button-sm p-button-outlined p-button-success"
            @click="downloadReady(job)"
          />
        </div>
      </div>
    </div>

    <ReportManagerDialog
      v-model:visible="showManager"
      :reports="reportList"
      :loading="loadingReports"
      @refresh="loadReports"
      @open-form="openForm"
      @delete-report="confirmDelete"
    />

    <ReportFormDialog
      v-model:visible="showForm"
      :edit-data="editingReport"
      :saving="saving"
      @save="saveReport"
    />

    <Dialog
      v-model:visible="showDeleteConfirm"
      modal
      header="Konfirmasi Hapus"
      :style="{ width: '420px' }"
    >
      <div class="delete-confirm-body">
        <i class="pi pi-exclamation-triangle text-orange-500 text-4xl mb-3" />
        <p>Anda akan menghapus laporan:</p>
        <p class="font-bold text-lg">{{ deletingReport?.['name-reports'] }}</p>
        <p class="text-sm text-color-secondary">Tindakan ini tidak dapat dibatalkan.</p>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="showDeleteConfirm = false" />
        <Button label="Hapus" icon="pi pi-trash" class="p-button-danger" :loading="deleting" @click="doDelete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToastService } from '@/utils/toast';
import { useExportsStore } from '@/stores';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import PageHeader from '@/components/PageHeader.vue';
import ReportFilterBar from './ReportFilterBar.vue';
import ReportList from './ReportList.vue';
import ReportManagerDialog from './ReportManagerDialog.vue';
import ReportFormDialog from './ReportFormDialog.vue';
import monthlyReportsService from '@/services/monthlyReports.service.js';

const toast = useToastService();
const exportStore = useExportsStore();

const cabang       = ref('');
const periode      = ref('');
const selectedDate = ref(null);
const selectedIds  = ref([]);
const reportList   = ref([]);
const loadingReports = ref(false);
const showManager  = ref(false);
const showForm     = ref(false);
const saving       = ref(false);
const editingReport = ref(null);

const showDeleteConfirm = ref(false);
const deletingReport    = ref(null);
const deleting          = ref(false);

// Status export aktif (queued/processing) → nonaktifkan kontrol sementara
const isExporting = computed(() => exportStore.hasActiveJobs);

// Map reportId → job terbaru (untuk badge status per baris di ReportList)
const STATUS_PRIORITY = { processing: 0, queued: 1, failed: 2, cancelled: 3, completed: 4 };
const jobStates = computed(() => {
  const map = {};
  for (const job of Object.values(exportStore.jobs)) {
    const current = map[job.reportId];
    if (!current || (STATUS_PRIORITY[job.status] ?? 9) < (STATUS_PRIORITY[current.status] ?? 9)) {
      map[job.reportId] = job;
    }
  }
  return map;
});

const loadReports = async () => {
  loadingReports.value = true;
  try {
    const res = await monthlyReportsService.listReports();
    reportList.value = res.data?.data || [];
  } catch (err) {
    toast.showError('Error', 'Gagal memuat daftar laporan');
    console.error(err);
  } finally {
    loadingReports.value = false;
  }
};

/**
 * Mulai export untuk semua laporan terpilih.
 * Job masuk antrian FIFO di backend (max 2 paralel). Progress, auto-download,
 * dan notifikasi ditangani exportStore + FloatingProgressWidget secara global —
 * halaman ini bebas dipindah.
 */
const handleExport = async () => {
  if (!cabang.value || !periode.value || selectedIds.value.length === 0) return;

  const jobs = [];
  let startFailCount = 0;

  for (const id of selectedIds.value) {
    const report = reportList.value.find(r => r['id-reports'] === id);
    const reportName = report?.['name-reports'] || id;

    try {
      const taskId = await exportStore.startExport(id, {
        cab: cabang.value,
        prd: periode.value,
        reportName,
      });
      jobs.push({ taskId, reportName });
      toast.showInfo('Diantrikan', `Export "${reportName}" masuk antrian.`);
    } catch (err) {
      startFailCount++;
      const errMsg = err.response?.data?.message || err.message || 'Terjadi kesalahan';
      toast.showError('Gagal Memulai', `${reportName}: ${errMsg}`);
      console.error(`Start export error [${id}]:`, err);
    }
  }

  if (startFailCount > 0 && jobs.length === 0) {
    toast.showError('Gagal', 'Tidak ada laporan yang berhasil dijalankan');
  }
};

const cancelExport = async (job) => {
  try {
    await exportStore.cancelTask(job.taskId);
    toast.showInfo('Dibatalkan', `Export "${job.reportName}" dibatalkan.`);
  } catch (err) {
    toast.showError('Gagal', err.response?.data?.message || err.message || 'Gagal membatalkan');
  }
};

const downloadReady = async (job) => {
  try {
    const res = await monthlyReportsService.downloadExportFile(job.taskId);
    exportStore.triggerDownload(res, job.reportName);
  } catch (err) {
    toast.showError('Gagal', `${job.reportName}: ${err.response?.data?.message || err.message}`);
  }
};

const openForm = (reportData = null) => {
  editingReport.value = reportData;
  showForm.value = true;
};

const saveReport = async (formData) => {
  saving.value = true;
  try {
    if (editingReport.value) {
      await monthlyReportsService.updateReport(editingReport.value['id-reports'], formData);
      toast.showSuccess('Sukses', 'Laporan berhasil diperbarui');
    } else {
      await monthlyReportsService.createReport(formData);
      toast.showSuccess('Sukses', 'Laporan baru berhasil ditambahkan');
    }
    showForm.value = false;
    editingReport.value = null;
    await loadReports();
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    toast.showError('Gagal', `Gagal menyimpan laporan: ${errMsg}`);
    console.error(err);
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (report) => {
  deletingReport.value = report;
  showDeleteConfirm.value = true;
};

const doDelete = async () => {
  if (!deletingReport.value) return;
  deleting.value = true;
  try {
    const deletedId = deletingReport.value['id-reports'];
    await monthlyReportsService.deleteReport(deletedId);
    toast.showSuccess('Sukses', `Laporan "${deletingReport.value['name-reports']}" berhasil dihapus`);
    showDeleteConfirm.value = false;
    deletingReport.value = null;
    selectedIds.value = selectedIds.value.filter(id => id !== deletedId);
    await loadReports();
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    toast.showError('Gagal', `Gagal menghapus laporan: ${errMsg}`);
    console.error(err);
  } finally {
    deleting.value = false;
  }
};

onMounted(() => {
  loadReports();
  // Monitoring SSE export + sinkronisasi panel "File Siap Diunduh"
  exportStore.initMonitoring();
  exportStore.refreshReadyJobs();

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  selectedDate.value = lastMonth;
  const yy = lastMonth.getFullYear().toString().slice(-2);
  const mm = String(lastMonth.getMonth() + 1).padStart(2, '0');
  periode.value = yy + mm;
});
</script>

<style scoped src="./MonthlyReportsTab.style.css"></style>
