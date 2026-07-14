<template>
  <div class="rekon-form-container">
    <div class="card">
      <h2 class="form-title">Hasil Rekonsiliasi WT Harian</h2>
      <p class="form-description">
        Lihat hasil rekonsiliasi data transaksi antara WRC dan toko per toko.
      </p>

      <form @submit.prevent="submitForm" class="rekon-form">
        <div class="form-group">
          <label for="cab">Cabang</label>
          <Dropdown id="cab" v-model="formData.cab" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab"
            placeholder="Pilih Cabang" :disabled="loading" class="w-full" @change="handleCabChange" />
          <small v-if="errors.cab" class="error-text">{{ errors.cab }}</small>
        </div>

        <div class="form-group">
          <label for="periode">Periode</label>
          <Calendar id="periode" v-model="selectedDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun"
            :disabled="loading" :maxDate="today" showIcon class="w-full" @date-select="updatePeriode" />
          <small v-if="errors.periode" class="error-text">{{ errors.periode }}</small>
        </div>

        <div class="form-actions">
          <div class="force-toggle">
            <Checkbox v-model="forceReScreen" inputId="forceReScreenWtHarian" :binary="true"
              :disabled="isReconciling" />
            <label for="forceReScreenWtHarian" class="ml-2 text-sm text-color-secondary">
              <i class="pi pi-exclamation-triangle mr-1" style="font-size: 0.85rem"></i>
              Force Re-screen (ulang meskipun sudah sukses hari ini)
            </label>
          </div>
          <Button type="button" label="Mulai Rekonsiliasi" icon="pi pi-refresh" class="p-button-primary"
            @click="startReconciliation" :loading="isReconciling" :disabled="loading" />
        </div>
      </form>

      <!-- card info last screening -->
      <LastScanInfo moduleName="rekon_wt_harian" :selectedCabang="formData.cab" v-if="!isReconciling"
        style="margin-top: 15px;" />

      <!-- Progress Bar Component -->
      <ProgressBar :visible="showProgressBar" :title="progressTitle" :status="progressStatus"
        :processed="processedItems" :total="totalItems" :differences="totalDifferences" :timeElapsed="timeElapsed"
        :message="progressMessage" :percentage="progressPercentage"
        :currentBranch="currentBranch" @close="hideProgressBar" />

      <!-- Confirmation Dialog -->
      <ConfirmDialog v-model="showConfirmDialog" :title="confirmDialogTitle" :message="confirmDialogMessage"
        :confirm-text="confirmDialogConfirmText" :cancel-text="confirmDialogCancelText"
        @confirm="handleConfirmDialogConfirm" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useToastService } from '../../utils/toast';
import { useCabangStore } from '../../stores';
import { useProgress } from '../../composables/useProgress';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import ProgressBar from './ProgressBar.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import rekonWtHarianService from '../../services/rekonWtHarian.service';
import LastScanInfo from "@/components/common/LastScanInfo.vue";

const toast = useToastService();
const loading = ref(false);
const errors = reactive({});
const cabangOptions = ref([]);
const selectedDate = ref(null);
const today = ref(new Date());

// Progress tracking via useProgress composable
const {
  progress,
  percentage: progressPercentage,
  isMonitoring,
  isCompleted,
  isFailed,
  isVisible: isProgressVisible,
  startMonitoring,
  stopMonitoring,
} = useProgress();

const isReconciling = ref(false);
const showProgressBar = ref(false);
const processedItems = ref(0);
const totalItems = ref(0);
const totalDifferences = ref(0);
const timeElapsed = ref(0);
const progressMessage = ref('');
const progressTimer = ref(null);
const currentBranch = ref('');
const progressTitle = ref('Proses Rekonsiliasi WT Harian');
const progressStatus = computed(() => progress.value?.status || 'pending');

// Confirm dialog variables
const showConfirmDialog = ref(false);
const confirmDialogTitle = ref('');
const confirmDialogMessage = ref('');
const confirmDialogConfirmText = ref('Ya');
const confirmDialogCancelText = ref('Tidak');
const confirmDialogCallback = ref(null);

const formData = reactive({
  cab: '',
  periode: ''
});
const forceReScreen = ref(false);

const cabangStore = useCabangStore();

onMounted(async () => {
  try {
    loading.value = true;
    
    const cabangData = cabangStore.allCabang;
    cabangOptions.value = [
      { kdcab: 'All', namacab: 'SEMUA CABANG' },
      ...cabangData
    ];
    
    formData.cab = 'All';
    
    const now = new Date();
    selectedDate.value = now;
    updatePeriode();
    
    await checkExistingReconciliation();
    
    if (formData.periode) {
      emitViewResults();
    }
  } catch (error) {
    toast.showError('Error', 'Gagal memuat data cabang');
  } finally {
    loading.value = false;
  }
});

