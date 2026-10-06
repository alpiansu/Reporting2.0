<template>
  <div class="rekon-filter-panel">
    <!-- Filter Controls Bar -->
    <div class="filter-main-bar">
      <!-- Cabang -->
      <div class="filter-item">
        <label for="cab" class="filter-label">
          <i class="pi pi-building"></i>
          <span>Cabang</span>
          <span class="required-star">*</span>
        </label>
        <Dropdown 
          id="cab" 
          v-model="formData.cab" 
          :options="cabangOptions" 
          optionLabel="namacab" 
          optionValue="kdcab"
          placeholder="Pilih Cabang" 
          :disabled="isReconciling" 
          class="filter-dropdown" 
          @change="handleCabChange" 
        />
        <small v-if="errors?.cab" class="filter-error-text">{{ errors.cab }}</small>
      </div>

      <!-- Periode -->
      <div class="filter-item">
        <label for="periode" class="filter-label">
          <i class="pi pi-calendar"></i>
          <span>Periode</span>
          <span class="required-star">*</span>
        </label>
        <Calendar 
          id="periode" 
          v-model="selectedDate" 
          view="month" 
          dateFormat="mm/yy" 
          placeholder="Pilih Bulan/Tahun"
          :disabled="isReconciling" 
          :maxDate="today" 
          showIcon 
          class="filter-calendar" 
          @date-select="updatePeriode" 
        />
        <small v-if="errors?.periode" class="filter-error-text">{{ errors.periode }}</small>
      </div>

      <!-- Action Button -->
      <div class="filter-item filter-item-action">
        <label class="filter-label filter-label-hidden">&nbsp;</label>
        <button 
          type="button" 
          class="btn-screening-primary"
          @click="startReconciliation" 
          :disabled="isReconciling"
          title="Mulai proses screening penyesuaian toko"
        >
          <i class="pi" :class="isReconciling ? 'pi-spin pi-spinner' : 'pi-refresh'"></i>
          <span>{{ isReconciling ? 'Memproses...' : 'Mulai Screening' }}</span>
        </button>
      </div>
    </div>

    <!-- Filter Options Footer Bar (Force Re-screen & Context Hint) -->
    <div class="filter-footer-bar">
      <div class="force-screen-toggle">
        <Checkbox 
          v-model="forceScreening" 
          inputId="forceScreeningPenyesuaian" 
          :binary="true" 
          :disabled="isReconciling" 
        />
        <label for="forceScreeningPenyesuaian" class="force-screen-label">
          <i class="pi pi-bolt"></i>
          <span class="force-title">Force Re-screen</span>
          <span class="force-desc">— Lewati cache log harian &amp; proses ulang seluruh data di cabang terpilih</span>
        </label>
      </div>
      <div class="filter-hint-text">
        <i class="pi pi-info-circle"></i>
        <span>Nilai penyesuaian diambil per H-1 tanggal screening</span>
      </div>
    </div>
  </div>

  <!-- Standalone Sleek Status Strip: LastScanInfo -->
  <div class="last-scan-wrapper" v-if="!isReconciling">
    <LastScanInfo moduleName="penyesuaian" :selectedCabang="formData.cab" />
  </div>

  <!-- Processing Loading State -->
  <ProgressBar v-if="isReconciling" :visible="isReconciling" :percentage="progress.percentage" :info="progress.info">
    <template #title>
      Processing Screening...
    </template>

    <template #subtitle>
      Connecting to stores and processing screening query.<br />
      Please wait patiently...
    </template>

    <template #details>
      <small>
        <strong>{{ progress.info }}</strong>
      </small>
    </template>
  </ProgressBar>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useToastService } from '../../utils/toast';
import { useCabangStore, useAuthStore } from '../../stores';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Checkbox from 'primevue/checkbox';
import { penyesuaianService } from '../../services';
import ProgressBar from "../../components/common/ProgressBar.vue";
import progressService from "../../services/progress.service.js";
import api from "../../services/api.js";
import LastScanInfo from '@/components/common/LastScanInfo.vue';

const toast = useToastService();
const loading = ref(false);
const errors = reactive({});
const cabangOptions = ref([]);
const selectedDate = ref(null);
const today = ref(new Date());
const isReconciling = ref(false);
const forceScreening = ref(false);
const progress = ref({
  percentage: 0,
  info: "",
  status: "idle",
});
let eventSource = null;
const authStore = useAuthStore();
const strUsername = authStore.user.username;

