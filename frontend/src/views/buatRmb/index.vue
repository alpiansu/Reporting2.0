<template>
  <div class="rmb-view">
    <PageHeader title="Buat RMB via CSV" subtitle="Proses pembuatan RMB dengan menggunakan file csv"
      description="Upload file CSV dengan format KDTK, TANGGAL, PRDCD, NOHP, TRXID untuk memproses pembuatan RMB di toko-toko yang ditentukan." />

    <div class="content-container">
      <!-- Mode Selection Cards -->
      <div class="mode-selection">
        <div class="mode-card" :class="{ 'active': activeMode === 'csv' }" @click="activeMode = 'csv'">
          <div class="mode-icon-wrapper csv">
            <i class="pi pi-file-excel"></i>
          </div>
          <div class="mode-content">
            <h3>Upload CSV</h3>
            <p>Upload file batch untuk proses RMB banyak toko sekaligus.</p>
          </div>
        </div>

        <div class="mode-card" :class="{ 'active': activeMode === 'manual' }" @click="showManualDialog = true; activeMode = 'manual'">
          <div class="mode-icon-wrapper manual">
            <i class="pi pi-file-edit"></i>
          </div>
          <div class="mode-content">
            <h3>Input Manual</h3>
            <p>Isi form langsung tanpa perlu membuat file CSV terlebih dahulu.</p>
          </div>
        </div>
      </div>

      <!-- Template Download Card (Hanya tampil jika mode CSV aktif) -->
      <div v-if="activeMode === 'csv'" class="card template-card">
        <div class="template-compact-section">
          <div class="template-header">
            <div class="header-content">
              <div class="title-section">
                <i class="pi pi-file-export template-icon"></i>
                <div class="title-text">
                  <h3 class="template-title">CSV Template</h3>
                  <p class="template-subtitle">Download master format untuk buat RMB</p>
                </div>
              </div>
              <DownloadButton variant="primary" size="medium" text="Download" loading-text="Downloading..."
                icon="pi-download" tooltip="Download master CSV template" @download="handleDownloadTemplate" />
            </div>
          </div>

          <div class="format-preview">
            <div class="format-badge">
              <i class="pi pi-table"></i>
              <span>Format: KDTK, TANGGAL, PRDCD, NOHP, TRXID</span>
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
                <span>File CSV dengan delimiter koma, encoding UTF-8</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- History Report Card -->
      <BuatRmbHistoryReportCard />

      <!-- Upload Card (Hanya tampil jika mode CSV aktif) -->
      <div v-if="activeMode === 'csv'" class="card upload-card">
        <div class="upload-compact-section">
          <div class="upload-header">
            <div class="upload-header-content">
              <div class="upload-title-section">
                <i class="pi pi-file-import upload-icon"></i>
                <div class="upload-title-text">
                  <h3 class="upload-title">Upload File CSV</h3>
                  <p class="upload-subtitle">Pilih file RMB untuk diproses</p>
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
                    <p class="drop-secondary">Format: CSV (KDTK, TANGGAL, PRDCD, NOHP, TRXID)</p>
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
              <button class="process-btn" @click="handleUpload" :disabled="!selectedFile || isProcessing || !isFileApproved"
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
            <span v-else class="ready-for-next">✓ Siap untuk upload file RMB berikutnya</span>
          </div>
        </div>
      </div>

      <!-- Processing Loading State -->
      <ProgressBar v-if="isProcessing" :visible="isProcessing" :percentage="progress.percentage" :info="progress.info">
        <template #title>
          Processing RMB...
        </template>

        <template #subtitle>
          Connecting to stores and processing RMB.<br />
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
              <h3 class="results-title">RMB Completed</h3>
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
              RMB History
            </h4>
            <div class="datatable-actions">
              <div class="datatable-search">
                <i class="pi pi-search search-icon"></i>
                <input class="datatable-search-input" type="text" v-model="filters['global'].value"
                  placeholder="Cari data..." />
                <button class="clear-filter-btn" @click="clearFilters" :disabled="isProcessing">
                  <i class="pi pi-filter-slash"></i>
                  <span>Clear</span>
                </button>
              </div>
              <button class="export-btn" @click="exportToExcel"
                :disabled="!processResults?.historyRecords || processResults.historyRecords.length === 0"
                title="Export to Excel">
                <i class="pi pi-file-excel"></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          <DataTable :value="processResults?.historyRecords || []" :paginator="true" :rows="10"
            v-model:filters="filters"
            :globalFilterFields="['kdtk','tanggal','prdcd','nohp','trxid','status','note','updtime','pic']"
            :rowsPerPageOptions="[10, 25, 50, 100]"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries" class="modern-datatable"
            :scrollable="true" scrollHeight="400px" stripedRows :loading="isProcessing" responsiveLayout="scroll">
            <Column field="" header="#" class="col-index">
              <template #body="{ index }">
                <span class="row-number">{{ index + 1 }}</span>
              </template>
            </Column>

            <Column field="kdtk" header="Store" class="col-store" sortable>
              <template #body="{ data }">
                <div class="store-cell">
                  <span class="store-code">{{ data.kdtk }}</span>
                </div>
              </template>
            </Column>

            <Column field="tanggal" header="Tanggal" sortable>
              <template #body="{ data }">
                <span>{{ formatDateOnly(data.tanggal) }}</span>
              </template>
            </Column>

            <Column field="prdcd" header="Product" class="col-product" sortable>
              <template #body="{ data }">
                <div class="product-cell">
                  <span class="product-code">{{ data.prdcd }}</span>
                </div>
              </template>
            </Column>

            <Column field="nohp" header="No HP" sortable>
              <template #body="{ data }">
                <span>{{ data.nohp }}</span>
              </template>
            </Column>

            <Column field="trxid" header="Trx ID" sortable>
              <template #body="{ data }">
                <span>{{ data.trxid }}</span>
              </template>
            </Column>

            <Column field="status" header="Status" class="col-status" sortable>
              <template #body="{ data }">
                <div class="status-cell">
                  <Tag :severity="data.status === 'SUCCESS' ? 'success' : 'danger'"
                    :icon="data.status === 'SUCCESS' ? 'pi pi-check' : 'pi pi-times'" class="status-tag">
                    {{ data.status === 'SUCCESS' ? 'Success' : 'Failed' }}
                  </Tag>
                </div>
              </template>
            </Column>

            <Column field="note" header="Note" class="col-note" sortable>
              <template #body="{ data }">
                <div class="note-cell" :title="data.note">
                  <span class="note-text">{{ truncateText(data.note, 30) }}</span>
                </div>
              </template>
            </Column>

            <Column field="updtime" header="Time" class="col-time" sortable>
              <template #body="{ data }">
                <div class="time-cell">
                  <div class="time-content">
                    <span class="date-text">{{ formatDate(data.updtime) }}</span>
                    <span class="time-text">{{ formatTime(data.updtime) }}</span>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="pic" header="PIC" class="col-pic" sortable>
              <template #body="{ data }">
                <div class="pic-cell">
                  <span class="pic-code">{{ data.pic || '-' }}</span>
                </div>
              </template>
            </Column>

            <template #empty>
              <div class="empty-state">
                <i class="pi pi-inbox empty-icon"></i>
                <p class="empty-text">No RMB records found</p>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
      <BuatRmbCsvPreviewDialog
        :show="showCsvPreviewDialog"
        :fileName="pendingSelectedFileName"
        :headers="csvHeaders"
        :rows="csvRows"
        :totalRows="csvTotalRows"
        @cancel="handlePreviewCancel"
        @confirm="handlePreviewConfirm"
      />

      <BuatRmbManualInputDialog
        v-model:visible="showManualDialog"
        @success="handleManualSuccess"
      />
    </div>
  </div>
