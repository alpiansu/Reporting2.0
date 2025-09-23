<template>
  <div class="prep-closing-form-container">
    <div class="card">
      <h2 class="form-title">Screening Persiapan Closing</h2>
      <p class="form-description">
        Jalankan proses screening untuk mempersiapkan closing periode.
      </p>

      <form @submit.prevent="submitForm" class="prep-closing-form">
        <div class="form-group">
          <label for="cab">Cabang</label>
          <Dropdown 
            id="cab" 
            v-model="formData.cab" 
            :options="cabangOptions" 
            optionLabel="namacab" 
            optionValue="kdcab"
            placeholder="Pilih Cabang" 
            :disabled="loading || isScreeningActive"
            class="w-full"
            @change="handleCabChange"
          />
          <small v-if="errors.cab" class="error-text">{{ errors.cab }}</small>
        </div>

        <div class="form-group">
          <label for="periode">Periode</label>
          <Calendar 
            id="periode" 
            v-model="selectedDate" 
            view="month" 
            dateFormat="mm/yy" 
            placeholder="Pilih Bulan/Tahun"
            :disabled="loading || isScreeningActive"
            :maxDate="today"
            showIcon
            class="w-full"
            @date-select="updatePeriode"
          />
          <small v-if="errors.periode" class="error-text">{{ errors.periode }}</small>
        </div>

        <div class="form-actions">
          <Button 
            type="submit"
            label="Mulai Screening" 
            icon="pi pi-search" 
            class="p-button-primary" 
            :loading="isScreening"
            :disabled="loading || isScreeningActive"
          />
        </div>
      </form>

      <!-- Progress Bar Component -->
      <ProgressBar 
        :visible="showProgressBar"
        :title="progressTitle"
        :status="progressStatus"
        :processed="processedItems"
        :total="totalItems"
        :differences="totalDifferences"
        :timeElapsed="timeElapsed"
        :message="progressMessage"
        :percentage="progressPercentage"
        :currentWave="currentWave"
        :maxWaves="maxWaves"
        :currentBranch="currentBranch"
        :currentItem="currentItem"
        @close="hideProgressBar"
      />
      
      <!-- Confirmation Dialog -->
      <ConfirmDialog
        v-model="showConfirmDialog"
        :title="confirmDialogTitle"
        :message="confirmDialogMessage"
        :confirm-text="confirmDialogConfirmText"
        :cancel-text="confirmDialogCancelText"
        @confirm="handleConfirmDialogConfirm"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useToastService } from '../../utils/toast';
import { useCabangStore } from '../../stores';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import ProgressBar from './ProgressBar.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { prepClosingService } from '../../services';

const emit = defineEmits(['view-results', 'start-screening', 'screening-started', 'screening-completed', 'screening-error']);

const toast = useToastService();
const loading = ref(false);
const errors = reactive({});
const cabangOptions = ref([]);

// Progress tracking variables
const isScreening = ref(false);
const showProgressBar = ref(false);
const progressStatus = ref('pending');
const processedItems = ref(0);
const totalItems = ref(0);
const totalDifferences = ref(0);
const timeElapsed = ref(0);
const progressMessage = ref('');
const progressId = ref('');
const progressTimer = ref(null);
const eventSource = ref(null);
const currentWave = ref(1);
const maxWaves = ref(1);
const currentBranch = ref('');
const currentItem = ref('');
const progressPercentage = ref(0);
const progressTitle = ref('Proses Screening Persiapan Closing');

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

const selectedDate = ref(null);
const today = ref(new Date());
const isScreeningActive = ref(false);

// Handle cabang change
 const handleCabChange = async () => {
   // Clear errors when cabang changes
   delete errors.cab;
   
   // Emit view-results when cabang changes if periode is available
   if (formData.periode) {
     // Use nextTick to ensure reactive updates are complete
     await nextTick();
     emitViewResults();
   }
 };

// Update periode when date is selected
 const updatePeriode = async () => {
   if (selectedDate.value) {
     const year = selectedDate.value.getFullYear().toString().slice(-2);
     const month = (selectedDate.value.getMonth() + 1).toString().padStart(2, '0');
     formData.periode = year + month;
     delete errors.periode;
     
     // Use nextTick to ensure reactive updates are complete
     await nextTick();
     
     // Automatically emit view-results when periode changes
     if (formData.periode) {
       emitViewResults();
     }
   }
 };

