<template>
  <div class="adjust-view">
    <PageHeader title="Upload Adjustment CSV" subtitle="Proses adjustment dengan menggunakan file csv"
      description="Upload file CSV dengan format KDTK, PRDCD, QTY_ADJ dan KETER untuk memproses penyesuaian item BJD di toko-toko yang ditentukan." />

    <div class="content-container">
      <!-- Template Download Card -->
      <div class="card template-card">
        <div class="template-compact-section">
          <div class="template-header">
            <div class="header-content">
              <div class="title-section">
                <i class="pi pi-file-export template-icon"></i>
                <div class="title-text">
                  <h3 class="template-title">CSV Template</h3>
                  <p class="template-subtitle">Download master format untuk adjustment</p>
                </div>
              </div>
              <DownloadButton variant="primary" size="medium" text="Download" loading-text="Downloading..."
                icon="pi-download" tooltip="Download master CSV template" @download="handleDownloadTemplate" />
            </div>
          </div>

          <div class="format-preview">
            <div class="format-badge">
              <i class="pi pi-table"></i>
              <span>Format: KDTK, PRDCD, QTY_ADJ, KETER</span>
            </div>
            <button class="format-details-toggle" @click="showFormatDetails = !showFormatDetails"
              :class="{ 'active': showFormatDetails }">
              <span>{{ showFormatDetails ? 'Sembunyikan' : 'Lihat' }} detail format</span>
              <i class="pi" :class="showFormatDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
          </div>

          <transition name="slide-fade">
            <div v-if="showFormatDetails" class="format-details-expanded">
              <div class="format-grid-compact">
                <div v-for="(field, index) in csvFields" :key="index" class="format-item-compact">
                  <div class="field-header-compact">
                    <span class="field-name-compact">{{ field.name }}</span>
                    <span v-if="field.required" class="field-required">*</span>
                  </div>
                  <div class="field-description-compact">{{ field.description }}</div>
                  <div v-if="field.example" class="field-example-compact">
                    <small>{{ field.example }}</small>
                  </div>
                </div>
              </div>
              <div class="quick-notes">
                <i class="pi pi-info-circle"></i>
                <span>File CSV dengan delimiter koma, encoding UTF-8, nilai QTY_ADJ bisa +/-</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Upload Card -->
      <div class="card upload-card">
        <div class="upload-compact-section">
          <div class="upload-header">
            <div class="upload-header-content">
              <div class="upload-title-section">
                <i class="pi pi-file-import upload-icon"></i>
                <div class="upload-title-text">
                  <h3 class="upload-title">Upload File CSV</h3>
                  <p class="upload-subtitle">Pilih file adjustment untuk diproses</p>
                </div>
              </div>
              <div class="upload-status" v-if="selectedFile">
                <div class="file-selected-indicator">
                  <i class="pi pi-check-circle"></i>
                  <span>File Ready</span>
                </div>
              </div>
            </div>
          </div>

          <div class="file-input-section" v-if="!isProcessing">
            <div class="drag-drop-area"
              :class="{ 'drag-over': isDragOver, 'has-file': selectedFile, 'disabled': isProcessing }"
              @dragover.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false"
              @drop.prevent="handleFileDrop" @click="triggerFileInput">
              <input ref="fileInput" type="file" class="hidden-file-input" id="csvFile" accept=".csv"
                @change="handleFileSelect" :disabled="isProcessing" />

              <div class="drop-content">
                <div v-if="!selectedFile" class="drop-placeholder">
                  <i class="pi pi-cloud-upload drop-icon"></i>
                  <div class="drop-text">
                    <p class="drop-primary">Klik untuk pilih file atau drag & drop</p>
                    <p class="drop-secondary">Format: CSV (KDTK, PRDCD, QTY_ADJ, KETER)</p>
                  </div>
                </div>

                <div v-else class="file-selected">
                  <div class="file-info">
                    <i class="pi pi-file file-icon"></i>
                    <div class="file-details">
                      <p class="file-name">{{ selectedFileName }}</p>
                      <p class="file-size">{{ getFileSize(selectedFile) }}</p>
                    </div>
                  </div>
                  <button class="change-file-btn" @click.stop="resetForm" :disabled="isProcessing">
                    <i class="pi pi-times"></i>
                    <span>Ganti</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="upload-actions" v-if="selectedFile">
            <div class="action-buttons">
              <button class="process-btn" @click="handleUpload" :disabled="!selectedFile || isProcessing"
                :class="{ 'processing': isProcessing }">
                <i class="pi" :class="isProcessing ? 'pi-spin pi-spinner' : 'pi-cog'"></i>
                <span>{{ isProcessing ? 'Processing...' : 'Process File' }}</span>
              </button>
              <button class="reset-btn" @click="resetForm" :disabled="isProcessing">
                <i class="pi pi-refresh"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div v-if="!selectedFile" class="upload-hint">
            <i class="pi pi-info-circle"></i>
            <span v-if="!processResults">Pastikan file CSV sesuai dengan format template yang telah didownload</span>
            <span v-else class="ready-for-next">✓ Siap untuk upload file adjustment berikutnya</span>
          </div>
        </div>
      </div>

      <!-- Processing Loading State -->
      <ProgressBar v-if="isProcessing" :visible="isProcessing" :percentage="progress.percentage" :info="progress.info">
        <template #title>
          Processing Adjustment...
        </template>

        <template #subtitle>
          Connecting to stores and processing adjustments.<br />
          Please wait patiently...
        </template>

        <template #details>
          <small>
            <strong>{{ progress.info }}</strong>
          </small>
        </template>
      </ProgressBar>

      <!-- Results Card -->
      <div class="card results-card" v-if="processResults && !isProcessing">
        <div class="results-header">
          <div class="results-title-section">
            <i class="pi pi-check-circle results-icon"></i>
            <div class="results-title-content">
              <h3 class="results-title">Adjustment Completed</h3>
              <p class="results-subtitle">Processing results and detailed history</p>
            </div>
          </div>
          <div class="results-badge">
            <span class="success-indicator">
              <i class="pi pi-verified"></i>
              Success
            </span>
          </div>
        </div>

        <!-- Compact Summary Cards -->
        <div class="summary-grid">
          <div class="summary-card total">
            <div class="summary-icon">
              <i class="pi pi-building"></i>
            </div>
            <div class="summary-content">
              <span class="summary-value">{{ processResults?.totalStores || 0 }}</span>
              <span class="summary-label">Stores</span>
            </div>
          </div>
          <div class="summary-card success">
            <div class="summary-icon">
              <i class="pi pi-check"></i>
            </div>
            <div class="summary-content">
              <span class="summary-value">{{ processResults?.successStores || 0 }}</span>
              <span class="summary-label">Success</span>
            </div>
          </div>
          <div class="summary-card failed">
            <div class="summary-icon">
              <i class="pi pi-times"></i>
            </div>
            <div class="summary-content">
              <span class="summary-value">{{ processResults?.failedStores?.length || 0 }}</span>
              <span class="summary-label">Disconnect</span>
            </div>
          </div>
          <div class="summary-card records">
            <div class="summary-icon">
              <i class="pi pi-list"></i>
            </div>
            <div class="summary-content">
              <span class="summary-value">{{ processResults?.historyRecords?.length || 0 }}</span>
              <span class="summary-label">Records</span>
            </div>
          </div>
        </div>

        <!-- Modern DataTable -->
        <div class="datatable-section">
          <div class="datatable-header">
            <h4 class="datatable-title">
              <i class="pi pi-history"></i>
              Adjustment History
            </h4>
            <div class="datatable-actions">
              <button class="export-btn" @click="exportToExcel"
                :disabled="!processResults?.historyRecords || processResults.historyRecords.length === 0"
                title="Export to Excel">
                <i class="pi pi-file-excel"></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          <DataTable :value="processResults?.historyRecords || []" :paginator="true" :rows="10"
            :rowsPerPageOptions="[10, 25, 50, 100]"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries" class="modern-datatable"
            :scrollable="true" scrollHeight="400px" stripedRows :loading="isProcessing" responsiveLayout="scroll">
            <Column field="" header="#" class="col-index">
              <template #body="{ index }">
                <span class="row-number">{{ index + 1 }}</span>
              </template>
            </Column>

            <Column field="kdtk" header="Store" class="col-store">
              <template #body="{ data }">
                <div class="store-cell">
                  <span class="store-code">{{ data.kdtk }}</span>
                </div>
              </template>
            </Column>

            <Column field="prdcd" header="Product" class="col-product">
              <template #body="{ data }">
                <div class="product-cell">
                  <span class="product-code">{{ data.prdcd }}</span>
                </div>
              </template>
            </Column>

            <Column field="qty_adj" header="Qty" class="col-qty">
              <template #body="{ data }">
                <div class="qty-cell">
                  <Tag :severity="getQtySeverity(data.qty_adj)" :icon="getQtyIcon(data.qty_adj)" class="qty-tag">
                    {{ formatQuantity(data.qty_adj) }}
                  </Tag>
                </div>
              </template>
            </Column>

            <Column field="keter" header="Description" class="col-description">
              <template #body="{ data }">
                <div class="description-cell" :title="data.keter">
                  <span class="description-text">{{ truncateText(data.keter, 35) }}</span>
                </div>
              </template>
            </Column>

            <Column field="status" header="Status" class="col-status">
              <template #body="{ data }">
                <div class="status-cell">
                  <Tag :severity="data.status === 'SUCCESS' ? 'success' : 'danger'"
                    :icon="data.status === 'SUCCESS' ? 'pi pi-check' : 'pi pi-times'" class="status-tag">
                    {{ data.status === 'SUCCESS' ? 'Success' : 'Failed' }}
                  </Tag>
                </div>
              </template>
            </Column>

            <Column field="note" header="Note" class="col-note">
              <template #body="{ data }">
                <div class="note-cell" :title="data.note">
                  <span class="note-text">{{ truncateText(data.note, 30) }}</span>
                </div>
              </template>
            </Column>

            <Column field="updtime" header="Time" class="col-time">
              <template #body="{ data }">
                <div class="time-cell">
                  <div class="time-content">
                    <span class="date-text">{{ formatDate(data.updtime) }}</span>
                    <span class="time-text">{{ formatTime(data.updtime) }}</span>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="pic" header="PIC" class="col-pic">
              <template #body="{ data }">
                <div class="pic-cell">
                  <span class="pic-code">{{ data.pic || '-' }}</span>
                </div>
              </template>
            </Column>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-inbox empty-icon"></i>
                <p class="empty-text">No adjustment records found</p>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./AdjustView.style.css" scoped></style>