</template>

<style src="./index.css" scoped></style>
<script setup>
import { ref, onBeforeUnmount, watch, onMounted } from "vue";
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '../../stores';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import api from "../../services/api.js";
import buatRmbService from "../../services/buatRmb.service.js";
import progressService from "../../services/progress.service.js";
import PageHeader from "../../components/PageHeader.vue";
import DownloadButton from "../../components/common/DownloadButton.vue";
import ProgressBar from "../../components/common/ProgressBar.vue";
import BuatRmbHistoryReportCard from "./components/BuatRmbHistoryReportCard.vue";
import BuatRmbCsvPreviewDialog from "./components/BuatRmbCsvPreviewDialog.vue";
import BuatRmbManualInputDialog from "./components/BuatRmbManualInputDialog.vue";
import * as XLSX from "xlsx";

const toast = useToast();
const authStore = useAuthStore();
const strUsername = authStore.user.username;

// State
const selectedFile = ref(null);
const selectedFileName = ref("");
const pendingSelectedFile = ref(null);
const pendingSelectedFileName = ref("");
const isProcessing = ref(false);
const processResults = ref(null);
const showFormatDetails = ref(false);
const isDragOver = ref(false);
const fileInput = ref(null);
const showCsvPreviewDialog = ref(false);
const isFileApproved = ref(false);
const csvHeaders = ref([]);
const csvRows = ref([]);
const csvTotalRows = ref(0);
const filters = ref({
  global: { value: null, matchMode: 'contains' },
  kdtk: { value: null, matchMode: 'contains' },
  tanggal: { value: null, matchMode: 'contains' },
  prdcd: { value: null, matchMode: 'contains' },
  nohp: { value: null, matchMode: 'contains' },
  trxid: { value: null, matchMode: 'contains' },
  status: { value: null, matchMode: 'contains' },
  note: { value: null, matchMode: 'contains' },
  updtime: { value: null, matchMode: 'contains' },
  pic: { value: null, matchMode: 'contains' }
});
const progress = ref({
  percentage: 0,
  info: "",
  status: "idle",
});
let eventSource = null;