const cabangStore = useCabangStore();

// Load cabang options
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
    
    // Check for existing screening process
    await checkExistingScreening();
    
    // Use nextTick to ensure component is fully mounted before emitting
    await nextTick();
    
    // Emit view-results event with default values
    if (formData.periode) {
      console.log('PrepClosingForm onMounted: emitting view-results with periode:', formData.periode);
      emitViewResults();
    }
  } catch (error) {
    console.error('Error loading cabang:', error);
    toast.showError('Error', 'Gagal memuat data cabang');
  } finally {
    loading.value = false;
  }
});

// Validate form
const validateForm = () => {
  const newErrors = {};

  if (!formData.cab) {
    newErrors.cab = 'Cabang harus dipilih';
  }

  if (!formData.periode) {
    newErrors.periode = 'Periode harus dipilih';
  }

  Object.assign(errors, newErrors);
  return Object.keys(newErrors).length === 0;
};

// Submit form
const submitForm = async () => {
  if (!validateForm()) {
    return;
  }

  await startScreening();
};

// Start screening process
const startScreening = async () => {
  try {
    isScreening.value = true;
    isScreeningActive.value = true;
    progressStatus.value = 'starting';
    progressMessage.value = 'Memulai proses screening...';

    const year = formData.periode.substring(0, 4);
    const month = formData.periode.substring(4, 6);

    const response = await prepClosingService.startScreening(
      formData.cab,
      month,
      year
    );

    if (response.data.success) {
      progressId.value = response.data.progressId;
      totalItems.value = response.data.totalStores || response.data.totalBranches || 0;
      
      // Connect to SSE for real-time updates
      connectToSSE();
      
      // Show progress bar
      showProgressBar.value = true;
      startProgressTimer();
      
      toast.showSuccess('Sukses', 'Proses screening dimulai');
    } else {
      throw new Error('Tidak dapat memulai screening');
    }
  } catch (error) {
    console.error('Error starting screening:', error);
    progressStatus.value = 'error';
    
    // Handle case where another screening process is already running (409 Conflict)
    if (error.response && error.response.status === 409) {
      const activeProcess = error.response.data;
      
      // Show more detailed error message
      progressMessage.value = `Proses screening untuk cabang ${formData.cab} periode ${formData.year}${formData.month} sedang berjalan.`;
      
      // Ask user if they want to view the running process
      confirmDialogTitle.value = 'Proses Screening Sedang Berjalan';
      confirmDialogMessage.value = `${progressMessage.value} Apakah Anda ingin melihat progress yang sedang berjalan?`;
      confirmDialogCallback.value = () => {
        if (activeProcess.progressId) {
          progressId.value = activeProcess.progressId;
          connectToSSE();
          showProgressBar.value = true;
          startProgressTimer();
        }
      };
      showConfirmDialog.value = true;
    } else {
      toast.showError('Error', error.response?.data?.message || 'Terjadi kesalahan saat memulai screening');
    }
  } finally {
    isScreening.value = false;
  }
};

// Connect to SSE for real-time progress updates
const connectToSSE = () => {
  if (!progressId.value) return;

  // Close existing connection if any
  if (eventSource.value) {
    eventSource.value.close();
  }

  eventSource.value = prepClosingService.connectToProgressStream(
    progressId.value,
    handleSSEMessage,
    handleSSEError,
    handleSSEOpen
  );
};

// Handle SSE open event
const handleSSEOpen = () => {
  console.log('SSE connection opened');
  progressStatus.value = 'running';
};

// Handle SSE error
const handleSSEError = (error) => {
  console.error('SSE error:', error);
  toast.showError('Error', 'Koneksi progress terputus');
};

