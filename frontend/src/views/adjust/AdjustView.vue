<template>
  <div class="adjust-view">
    <PageHeader
      title="Upload Adjustment CSV"
      subtitle="Proses penyesuaian item BJD melalui file CSV"
      description="Upload file CSV dengan format KDTK, PRDCD, dan QTY_ADJ untuk memproses penyesuaian item BJD di toko-toko yang ditentukan."
    />

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
              <DownloadButton
                variant="primary"
                size="medium"
                text="Download"
                loading-text="Downloading..."
                icon="pi-download"
                tooltip="Download master CSV template"
                @download="handleDownloadTemplate"
              />
            </div>
          </div>
          
          <div class="format-preview">
            <div class="format-badge">
              <i class="pi pi-table"></i>
              <span>Format: KDTK, PRDCD, QTY_ADJ, KETER</span>
            </div>
            <button 
              class="format-details-toggle" 
              @click="showFormatDetails = !showFormatDetails"
              :class="{ 'active': showFormatDetails }"
            >
              <span>{{ showFormatDetails ? 'Sembunyikan' : 'Lihat' }} detail format</span>
              <i class="pi" :class="showFormatDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
          </div>
          
          <transition name="slide-fade">
            <div v-if="showFormatDetails" class="format-details-expanded">
              <div class="format-grid-compact">
                <div 
                  v-for="(field, index) in csvFields" 
                  :key="index"
                  class="format-item-compact"
                >
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
          
          <div class="file-input-section">
            <div class="drag-drop-area" 
                 :class="{ 'drag-over': isDragOver, 'has-file': selectedFile, 'disabled': isProcessing }"
                 @dragover.prevent="isDragOver = true"
                 @dragleave.prevent="isDragOver = false"
                 @drop.prevent="handleFileDrop"
                 @click="triggerFileInput"
            >
              <input
                ref="fileInput"
                type="file"
                class="hidden-file-input"
                id="csvFile"
                accept=".csv"
                @change="handleFileSelect"
                :disabled="isProcessing"
              />
              
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
                  <button 
                    class="change-file-btn"
                    @click.stop="resetForm"
                    :disabled="isProcessing"
                  >
                    <i class="pi pi-times"></i>
                    <span>Ganti</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="upload-actions" v-if="selectedFile">
            <div class="action-buttons">
              <button 
                class="process-btn"
                @click="handleUpload" 
                :disabled="!selectedFile || isProcessing"
                :class="{ 'processing': isProcessing }"
              >
                <i class="pi" :class="isProcessing ? 'pi-spin pi-spinner' : 'pi-cog'"></i>
                <span>{{ isProcessing ? 'Processing...' : 'Process File' }}</span>
              </button>
              <button 
                class="reset-btn"
                @click="resetForm" 
                :disabled="isProcessing"
              >
                <i class="pi pi-refresh"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>
          
          <div v-if="!selectedFile" class="upload-hint">
            <i class="pi pi-info-circle"></i>
            <span>Pastikan file CSV sesuai dengan format template yang telah didownload</span>
          </div>
        </div>
      </div>

      <!-- Results Card -->
      <div class="card mt-4" v-if="processResults">
        <div class="card-header">
          <h3 class="card-title">
            <i class="pi pi-list mr-2"></i>
            Hasil Proses
          </h3>
        </div>
        <div class="card-body">
          <!-- Summary -->
          <div class="result-summary mb-4">
            <div class="row">
              <div class="col-md-3">
                <div class="info-box">
                  <span class="info-box-icon bg-info">
                    <i class="pi pi-shopping-cart"></i>
                  </span>
                  <div class="info-box-content">
                    <span class="info-box-text">Total Toko</span>
                    <span class="info-box-number">{{ processResults?.totalStores || 0 }}</span>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="info-box">
                  <span class="info-box-icon bg-success">
                    <i class="pi pi-check-circle"></i>
                  </span>
                  <div class="info-box-content">
                    <span class="info-box-text">Sukses</span>
                    <span class="info-box-number">{{ processResults?.successStores || 0 }}</span>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="info-box">
                  <span class="info-box-icon bg-danger">
                    <i class="pi pi-times-circle"></i>
                  </span>
                  <div class="info-box-content">
                    <span class="info-box-text">Gagal</span>
                    <span class="info-box-number">{{ processResults?.failedStores?.length || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Results Table -->
          <div class="table-responsive">
            <table class="table table-bordered table-hover">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Status</th>
                  <th>Items Processed</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="result in processResults?.storeResults" :key="result.storeCode">
                  <td>{{ result.storeCode }}</td>
                  <td>
                    <span class="badge" :class="result.success ? 'badge-success' : 'badge-danger'">
                      {{ result.success ? "Success" : "Failed" }}
                    </span>
                  </td>
                  <td>{{ result.processed }}</td>
                  <td>
                    <span :class="result.error ? 'text-danger' : 'text-success'">
                      {{ result.error || "Processed successfully" }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import api from "../../services/api.js";
import adjustService from "../../services/adjust.service.js";
import PageHeader from "../../components/PageHeader.vue";
import DownloadButton from "../../components/common/DownloadButton.vue";
import "./AdjustView.style.css";

const toast = useToast();

// State
const selectedFile = ref(null);
const selectedFileName = ref("");
const isProcessing = ref(false);
const processResults = ref(null);
const showFormatDetails = ref(false);
const isDragOver = ref(false);
const fileInput = ref(null);

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
    description: 'Kode produk (13 digit barcode)',
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

// CSV notes for the info card
const csvNotes = [
  'File harus dalam format CSV dengan delimiter koma (,)',
  'Pastikan tidak ada header tambahan selain yang telah ditentukan',
  'QTY_ADJ merupakan nilai adjustment yang diberikan terhadap PRDCD',
  'KETER Sebaiknya di isi sesuai event yang sedang berlangsung',
  'Gunakan encoding UTF-8 untuk karakter khusus'
];

// Methods
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

    const formData = new FormData();
    formData.append("file", selectedFile.value);

    const response = await api.post("/adjust/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    // Extract the nested data structure
    const resultData = response.data.data.data;
    processResults.value = resultData;

    toast.add({
      severity: resultData.failedStores.length > 0 ? "warn" : "success",
      summary: resultData.failedStores.length > 0 ? "Completed with Issues" : "Success",
      detail: response.data.data.message, // Use the message from the correct level
      life: 5000,
    });
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
  const fileInputElement = document.getElementById("csvFile");
  if (fileInputElement) fileInputElement.value = "";
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
    const result = await adjustService.downloadTemplate();
    
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
</script>