// Manual Input State
const activeMode = ref(null); // 'csv' | 'manual'
const showManualDialog = ref(false);

// CSV field definitions for the info card
const csvFields = [
  {
    name: 'KDTK',
    description: 'Kode toko yang akan diproses RMB',
    example: 'TW75',
    required: true
  },
  {
    name: 'TANGGAL',
    description: 'Tanggal transaksi RMB',
    example: '2024-01-20',
    required: true
  },
  {
    name: 'PRDCD',
    description: 'Kode produk',
    example: '20000459',
    required: true
  },
  {
    name: 'NOHP',
    description: 'Nomor Handphone (opsional)',
    example: '081234567890',
    required: false
  },
  {
    name: 'TRXID',
    description: 'Transaction ID',
    example: 'TRX-12345',
    required: true
  }
];

const truncateText = (text, maxLength) => {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('id-ID');
};

const handleManualSuccess = (results) => {
  processResults.value = results;
  const failedCount = results?.failedStores?.length || 0;
  const successCount = results?.successStores || 0;
  const totalStores = results?.totalStores || 0;

  toast.add({
    severity: failedCount > 0 ? "warn" : "success",
    summary: failedCount > 0 ? "Completed with Issues" : "Success",
    detail: `Manual RMB processed. ${successCount}/${totalStores} stores processed successfully.`,
    life: 5000,
  });
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

watch(isProcessing, (newVal) => {
  if (newVal) {
    startProgressTracking();
  } else {
    stopProgressTracking();
  }
});

onBeforeUnmount(() => {
  stopProgressTracking();
});

const startProgressTracking = async () => {
  const taskId = `rmbTask_${strUsername}`; 

  stopProgressTracking();

  try {
    const progressResponse = await api.get('/progress');
    const allTasks = progressResponse.data.data;
    const existingTask = allTasks[taskId];

    if (existingTask) {
      startDirectProgressMonitoring(taskId);
    } else {
      setTimeout(() => {
        if (isProcessing.value) {
          startProgressTracking();
        }
      }, 1000); 
    }
  } catch (error) {
    startDirectProgressMonitoring(taskId);
  }
};

const startDirectProgressMonitoring = (taskId) => {
  eventSource = progressService.monitorProgress(
    taskId,
    (progressData) => {
      progress.value = {
        percentage: progressData?.percentage,
        info: progressData?.info?.description || progressData?.status || "Processing...",
        status: progressData?.status
      };
    },
    (progressData) => {
      progress.value = {
        percentage: 100,
        info: "Processing completed",
        status: "completed"
      };
    },
    (errorData) => {
      progress.value = {
        percentage: 0,
        info: errorData?.description || "Processing failed",
        status: "failed"
      };

      isProcessing.value = false;

      toast.add({
        severity: "error",
        summary: "Progress Error",
        detail: errorData?.description || "Progress monitoring failed",
        life: 5000,
      });
    },
    // onCancel callback - user-initiated cancellation, no error display
    (cancelData) => {
      console.log('ℹ️ Task cancelled by user:', cancelData);
      progress.value = {
        percentage: 0,
        info: "Proses dibatalkan oleh pengguna",
        status: "cancelled"
      };
      isProcessing.value = false;
    }
  );
};

const stopProgressTracking = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  progress.value = { percentage: 0, info: "", status: "idle" };
};