<script setup>
import { ref, onBeforeUnmount, watch } from "vue";
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '../../stores';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import api from "../../services/api.js";
import adjustService from "../../services/adjust.service.js";
import progressService from "../../services/progress.service.js";
import PageHeader from "../../components/PageHeader.vue";
import DownloadButton from "../../components/common/DownloadButton.vue";
import { exportAdjustmentHistory } from "./exportExcel.js";
import ProgressBar from "../../components/common/ProgressBar.vue";

const toast = useToast();
const authStore = useAuthStore();
const strUsername = authStore.user.username;

// console.log(`user dari store auth: ${authStore.user.username}`);

// State
const selectedFile = ref(null);
const selectedFileName = ref("");
const isProcessing = ref(false);
const processResults = ref(null);
const showFormatDetails = ref(false);
const isDragOver = ref(false);
const fileInput = ref(null);
const progress = ref({
  percentage: 0,
  info: "",
  status: "idle",
});
let eventSource = null;

// CSV field definitions for the info card
const csvFields = [
  {
    name: 'KDTK',
    description: 'Kode toko yang akan diproses adjustment',
    example: 'TW75',
    required: true
  },
  {
    name: 'PRDCD',
    description: 'Kode produk (8 digit) yang akan di adjust',
    example: '20000459',
    required: true
  },
  {
    name: 'QTY_ADJ',
    description: 'Quantity adjustment (nilai positif/negatif)',
    example: '10, -5, 25',
    required: true
  },
  {
    name: 'KETER',
    description: 'Keterangan atau deskripsi adjustment',
    example: 'Stock correction, Damaged goods',
    required: true
  }
];

