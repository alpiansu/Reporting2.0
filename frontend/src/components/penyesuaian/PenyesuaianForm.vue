<template>
  <RekonFormComponent :errors="errors" @submit="submitForm">
    <template #title>
      Rekonsiliasi Penyesuaian Toko
    </template>

    <template #description>
      Lihat hasil rekonsiliasi nilai penyesuaian toko
    </template>

    <template #cab>
      <Dropdown id="cab" v-model="formData.cab" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab"
        placeholder="Pilih Cabang" :disabled="isReconciling" class="w-full" @change="handleCabChange" />
    </template>

    <template #periode>
      <Calendar id="periode" v-model="selectedDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun"
        :disabled="isReconciling" :maxDate="today" showIcon class="w-full" @date-select="updatePeriode" />
    </template>

    <template #actions>
      <Button type="button" :label="isReconciling ? `Please Wait...` : `Mulai Screening`" icon="pi pi-refresh"
        class="p-button-primary" @click="startReconciliation" :loading="isReconciling" :disabled="isReconciling" />
    </template>
  </RekonFormComponent>

  <!-- card info last screening -->
  <LastScanInfo moduleName="penyesuaian" :selectedCabang="formData.cab" v-if="!isReconciling" />

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
import { penyesuaianService } from '../../services';
import ProgressBar from "../../components/common/ProgressBar.vue";
import RekonFormComponent from "../../components/common/RekonFormComponent.vue";
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
      periode: formData.periode
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

<style scoped>
.card {
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.rekon-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

/* PrimeVue components styling */
:deep(.p-dropdown) {
  width: 100%;
}

:deep(.p-calendar) {
  width: 100%;
}

:deep(.p-button) {
  width: auto;
}

.help-text {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  border: none;
  gap: 0.5rem;
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-color-darken);
}

.btn-primary:disabled {
  background-color: #b0bec5;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .rekon-form {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .form-group {
    flex: 1;
    min-width: 200px;
    margin-right: 1rem;
  }
  
  .form-actions {
    width: 100%;
  }
}
</style>