const updatePeriode = () => {
  if (selectedDate.value) {
    const year = selectedDate.value.getFullYear().toString().slice(-2);
    const month = (selectedDate.value.getMonth() + 1).toString().padStart(2, '0');
    formData.periode = year + month;
    
    if (formData.periode) {
      emitViewResults();
    }
  }
};

const validateForm = () => {
  errors.cab = '';
  errors.periode = '';
  
  let isValid = true;
  
  if (!formData.cab) {
    errors.cab = 'Cabang harus dipilih';
    isValid = false;
  }
  
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
    emitViewResults();
    toast.showInfo('Info', 'Mencari data rekonsiliasi...', 3000);
  } catch (error) {
    toast.showError('Error', 'Terjadi kesalahan saat memuat data', 3000);
  } finally {
    loading.value = false;
  }
};

const emitViewResults = () => {
  const cabParam = formData.cab === 'SEMUA' ? '' : formData.cab;
  
  if (formData.periode) {
    emit('view-results', {
      cab: cabParam,
      periode: formData.periode
    });
  }
};

const handleCabChange = () => {
  if (formData.periode) {
    setTimeout(() => {
      emitViewResults();
    }, 50);
  }
};

const emit = defineEmits(['view-results']);

// Map progress data to local state for ProgressBar component
const syncProgressFromData = (progressData) => {
  if (!progressData) return;

  const info = progressData.info || {};

  processedItems.value = progressData.current || 0;
  totalItems.value = progressData.total || 0;
  totalDifferences.value = info.totalDifferences || info.storesWithDifferences || 0;
  currentBranch.value = info.cab || info.currentBranch || '';
  progressMessage.value = progressData.description || progressData.message || '';

  if (currentBranch.value && currentBranch.value !== 'All') {
    const cabangText = `Cabang ${currentBranch.value}`;
    const periodeText = formData.periode ? `Periode ${formData.periode}` : '';
    progressTitle.value = `Rekonsiliasi WT Harian - ${cabangText} ${periodeText}`.trim();
  }
};

// Watch for progress changes from useProgress composable
watch(progress, (newProgress) => {
  if (!newProgress || !isReconciling.value) return;

  syncProgressFromData(newProgress);

  if (isCompleted.value) {
    stopProgressTracking();
    toast.showSuccess('Sukses', 'Rekonsiliasi selesai');
    emitViewResults();
  } else if (isFailed.value) {
    stopProgressTracking();
    toast.showError('Error', newProgress.description || 'Terjadi kesalahan saat rekonsiliasi');
  }
}, { deep: true });

const startReconciliation = async () => {
  if (!validateForm()) return;
  
  await checkExistingReconciliation();
  
  if (isReconciling.value) {
    toast.showWarning('Perhatian', 'Proses rekonsiliasi sedang berjalan. Harap tunggu hingga selesai.');
    return;
  }
  
  try {
    isReconciling.value = true;
    showProgressBar.value = true;
    processedItems.value = 0;
    totalItems.value = 0;
    totalDifferences.value = 0;
    timeElapsed.value = 0;
    progressMessage.value = 'Memulai proses rekonsiliasi...';
    
    const cabangText = formData.cab === 'All' ? 'Semua Cabang' : `Cabang ${formData.cab}`;
    const periodeText = formData.periode ? `Periode ${formData.periode}` : '';
    progressTitle.value = `Rekonsiliasi WT Harian - ${cabangText} ${periodeText}`.trim();
    
    startProgressTimer();
    
    const response = await rekonWtHarianService.startReconciliation({
      cab: formData.cab,
      periode: formData.periode,
      force: forceReScreen.value ? "true" : undefined
    });
    
    if (response.data && response.data.taskId) {
      const taskId = response.data.taskId;
      totalItems.value = response.data.totalStores || response.data.totalBranches || 0;
      
      await startMonitoring(taskId, {
        onUpdate: (data) => syncProgressFromData(data),
        onComplete: () => {
          stopProgressTracking();
          toast.showSuccess('Sukses', 'Rekonsiliasi selesai');
          emitViewResults();
        },
        onError: (err) => {
          stopProgressTracking();
          toast.showError('Error', err.description || 'Terjadi kesalahan saat rekonsiliasi');
        },
      });
      
      toast.showSuccess('Sukses', 'Proses rekonsiliasi dimulai');
    } else {
      throw new Error('Tidak dapat memulai rekonsiliasi');
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      const activeProcess = error.response.data.activeProcess;
      
      const activeCab = activeProcess.info?.cab || activeProcess.cab || 'Unknown';
      const activePeriode = activeProcess.info?.period || activeProcess.periode || 'Unknown';
      
      progressMessage.value = `Proses rekonsiliasi untuk ${activeCab === 'All' ? 'semua cabang' : `cabang ${activeCab}`} periode ${activePeriode} sedang berjalan.`;
      
      if (activeProcess && activeProcess.id) {
        confirmDialogTitle.value = 'Proses Rekonsiliasi Sedang Berjalan';
        confirmDialogMessage.value = `${progressMessage.value}\n\nApakah Anda ingin melihat progress proses yang sedang berjalan?`;
        confirmDialogConfirmText.value = 'Ya, Lihat Progress';
        confirmDialogCancelText.value = 'Tidak';
        
        confirmDialogCallback.value = async () => {
          totalItems.value = activeProcess.total || activeProcess.totalItems || 0;
          
          await startMonitoring(activeProcess.id, {
            onUpdate: (data) => syncProgressFromData(data),
            onComplete: () => {
              stopProgressTracking();
              toast.showSuccess('Sukses', 'Rekonsiliasi selesai');
              emitViewResults();
            },
            onError: (err) => {
              stopProgressTracking();
              toast.showError('Error', err.description || 'Terjadi kesalahan saat rekonsiliasi');
            },
          });
          
          toast.showInfo('Info', 'Menampilkan progress proses yang sedang berjalan');
        };
        
        showConfirmDialog.value = true;
        return;
      }
      
      toast.showWarning('Perhatian', error.response.data.message || 'Proses rekonsiliasi sedang berjalan');
    } else {
      progressMessage.value = `Error: ${error.message || 'Terjadi kesalahan saat memulai rekonsiliasi'}`;
      toast.showError('Error', error.message || 'Terjadi kesalahan saat memulai rekonsiliasi');
    }
    
    stopProgressTracking();
  }
};