// Handle SSE message
const handleSSEMessage = (data) => {
  console.log('SSE message received:', data);

  if (data.type === 'progress') {
    const progressData = data.data;
    
    // Update progress information
    processedItems.value = progressData.processed || 0;
    totalItems.value = progressData.total || totalItems.value;
    progressStatus.value = progressData.status || 'running';
    progressMessage.value = progressData.message || '';
    
    // Update wave information
    if (progressData.currentWave !== undefined) {
      currentWave.value = progressData.currentWave;
    }
    if (progressData.maxWaves !== undefined) {
      maxWaves.value = progressData.maxWaves;
    }
    
    // Update current branch and item
    if (progressData.currentBranch) {
      currentBranch.value = progressData.currentBranch;
    }
    if (progressData.currentItem) {
      currentItem.value = progressData.currentItem;
    }
    
    // Update progress percentage
    progressPercentage.value = progressData.percentage !== undefined ? progressData.percentage : 
      (totalItems.value > 0 ? Math.round((processedItems.value / totalItems.value) * 100) : 0);
    
    // If screening is complete, stop tracking
    if (progressData.status === 'completed' || progressData.status === 'failed' || progressData.status === 'error') {
      stopProgressTracking();
      
      if (progressData.status === 'completed') {
        toast.showSuccess('Sukses', 'Screening selesai');
        // Emit event to refresh results
        emitStartScreening();
      } else {
        toast.showError('Error', progressData.message || 'Terjadi kesalahan saat screening');
      }
    }
  } else if (data.type === 'connected') {
    console.log('Connected to progress updates');
  } else if (data.type === 'error') {
    console.error('SSE error:', data.message);
    toast.showError('Error', data.message || 'Terjadi kesalahan pada koneksi progress');
  }
};

// Start timer for tracking elapsed time
const startProgressTimer = () => {
  // Clear existing timer if any
  if (progressTimer.value) {
    clearInterval(progressTimer.value);
  }
  
  // Reset elapsed time
  timeElapsed.value = 0;
  
  // Start new timer
  progressTimer.value = setInterval(() => {
    timeElapsed.value++;
  }, 1000);
};

// Stop progress tracking
const stopProgressTracking = () => {
  isScreening.value = false;
  isScreeningActive.value = false;
  
  // Stop timer
  if (progressTimer.value) {
    clearInterval(progressTimer.value);
    progressTimer.value = null;
  }
  
  // Close SSE connection
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
  }
};

// Hide progress bar
const hideProgressBar = () => {
  showProgressBar.value = false;
};

// Handle confirm dialog confirmation
const handleConfirmDialogConfirm = () => {
  if (confirmDialogCallback.value) {
    confirmDialogCallback.value();
  }
  showConfirmDialog.value = false;
};

// Helper function to emit view-results event
const emitViewResults = () => {
  // Validate formData before emitting
  if (!formData || typeof formData !== 'object') {
    console.warn('Invalid formData in emitViewResults:', formData);
    return;
  }
  
  // Jika cabang adalah 'All', kirim string kosong sebagai parameter cab
  const cabParam = formData.cab === 'All' ? '' : (formData.cab || '');
  
  // Pastikan periode tidak kosong sebelum emit event
  if (formData.periode) {
    const eventData = {
      cab: cabParam,
      periode: formData.periode
    };
    
    console.log('Emitting view-results with data:', eventData);
    emit('view-results', eventData);
  } else {
    console.warn('Cannot emit view-results: periode is empty');
  }
};

// Emit start screening event
const emitStartScreening = () => {
  emit('screening-started', {
    cab: formData.cab,
    periode: formData.periode
  });
};

// Check for existing screening process
const checkExistingScreening = async () => {
  if (!formData.cab || !formData.periode) {
    return false;
  }

  try {
    const response = await prepClosingService.getLatestProgress(formData.cab, formData.periode);
    
    if (response.data.success && response.data.data) {
      const progressData = response.data.data;
      
      // Check if there's an active screening process
      if (progressData.status === 'running' || progressData.status === 'starting') {
        progressId.value = progressData.id;
        processedItems.value = progressData.processed || 0;
        totalItems.value = progressData.total || 0;
        progressStatus.value = progressData.status;
        progressMessage.value = progressData.message || 'Proses screening sedang berjalan...';
        
        // Show progress bar and connect to SSE
        isScreening.value = true;
        showProgressBar.value = true;
        startProgressTimer();
        connectToSSE();
        
        toast.showInfo('Info', 'Proses screening sedang berjalan. Anda dapat melihat progress yang sedang berlangsung.');
        
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking existing screening:', error);
    return false;
  }
};

// Clean up on component unmount
onBeforeUnmount(() => {
  stopProgressTracking();
});
</script>

<style scoped>
.prep-closing-form-container {
  margin-bottom: 0;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.prep-closing-form {
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
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
  .prep-closing-form {
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