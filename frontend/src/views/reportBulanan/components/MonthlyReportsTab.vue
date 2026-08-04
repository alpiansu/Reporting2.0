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
        v-model:selected-ids="selectedIds"
        @refresh="loadReports"
      />
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useToastService } from '@/utils/toast';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import PageHeader from '@/components/PageHeader.vue';
import ReportFilterBar from './ReportFilterBar.vue';
import ReportList from './ReportList.vue';
import ReportManagerDialog from './ReportManagerDialog.vue';
import ReportFormDialog from './ReportFormDialog.vue';
import monthlyReportsService from '@/services/monthlyReports.service.js';
import api from '@/services/api.js';

const toast = useToastService();

const cabang       = ref('');
const periode      = ref('');
const selectedDate = ref(null);
const selectedIds  = ref([]);
const reportList   = ref([]);
const loadingReports = ref(false);
const isExporting  = ref(false);
const showManager  = ref(false);
const showForm     = ref(false);
const saving       = ref(false);
const editingReport = ref(null);

const showDeleteConfirm = ref(false);
const deletingReport    = ref(null);
const deleting          = ref(false);

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

// Job async: export dijalankan sebagai background job di backend, bukan lagi
// synchronous request. Halaman hanya perlu: (1) memulai job, (2) memantau status
// via progress module, (3) mengunduh file saat selesai.
const MAX_WAIT_MS = 120 * 60 * 1000;   // batas tunggu job (2 jam)
const POLL_INTERVAL_MS = 1500;

// Jika komponen di-unmount saat job masih berjalan, polling tetap lanjut (biar
// download tetap terjadi) tapi toast tidak ditampilkan lagi.
let disposed = false;
onUnmounted(() => { disposed = true; });

const notify = (type, title, message) => {
  if (disposed) return;
  if (type === 'success') toast.showSuccess(title, message);
  else if (type === 'error') toast.showError(title, message);
  else toast.showInfo(title, message);
};

const handleExport = async () => {
  if (!cabang.value || !periode.value || selectedIds.value.length === 0) return;

  isExporting.value = true;
  const jobs = [];
  let startFailCount = 0;

  // 1. Mulai semua job export terpilih
  for (const id of selectedIds.value) {
    const report = reportList.value.find(r => r['id-reports'] === id);
    const reportName = report?.['name-reports'] || id;

    try {
      const res = await monthlyReportsService.startExport(id, {
        cab: cabang.value,
        prd: periode.value,
      });
      const taskId = res.data?.taskId;
      if (!taskId) throw new Error('Backend tidak mengembalikan taskId');

      jobs.push({ taskId, reportName, id });
      notify('info', 'Diproses', `Export "${reportName}" dijalankan. Progress tampil di panel kiri.`);
    } catch (err) {
      startFailCount++;
      const errMsg = err.response?.data?.message || err.message || 'Terjadi kesalahan';
      notify('error', 'Gagal Memulai', `${reportName}: ${errMsg}`);
      console.error(`Start export error [${id}]:`, err);
    }
  }

  // 2. Pantau semua job hingga selesai/gagal, lalu unduh file yang berhasil
  let successCount = 0;
  let failCount = 0;
  if (jobs.length > 0) {
    const results = await Promise.all(jobs.map(job => pollExportJob(job)));
    successCount = results.filter(r => r === true).length;
    failCount = results.length - successCount;

    if (successCount > 0) {
      notify('success', 'Selesai', `${successCount} laporan berhasil diunduh${failCount > 0 ? `, ${failCount} gagal` : ''}`);
    } else if (failCount > 0) {
      notify('error', 'Selesai dengan kesalahan', 'Tidak ada laporan yang berhasil diunduh');
    }
  }

  isExporting.value = false;
};

/**
 * Pantau status satu job export sampai terminal state, lalu unduh filenya.
 * @returns {Promise<boolean>} true = berhasil diunduh
 */
const pollExportJob = async ({ taskId, reportName, id }) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let task = null;
    let networkError = false;
    try {
      const res = await api.get(`/progress/${taskId}`);
      task = res.data?.data || null;
    } catch (err) {
      if (err.response?.status === 404) {
        task = null; // task hilang dari progressMap (selesai auto-remove / dibatalkan)
      } else {
        networkError = true; // jaringan/backend bermasalah → retry di iterasi berikutnya
      }
    }

    // Jangan langsung menyerah saat jaringan bermasalah — job backend masih jalan
    if (networkError) continue;

    const status = task?.status;

    if (status === 'completed') {
      return downloadExport(taskId, reportName, id);
    }
    if (status === 'failed' || status === 'cancelled' || status === 'timed_out') {
      const reason = task?.error || task?.info?.description || status;
      notify('error', 'Gagal', `${reportName}: ${reason}`);
      return false;
    }
    if (status === 'in-progress' || status === 'pending' || status === 'running') {
      continue; // masih berjalan
    }
    if (!task) {
      // Task hilang dari progressMap: bisa karena selesai (auto-remove 2 detik)
      // atau dibatalkan. Coba unduh langsung — backend menyimpan file 24 jam.
      const dl = await tryDownloadExport(taskId, reportName, id);
      if (dl === true) return true;
      if (dl === null) continue; // 409 = masih diproses
      return false;
    }
  }

  notify('error', 'Timeout', `${reportName}: melebihi batas waktu tunggu (2 jam). Cek kembali file di server.`);
  return false;
};

/** Unduh file saat status job sudah 'completed'. */
const downloadExport = async (taskId, reportName, id) => {
  try {
    const res = await monthlyReportsService.downloadExportFile(taskId);
    triggerBlobDownload(res, reportName);
    return true;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'Terjadi kesalahan';
    notify('error', 'Gagal', `${reportName}: ${errMsg}`);
    console.error(`Download error [${id}]:`, err);
    return false;
  }
};

/**
 * Coba unduh file saat status task tidak diketahui.
 * @returns {true|null|false} true=berhasil, null=masih diproses (409), false=gagal
 */
const tryDownloadExport = async (taskId, reportName, id) => {
  try {
    const res = await monthlyReportsService.downloadExportFile(taskId);
    triggerBlobDownload(res, reportName);
    return true;
  } catch (err) {
    if (err.response?.status === 409) return null; // masih diproses
    const errMsg = err.response?.data?.message || err.message || 'Terjadi kesalahan';
    notify('error', 'Gagal', `${reportName}: ${errMsg}`);
    console.error(`Download error [${id}]:`, err);
    return false;
  }
};

/** Trigger download Blob ke browser (nama file dari Content-Disposition). */
const triggerBlobDownload = (res, reportName) => {
  const contentType = res.headers?.['content-type'] || '';
  const contentDisp = res.headers?.['content-disposition'] || '';

  let fileExt = '.xlsx';
  let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (contentType.includes('application/pdf')) {
    fileExt = '.pdf';
    mimeType = 'application/pdf';
  }

  let fileName = `${reportName}_${periode.value}${fileExt}`;
  const filenameMatch = contentDisp.match(/filename="?([^";\n]+)"?/);
  if (filenameMatch) {
    fileName = decodeURIComponent(filenameMatch[1]);
  }

  const blob = new Blob([res.data], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href  = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  selectedDate.value = lastMonth;
  const yy = lastMonth.getFullYear().toString().slice(-2);
  const mm = String(lastMonth.getMonth() + 1).padStart(2, '0');
  periode.value = yy + mm;
});
</script>

<style scoped>
.monthly-reports-tab {
  padding: 0.5rem 0;
}

.delete-confirm-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
