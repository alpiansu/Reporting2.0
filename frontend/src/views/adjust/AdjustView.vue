<template>
  <div class="adjust-view">
    <PageHeader
      title="Upload Adjustment CSV"
      subtitle="Proses penyesuaian item BJD melalui file CSV"
      description="Upload file CSV dengan format KDTK, PRDCD, dan QTY_ADJ untuk memproses penyesuaian item BJD di toko-toko yang ditentukan."
    />

    <div class="content-container">
      <!-- Upload Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <i class="pi pi-file-import mr-2"></i>
            Upload File
          </h3>
        </div>
        <div class="card-body">
          <div class="upload-section">
            <div class="form-group">
              <label for="csvFile">Pilih file CSV:</label>
              <div class="custom-file">
                <input
                  type="file"
                  class="custom-file-input"
                  id="csvFile"
                  accept=".csv"
                  @change="handleFileSelect"
                  :disabled="isProcessing"
                />
                <label class="custom-file-label" for="csvFile">
                  {{ selectedFileName || "Pilih file..." }}
                </label>
              </div>
              <small class="form-text text-muted"> Format: KDTK, PRDCD, QTY_ADJ </small>
            </div>

            <div class="mt-4">
              <div v-if="!selectedFile" class="alert alert-info mb-3">
                <i class="pi pi-info-circle mr-2"></i>&nbsp;
                Silakan pilih file CSV terlebih dahulu untuk melakukan proses upload
              </div>
              <div class="button-container">
                <button 
                  class="btn btn-primary" 
                  @click="handleUpload" 
                  :disabled="!selectedFile || isProcessing"
                  :class="{'btn-disabled': !selectedFile || isProcessing}"
                >
                  <i class="pi pi-upload mr-2"></i>
                  {{ isProcessing ? "Processing..." : "Upload & Process" }}
                </button>
                <button 
                  class="btn btn-secondary" 
                  @click="resetForm" 
                  :disabled="!selectedFile || isProcessing"
                  :class="{'btn-disabled': !selectedFile || isProcessing}"
                >
                  <i class="pi pi-refresh mr-2"></i>
                  Reset
                </button>
              </div>
            </div>
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
import PageTitle from "../../components/PageTitle.vue";
import "./AdjustView.style.css";

const toast = useToast();

// State
const selectedFile = ref(null);
const selectedFileName = ref("");
const isProcessing = ref(false);
const processResults = ref(null);

// Methods
const handleFileSelect = event => {
  const file = event.target.files[0];
  if (file) {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Please select a CSV file",
        life: 3000,
      });
      resetForm();
      return;
    }
    selectedFile.value = file;
    selectedFileName.value = file.name;
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

    processResults.value = response.data.data;

    toast.add({
      severity: response.data.data.failedStores.length > 0 ? "warn" : "success",
      summary: response.data.data.failedStores.length > 0 ? "Completed with Issues" : "Success",
      detail: response.data.message,
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
  const fileInput = document.getElementById("csvFile");
  if (fileInput) fileInput.value = "";
};
</script>