const formData = reactive({
  cab: '',
  periode: ''
});

const cabangStore = useCabangStore();

// Watch untuk isReconciling - mulai/hentikan progress tracking
watch(isReconciling, (newVal) => {
  if (newVal) {
    // Mulai progress tracking ketika processing dimulai
    startProgressTracking();
  } else {
    // Hentikan progress tracking ketika processing selesai
    stopProgressTracking();
  }
});

//method to start progress tracking progress
const startProgressTracking = async () => {

  const taskId = `penyesuaianTask_${strUsername}`; // Sesuai dengan config.taskProgressName di backend

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
        if (isReconciling.value) {
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
      isReconciling.value = false;

      toast.showError({
        severity: "error",
        summary: "Progress Error",
        detail: errorData.description || "Progress monitoring failed",
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
      isReconciling.value = false;
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

// Fetch cabang data on component mount
onMounted(async () => {
  try {
    loading.value = true;
    
    const cabangData = cabangStore.allCabang;
    
    // Add 'SEMUA CABANG' option at the beginning
    cabangOptions.value = [
      { kdcab: 'All', namacab: 'SEMUA CABANG' },
      ...cabangData
    ];
    
    // Set default to 'SEMUA'
    formData.cab = 'All';
    
    // Set default periode to current month
    const now = new Date();
    selectedDate.value = now;
    updatePeriode();
    
    // Emit view-results event with default values
    if (formData.periode) {
      emitViewResults();
    }
  } catch (error) {
    toast.showError('Error', 'Gagal memuat data cabang');
  } finally {
    loading.value = false;
  }
});

// Convert selected date to YYMM format
const updatePeriode = () => {
  if (selectedDate.value) {
    const year = selectedDate.value.getFullYear().toString().slice(-2);
    const month = (selectedDate.value.getMonth() + 1).toString().padStart(2, '0');
    formData.periode = year + month;
    
    // Automatically emit view-results when periode changes
    if (formData.periode) {
      emitViewResults();
    }
  }
};

const validateForm = () => {
  errors.cab = '';
  errors.periode = '';
  
  let isValid = true;
  
  // Validate cab
  if (!formData.cab) {
    errors.cab = 'Cabang harus dipilih';
    isValid = false;
  }
  
  // Validate periode
  if (!formData.periode) {
    errors.periode = 'Periode harus dipilih';
    isValid = false;
  }
  
  return isValid;
};

const submitForm = async () => {
  if (!validateForm()) return;
  
  loading.value = true;
  
  try {
    // Emit event to parent component to load results
    emitViewResults();
    
    toast.showInfo('Info', 'Mencari data rekonsiliasi...', 3000);
  } catch (error) {
    toast.showError('Error', 'Terjadi kesalahan saat memuat data', 3000);
  } finally {
    loading.value = false;
  }
};

// Helper function to emit view-results event
const emitViewResults = () => {
  // Jika cabang adalah 'SEMUA', kirim string kosong sebagai parameter cab
  const cabParam = formData.cab === 'SEMUA' ? '' : formData.cab;
  
  // Pastikan periode tidak kosong sebelum emit event
  if (formData.periode) {
    emit('view-results', {
      cab: cabParam,
      periode: formData.periode
    });
  }
};

// Handler untuk perubahan cabang
const handleCabChange = () => {
  // Pastikan periode sudah ada sebelum emit event
  if (formData.periode) {
    // Berikan sedikit delay untuk memastikan komponen sudah terupdate
    setTimeout(() => {
      emitViewResults();
    }, 50);
  }
};

// Define emits
const emit = defineEmits(['view-results']);

// Function to start reconciliation process
const startReconciliation = async () => {
  if (!validateForm()) return;
  
  try {
    isReconciling.value = true;
    
    toast.showInfo('Info', 'Memulai proses rekonsiliasi...', 2000);
    
    // Call API to start reconciliation
    await penyesuaianService.startScreening({
      cab: formData.cab,
      periode: formData.periode,
      force: forceScreening.value
    });
    
    toast.showSuccess('Sukses', 'Proses rekonsiliasi selesai');
    
    // Refresh results after reconciliation
    emitViewResults();
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Terjadi kesalahan saat memulai rekonsiliasi';
    toast.showError('Error', errorMessage);
  } finally {
    isReconciling.value = false;
  }
};
</script>

<style scoped src="./PenyesuaianForm.style.css"></style>