// Formatting methods for PrimeVue components
const getQtySeverity = (qty) => {
  if (qty > 0) return 'success';
  if (qty < 0) return 'danger';
  return 'warning';
};

const getQtyIcon = (qty) => {
  if (qty > 0) return 'pi pi-plus-circle';
  if (qty < 0) return 'pi pi-minus-circle';
  return 'pi pi-circle';
};

const formatQuantity = (qty) => {
  if (qty > 0) return `+${qty}`;
  return qty.toString();
};

const truncateText = (text, maxLength) => {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatDate = (dateTime) => {
  if (!dateTime) return '-';
  const date = new Date(dateTime);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const formatTime = (dateTime) => {
  if (!dateTime) return '-';
  const date = new Date(dateTime);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Watch untuk isProcessing - mulai/hentikan progress tracking
watch(isProcessing, (newVal) => {
  if (newVal) {
    // Mulai progress tracking ketika processing dimulai
    startProgressTracking();
  } else {
    // Hentikan progress tracking ketika processing selesai
    stopProgressTracking();
  }
});

// Methods
const startProgressTracking = async () => {

  const taskId = `adjustmentTask_${strUsername}`; // Sesuai dengan config.taskProgressName di backend

  // Hentikan tracking sebelumnya jika ada
  stopProgressTracking();

  try {
    const progressResponse = await api.get('/progress');
    const allTasks = progressResponse.data.data;
    // Cari task dengan ID yang sesuai
    const existingTask = allTasks[taskId];

    if (existingTask) {
      console.log('✅ Matching task found:');

      // 2. Jika task ditemukan, mulai monitor progress
      startDirectProgressMonitoring(taskId);
    } else {
      console.log('⚠️ No existing task found, waiting for task to be created...');

      // 3. Jika task belum ada, coba lagi setelah delay
      setTimeout(() => {
        if (isProcessing.value) {
          console.log('🔄 Retrying progress tracking...');
          startProgressTracking();
        }
      }, 1000); // Coba lagi setelah 1 detik
    }
  } catch (error) {
    console.error('❌ Error checking progress tasks:', error);

    // Fallback: langsung coba monitor progress meskipun cek gagal
    console.log('🔄 Fallback: Starting progress monitoring directly...');
    startDirectProgressMonitoring(taskId);
  }
};

// Method untuk langsung monitor progress tanpa pengecekan awal
const startDirectProgressMonitoring = (taskId) => {
  eventSource = progressService.monitorProgress(
    taskId,
    // onUpdate callback
    (progressData) => {
      progress.value = {
        percentage: progressData?.percentage,
        info: progressData?.info.description || progressData?.status,
        status: progressData?.status
      };
    },
    // onComplete callback
    (progressData) => {
      progress.value = {
        percentage: 100,
        info: "Processing completed",
        status: "completed"
      };
    },
    // onError callback
    (errorData) => {
      progress.value = {
        percentage: 0,
        info: errorData.description || "Processing failed",
        status: "failed"
      };

      console.error('❌ Progress error:', errorData);

      toast.add({
        severity: "error",
        summary: "Progress Error",
        detail: errorData.description || "Progress monitoring failed",
        life: 5000,
      });
    }
  );
};

const stopProgressTracking = () => {
  if (eventSource) {
    console.log('🛑 Stopping progress tracking...');
    eventSource.close();
    eventSource = null;
  }

  // Reset progress state
  progress.value = {
    percentage: 0,
    info: "",
    status: "idle"
  };
};

const handleFileSelect = event => {
  const file = event.target.files[0];
  if (file) {
    validateAndSetFile(file);
  }
};

const handleUpload = async () => {
  if (!selectedFile.value) return;

  try {
    isProcessing.value = true;

    progress.value = {
      percentage: 0,
      info: "Starting upload...",
      status: "starting"
    };

    // Extract the data structure correctly - response.data.data.data contains the actual results
    const resultData = await adjustService.uploadCsv(selectedFile.value);
    processResults.value = resultData.data.data;

    if (resultData.success === true) {
      // Reset upload form after successful processing
      resetForm();

      // Safely check for failedStores
      const failedCount = processResults.value?.failedStores?.length || 0;
      const successCount = processResults.value?.successStores || 0;
      const totalStores = processResults.value?.totalStores || 0;

      toast.add({
        severity: failedCount > 0 ? "warn" : "success",
        summary: failedCount > 0 ? "Completed with Issues" : "Success",
        detail: `Processing completed. ${successCount}/${totalStores} stores processed successfully.`,
        life: 5000,
      });

      // Log results for debugging
      console.log('Processing results:', {
        total: totalStores,
        success: successCount,
        failed: failedCount,
        historyRecords: processResults.value?.historyRecords?.length || 0
      });
    } else {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: resultData.message || "Failed to process file",
        life: 5000,
      });
    }

  } catch (error) {
    console.error("Upload error:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: error.response?.data?.message || "Failed to process file",
      life: 5000,
    });
  } finally {
    isProcessing.value = false;
  }
};