const handleFileSelect = event => {
  const file = event.target.files[0];
  if (file) {
    validateAndSetFile(file);
  }
};

const handleUpload = async () => {
  if (!selectedFile.value || !isFileApproved.value) return;

  try {
    isProcessing.value = true;
    progress.value = { percentage: 0, info: "Starting upload...", status: "starting" };

    const resultData = await buatRmbService.uploadCsv(selectedFile.value);
    processResults.value = resultData?.data?.data || resultData?.data || {};

    if (resultData.success === true || (resultData.data && resultData.data.success)) {
      resetForm();
      const failedCount = processResults.value?.failedStores?.length || 0;
      const successCount = processResults.value?.successStores || 0;
      const totalStores = processResults.value?.totalStores || 0;

      toast.add({
        severity: failedCount > 0 ? "warn" : "success",
        summary: failedCount > 0 ? "Completed with Issues" : "Success",
        detail: `Processing completed. ${successCount}/${totalStores} stores processed successfully.`,
        life: 5000,
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
      detail: error.response?.data?.message || error.message || "Failed to process file",
      life: 5000,
    });
  } finally {
    isProcessing.value = false;
  }
};

const resetForm = () => {
  selectedFile.value = null;
  selectedFileName.value = "";
  pendingSelectedFile.value = null;
  pendingSelectedFileName.value = "";
  isDragOver.value = false;
  progress.value = { percentage: 0, info: "", status: "idle" };
  showCsvPreviewDialog.value = false;
  isFileApproved.value = false;
  csvHeaders.value = [];
  csvRows.value = [];
  csvTotalRows.value = 0;
  clearFileInputDom();
};

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

const clearFilters = () => {
  filters.value = {
    global: { value: null, matchMode: 'contains' },
    kdtk: { value: null, matchMode: 'contains' },
    tanggal: { value: null, matchMode: 'contains' },
    prdcd: { value: null, matchMode: 'contains' },
    nohp: { value: null, matchMode: 'contains' },
    trxid: { value: null, matchMode: 'contains' },
    status: { value: null, matchMode: 'contains' },
    note: { value: null, matchMode: 'contains' },
    updtime: { value: null, matchMode: 'contains' },
    pic: { value: null, matchMode: 'contains' }
  };
};

const validateAndSetFile = async (file) => {
  if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Please select a CSV file",
      life: 3000,
    });
    return;
  }
  try {
    const content = await readFileAsText(file);
    const workbook = XLSX.read(content, { type: "string", raw: true });
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    const rows2d = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const headerRow = (rows2d[0] || []).map(h => String(h).trim());
    const dataRows = [];
    
    const formatSmart = (val, key) => {
      if (val === null || val === undefined || val === "") return "";
      const strVal = String(val).trim();
      if (key && String(key).trim().toUpperCase() === 'PRDCD') return strVal;
      if (key && String(key).trim().toUpperCase() === 'NOHP') return strVal; // Preserve NOHP zeros
      if (/^\d+$/.test(strVal)) {
        if (strVal.length > 1 && strVal.startsWith('0')) return strVal;
        const num = Number(strVal);
        if (!isNaN(num)) return num.toLocaleString('id-ID');
      }
      return strVal;
    };

    for (let i = 1; i < rows2d.length; i++) {
      const row = rows2d[i];
      const isEmpty = Array.isArray(row) && row.every(cell => cell === "" || cell == null);
      if (isEmpty) continue;
      const obj = {};
      for (let j = 0; j < headerRow.length; j++) {
        const key = headerRow[j] || "";
        const val = row[j] ?? "";
        obj[String(key).trim()] = formatSmart(val, key);
      }
      dataRows.push(obj);
    }
    pendingSelectedFile.value = file;
    pendingSelectedFileName.value = file.name;
    csvHeaders.value = headerRow;
    csvRows.value = dataRows;
    csvTotalRows.value = dataRows.length;
    isFileApproved.value = false;
    showCsvPreviewDialog.value = true;
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Gagal membaca file CSV",
      life: 4000,
    });
  }
};