const startProgressTimer = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value);
  }
  
  timeElapsed.value = 0;
  
  progressTimer.value = setInterval(() => {
    timeElapsed.value++;
  }, 1000);
};

const stopProgressTracking = () => {
  isReconciling.value = false;
  
  if (progressTimer.value) {
    clearInterval(progressTimer.value);
    progressTimer.value = null;
  }
  
  stopMonitoring();
};

const hideProgressBar = () => {
  showProgressBar.value = false;
};

const handleConfirmDialogConfirm = () => {
  if (confirmDialogCallback.value) {
    confirmDialogCallback.value();
    confirmDialogCallback.value = null;
  }
};

const checkExistingReconciliation = async () => {
  try {
    if (!formData.cab || !formData.periode) {
      return false;
    }
    
    const response = await rekonWtHarianService.getLatestProgress(
      formData.cab || 'All',
      formData.periode || ''
    );
    
    if (response.data && response.data.success && response.data.data) {
      const taskData = response.data.data;
      const status = taskData.status;
      
      if (status === 'running' || status === 'pending') {
        totalItems.value = taskData.total || 0;
        
        const info = taskData.info || {};
        const cabangText = info.cab === 'All' ? 'Semua Cabang' : `Cabang ${info.cab || formData.cab}`;
        const periodeText = formData.periode ? `Periode ${formData.periode}` : '';
        progressTitle.value = `Rekonsiliasi WT Harian - ${cabangText} ${periodeText}`.trim();
        
        currentBranch.value = info.cab || formData.cab;
        totalDifferences.value = info.totalDifferences || 0;
        progressMessage.value = taskData.description || 'Rekonsiliasi sedang berjalan...';
        
        isReconciling.value = true;
        showProgressBar.value = true;
        startProgressTimer();
        
        if (taskData.id) {
          await startMonitoring(taskData.id, {
            onUpdate: (data) => syncProgressFromData(data),
            onComplete: () => {
              stopProgressTracking();
              toast.showSuccess('Sukses', 'Rekonsiliasi selesai');
              emitViewResults();
            },
            onError: (err) => {
              stopProgressTracking();
              toast.showError('Error', err.description || 'Terjadi kesalahan saat rekonsiliasi');
            },
          });
        }
        
        toast.showInfo('Info', 'Proses rekonsiliasi sedang berjalan. Anda dapat melihat progress rekonsiliasi yang sedang berlangsung.');
        
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

onBeforeUnmount(() => {
  stopProgressTracking();
});
</script>

<style scoped>
.rekon-form-container {
  margin-bottom: 0;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.force-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.force-toggle label {
  cursor: pointer;
  user-select: none;
}

.form-title {
  font-size: 1.5rem;
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--primary-color);
}

.form-description {
  color: #666;
  margin-bottom: 1.5rem;
}

.rekon-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
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

.error-text {
  color: #e74c3c;
  font-size: 0.875rem;
  margin-top: 0.25rem;
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