const resetForm = () => {
  selectedFile.value = null;
  selectedFileName.value = "";
  isDragOver.value = false;
  progress.value = {
    percentage: 0,
    info: "",
    status: "idle"
  };
  
  // Clear the file input properly
  if (fileInput.value) {
    fileInput.value.value = "";
  }
  
  // Also clear by ID as fallback
  const fileInputElement = document.getElementById("csvFile");
  if (fileInputElement) {
    fileInputElement.value = "";
  }
};

// Enhanced file handling methods
const triggerFileInput = () => {
  if (!isProcessing.value && fileInput.value) {
    fileInput.value.click();
  }
};

const handleFileDrop = (event) => {
  isDragOver.value = false;
  if (isProcessing.value) return;
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    validateAndSetFile(file);
  }
};

const validateAndSetFile = (file) => {
  if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Please select a CSV file",
      life: 3000,
    });
    return;
  }
  
  selectedFile.value = file;
  selectedFileName.value = file.name;
};

const getFileSize = (file) => {
  if (!file) return '';
  const size = file.size;
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return Math.round(size / 1024) + ' KB';
  return Math.round(size / (1024 * 1024)) + ' MB';
};

// Template download handler
const handleDownloadTemplate = async () => {
  try {
    await adjustService.downloadTemplate();
    
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Template CSV berhasil didownload",
      life: 3000,
    });
  } catch (error) {
    console.error("Download template error:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: error.message || "Gagal mendownload template",
      life: 5000,
    });
  }
};

// Export to Excel
const exportToExcel = () => {
  if (!processResults.value?.historyRecords || processResults.value.historyRecords.length === 0) {
    toast.add({
      severity: "warn",
      summary: "Perhatian",
      detail: "Tidak ada data untuk diekspor",
      life: 3000,
    });
    return;
  }

  try {
    const result = exportAdjustmentHistory(processResults.value.historyRecords);
    
    if (result.success) {
      toast.add({
        severity: "success",
        summary: "Sukses",
        detail: `Data berhasil diekspor ke ${result.filename}`,
        life: 3000,
      });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Gagal mengekspor data ke Excel",
      life: 5000,
    });
  }
};

onBeforeUnmount(() => {
  if (eventSource) eventSource.close();
});
</script>
./exportUtils.js./exportExcel.js