const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let text = reader.result;
      if (typeof text === "string" && text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      resolve(text);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "UTF-8");
  });
};

const handlePreviewCancel = () => {
  showCsvPreviewDialog.value = false;
  pendingSelectedFile.value = null;
  pendingSelectedFileName.value = "";
  csvHeaders.value = [];
  csvRows.value = [];
  csvTotalRows.value = 0;
  clearFileInputDom();
  toast.add({ severity: "info", summary: "Dibatalkan", detail: "Upload dibatalkan", life: 2500 });
};

const handlePreviewConfirm = () => {
  selectedFile.value = pendingSelectedFile.value;
  selectedFileName.value = pendingSelectedFileName.value;
  isFileApproved.value = true;
  showCsvPreviewDialog.value = false;
  clearFileInputDom();
  toast.add({ severity: "success", summary: "Valid", detail: "File siap diproses", life: 2500 });
};

const getFileSize = (file) => {
  if (!file) return '';
  const size = file.size;
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return Math.round(size / 1024) + ' KB';
  return Math.round(size / (1024 * 1024)) + ' MB';
};

const handleDownloadTemplate = async () => {
  try {
    await buatRmbService.downloadTemplate();
    toast.add({ severity: "success", summary: "Success", detail: "Template CSV berhasil didownload", life: 3000 });
  } catch (error) {
    console.error("Download template error:", error);
    toast.add({ severity: "error", summary: "Error", detail: error.message || "Gagal mendownload template", life: 5000 });
  }
};

const exportToExcel = () => {
  if (!processResults.value?.historyRecords || processResults.value.historyRecords.length === 0) {
    toast.add({ severity: "warn", summary: "Perhatian", detail: "Tidak ada data untuk diekspor", life: 3000 });
    return;
  }
  try {
    // Generate simple CSV as fallback since exportExcel.js is not imported
    const records = processResults.value.historyRecords;
    const headers = ['KDTK', 'TANGGAL', 'PRDCD', 'NOHP', 'TRXID', 'STATUS', 'NOTE'];
    let csvContent = headers.join(',') + '\n';
    
    records.forEach(r => {
      const row = [r.kdtk, r.tanggal, r.prdcd, r.nohp, r.trxid, r.status, `"${(r.note || '').replace(/"/g, '""')}"`];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `buat_rmb_history_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.add({ severity: "success", summary: "Sukses", detail: "Data berhasil diekspor", life: 3000 });
  } catch (error) {
    console.error('Error exporting:', error);
    toast.add({ severity: "error", summary: "Error", detail: "Gagal mengekspor data", life: 5000 });
  }
};

const clearFileInputDom = () => {
  if (fileInput.value) {
    fileInput.value.value = "";
  }
  const fileInputElement = document.getElementById("csvFile");
  if (fileInputElement) {
    fileInputElement.value = "";
  }
};

onBeforeUnmount(() => {
  if (eventSource) eventSource.close();
});
</script>
