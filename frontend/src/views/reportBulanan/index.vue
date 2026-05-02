<template>
  <div class="monthly-reports-view">
    <PageHeader
      title="Laporan Bulanan"
      subtitle="Generate dan kelola laporan bulanan per cabang"
      description="Pilih cabang, periode, dan laporan yang ingin diekspor. Laporan akan diunduh dalam format Excel (.xlsx) langsung ke perangkat Anda."
    />

    <div class="content-container">
      <!-- Filter & Action Bar -->
      <ReportFilterBar
        v-model:cabang="cabang"
        v-model:periode="periode"
        v-model:selectedDate="selectedDate"
        :selected-count="selectedIds.length"
        :is-exporting="isExporting"
        @export-clicked="handleExport"
        @open-manager="showManager = true"
      />

      <!-- Report Checklist -->
      <ReportList
        :reports="reportList"
        :loading="loadingReports"
        v-model:selected-ids="selectedIds"
        @refresh="loadReports"
      />
    </div>

    <!-- Dialog: Kelola Laporan -->
    <ReportManagerDialog
      v-model:visible="showManager"
      :reports="reportList"
      :loading="loadingReports"
      @refresh="loadReports"
      @open-form="openForm"
      @delete-report="confirmDelete"
    />

    <!-- Dialog: Form Tambah / Edit Laporan -->
    <ReportFormDialog
      v-model:visible="showForm"
      :edit-data="editingReport"
      :saving="saving"
      @save="saveReport"
    />

    <!-- Dialog: Confirm Hapus -->
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
import { ref, onMounted } from 'vue';
import { useToastService } from '@/utils/toast';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import PageHeader from '@/components/PageHeader.vue';
import ReportFilterBar from './components/ReportFilterBar.vue';
import ReportList from './components/ReportList.vue';
import ReportManagerDialog from './components/ReportManagerDialog.vue';
import ReportFormDialog from './components/ReportFormDialog.vue';
import monthlyReportsService from '@/services/monthlyReports.service.js';
import { useAuthStore } from '@/stores';

const toast = useToastService();
const authStore = useAuthStore();

// ─── State ────────────────────────────────────────────────────────────────────
const cabang       = ref('');
const periode      = ref('');       // format YYMM
const selectedDate = ref(null);     // Date object untuk Calendar
const selectedIds  = ref([]);
const reportList   = ref([]);
const loadingReports = ref(false);
const isExporting  = ref(false);
const showManager  = ref(false);
const showForm     = ref(false);
const saving       = ref(false);
const editingReport = ref(null);

// Delete confirm
const showDeleteConfirm = ref(false);
const deletingReport    = ref(null);
const deleting          = ref(false);

// ─── Load Reports ─────────────────────────────────────────────────────────────
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

// ─── Export ───────────────────────────────────────────────────────────────────
const handleExport = async () => {
  if (!cabang.value || !periode.value || selectedIds.value.length === 0) return;

  isExporting.value = true;
  let successCount = 0;
  let failCount    = 0;

  // Sequential: satu laporan selesai dulu baru berikutnya
  for (const id of selectedIds.value) {
    const report = reportList.value.find(r => r['id-reports'] === id);
    const reportName = report?.['name-reports'] || id;

    try {
      toast.showInfo('Memproses', `Mengunduh: ${reportName}...`, 2500);
      const res = await monthlyReportsService.exportReport(id, {
        cab: cabang.value,
        prd: periode.value,
      });

      // Trigger download dari Blob
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `${reportName}_${periode.value}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      successCount++;
    } catch (err) {
      failCount++;
      const errMsg = err.response?.data?.message || err.message || 'Terjadi kesalahan';
      toast.showError('Gagal', `${reportName}: ${errMsg}`);
      console.error(`Export error [${id}]:`, err);
    }
  }

  isExporting.value = false;

  if (successCount > 0) {
    toast.showSuccess('Selesai', `${successCount} laporan berhasil diunduh${failCount > 0 ? `, ${failCount} gagal` : ''}`);
  }
};

// ─── Form (Add / Edit) ────────────────────────────────────────────────────────
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

// ─── Delete ───────────────────────────────────────────────────────────────────
const confirmDelete = (report) => {
  deletingReport.value = report;
  showDeleteConfirm.value = true;
};

const doDelete = async () => {
  if (!deletingReport.value) return;
  deleting.value = true;
  try {
    await monthlyReportsService.deleteReport(deletingReport.value['id-reports']);
    toast.showSuccess('Sukses', `Laporan "${deletingReport.value['name-reports']}" berhasil dihapus`);
    showDeleteConfirm.value = false;
    deletingReport.value = null;
    // Hapus dari selectedIds jika ada
    selectedIds.value = selectedIds.value.filter(id => id !== deletingReport.value?.['id-reports']);
    await loadReports();
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    toast.showError('Gagal', `Gagal menghapus laporan: ${errMsg}`);
    console.error(err);
  } finally {
    deleting.value = false;
  }
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  loadReports();
  // Set periode default ke bulan ini
  const now = new Date();
  selectedDate.value = now;
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  periode.value = yy + mm;
});
</script>

<style src="./index.css" scoped />
