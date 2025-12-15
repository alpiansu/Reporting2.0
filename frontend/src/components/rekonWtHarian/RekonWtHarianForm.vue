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
        :message="progressMessage" :percentage="progressPercentage" :currentWave="currentWave" :maxWaves="maxWaves"
        :currentBranch="currentBranch" :currentItem="currentItem" @close="hideProgressBar" />

      <!-- Confirmation Dialog -->
      <ConfirmDialog v-model="showConfirmDialog" :title="confirmDialogTitle" :message="confirmDialogMessage"
        :confirm-text="confirmDialogConfirmText" :cancel-text="confirmDialogCancelText"
        @confirm="handleConfirmDialogConfirm" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useToastService } from '../../utils/toast';
import { useCabangStore } from '../../stores';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
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
const today = ref(new Date()); // Tanggal hari ini sebagai batas maksimal calendar

// Progress tracking variables
const isReconciling = ref(false);
const showProgressBar = ref(false);
const progressStatus = ref('pending');
const processedItems = ref(0);
const totalItems = ref(0);
const totalDifferences = ref(0);
const timeElapsed = ref(0);
const progressMessage = ref('');
const progressId = ref('');
const progressTimer = ref(null);
const webSocket = ref(null);
const currentWave = ref(1);
const maxWaves = ref(1);
const currentBranch = ref('');
const currentItem = ref('');
const progressPercentage = ref(0);
const progressTitle = ref('Proses Rekonsiliasi WT Harian');

// Confirm dialog variables
const showConfirmDialog = ref(false);
const confirmDialogTitle = ref('');
const confirmDialogMessage = ref('');
const confirmDialogConfirmText = ref('Ya');
const confirmDialogCancelText = ref('Tidak');
const confirmDialogCallback = ref(null);

const formData = reactive({
  cab: '', // Default to 'SEMUA' for all branches
  periode: ''
});

const cabangStore = useCabangStore();

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
    
    // Check for existing reconciliation
    await checkExistingReconciliation();
    
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
  
  // Check if reconciliation is already running
  await checkExistingReconciliation();
  
  if (isReconciling.value) {
    toast.showWarning('Perhatian', 'Proses rekonsiliasi sedang berjalan. Harap tunggu hingga selesai.');
    return;
  }
  
  try {
    isReconciling.value = true;
    showProgressBar.value = true;
    progressStatus.value = 'in_progress';
    processedItems.value = 0;
    totalItems.value = 0;
    totalDifferences.value = 0;
    timeElapsed.value = 0;
    progressMessage.value = 'Memulai proses rekonsiliasi...';
    
    // Set progress title with branch and period information
    const cabangText = formData.cab === 'All' ? 'Semua Cabang' : `Cabang ${formData.cab}`;
    const periodeText = formData.periode ? `Periode ${formData.periode}` : '';
    progressTitle.value = `Rekonsiliasi WT Harian - ${cabangText} ${periodeText}`.trim();
    
    // Start timer for elapsed time
    startProgressTimer();
    
    // Call API to start reconciliation
    const response = await rekonWtHarianService.startReconciliation({
      cab: formData.cab,
      periode: formData.periode
    });
    
    // Get progress ID from response
    if (response.data && response.data.progressId) {
      progressId.value = response.data.progressId;
      totalItems.value = response.data.totalStores || response.data.totalBranches || 0;
      
      // Connect to WebSocket for real-time updates
      connectToWebSocket();
      
      toast.showSuccess('Sukses', 'Proses rekonsiliasi dimulai');
    } else {
      throw new Error('Tidak dapat memulai rekonsiliasi');
    }
  } catch (error) {
    progressStatus.value = 'error';
    
    // Handle case where another reconciliation process is already running (409 Conflict)
    if (error.response && error.response.status === 409) {
      const activeProcess = error.response.data.activeProcess;
      
      // Extract metadata with fallback values
      const activeCab = activeProcess.metadata?.cab || activeProcess.cab || 'Unknown';
      const activePeriode = activeProcess.metadata?.period || activeProcess.periode || 'Unknown';
      
      // Show more detailed error message
      progressMessage.value = `Proses rekonsiliasi untuk ${activeCab === 'All' ? 'semua cabang' : `cabang ${activeCab}`} periode ${activePeriode} sedang berjalan.`;
      
      // If we have an active process ID, we can connect to it
      if (activeProcess && activeProcess.id) {
        // Ask user if they want to view the running process using ConfirmDialog
        confirmDialogTitle.value = 'Proses Rekonsiliasi Sedang Berjalan';
        confirmDialogMessage.value = `${progressMessage.value}\n\nApakah Anda ingin melihat progress proses yang sedang berjalan?`;
        confirmDialogConfirmText.value = 'Ya, Lihat Progress';
        confirmDialogCancelText.value = 'Tidak';
        
        // Set callback function for confirmation
        confirmDialogCallback.value = () => {
          // Connect to the existing process
          progressId.value = activeProcess.id;
          totalItems.value = activeProcess.totalItems || 0;
          
          // Connect to WebSocket for the running process
          connectToWebSocket();
          
          toast.showInfo('Info', 'Menampilkan progress proses yang sedang berjalan');
        };
        
        // Show the confirm dialog
        showConfirmDialog.value = true;
        return; // Exit early since we're waiting for user confirmation
      }
      
      toast.showWarning('Perhatian', error.response.data.message || 'Proses rekonsiliasi sedang berjalan');
    } else {
      // Handle other errors
      progressMessage.value = `Error: ${error.message || 'Terjadi kesalahan saat memulai rekonsiliasi'}`;
      toast.showError('Error', error.message || 'Terjadi kesalahan saat memulai rekonsiliasi');
    }
    
    stopProgressTracking();
  }
};

// Connect to SSE for real-time progress updates
const connectToWebSocket = () => {
  // Close existing SSE connection if any
  if (webSocket.value) {
    webSocket.value.close();
  }
  
  // Pastikan progressId selalu didefinisikan dengan format yang konsisten
  if (!progressId.value || progressId.value === '') {
    // Gunakan ID yang tetap berdasarkan cabang dan periode yang dipilih
    progressId.value = `rekon_${formData.cab}_${formData.periode}`;
  }
  
  // Validasi progressId sebelum membuat koneksi
  if (!progressId.value || progressId.value === 'rekon__' || progressId.value.includes('undefined')) {
    toast.showError('Error', 'Progress ID tidak valid');
    return;
  }
  
  // Create new SSE connection
  webSocket.value = rekonWtHarianService.createProgressWebSocket(
    progressId.value,
    handleProgressUpdate
  );
};

// Handle progress updates from SSE
const handleProgressUpdate = (data) => {
  // Check if this is a progress update
  if (data.type === 'progress' && data.data) {
    const progressData = data.data;
    
    // Update progress values - handle both stores and branches
    if (progressData.details && progressData.details.processType === 'all_branches') {
      // For all branches, use branch count
      processedItems.value = progressData.details.completedBranches || progressData.currentStep || 0;
      totalItems.value = progressData.details.totalBranches || totalItems.value;
    } else {
      // For single branch, use store count
      processedItems.value = progressData.processedItems || progressData.currentStep || 0;
      totalItems.value = progressData.totalItems || totalItems.value;
    }
    
    // Update differences count from details if available
    if (progressData.details) {
      totalDifferences.value = progressData.details.totalDifferences || 
                              progressData.details.storesWithDifferences || 
                              progressData.totalDifferences || 
                              progressData.itemsWithDifferences || 0;
    }
    
    // Update status
    progressStatus.value = progressData.status || 'running';
    
    // Create detailed message with wave and branch information
    let detailMessage = progressData.message || '';
    
    // Add wave and branch information if available
    if (progressData.details) {
      // Handle different process types
      if (progressData.details.processType === 'all_branches') {
        // For all branches processing
        if (progressData.details.lastProcessedBranch) {
          detailMessage = `Terakhir diproses: ${progressData.details.lastProcessedBranch}`;
        } else {
          detailMessage = `Memproses ${progressData.details.totalBranches || 'semua'} cabang`;
        }
      } else {
        // For single branch processing
        // Determine current branch being processed from progress data
        let currentProcessingBranch = '';
        if (progressData.details.cab) {
          currentProcessingBranch = progressData.details.cab;
        } else if (progressData.details.currentBranch) {
          currentProcessingBranch = progressData.details.currentBranch;
        }
        
        // Show information about which branch is currently being processed
        if (currentProcessingBranch) {
          if (!detailMessage) {
            detailMessage = `Memproses cabang: ${currentProcessingBranch}`;
          }
        } else {
          // Fallback to selected branch info only if no current processing branch
          const cabangInfo = formData.cab === 'All' ? 'SEMUA CABANG' : `Cabang: ${formData.cab}`;
          if (!detailMessage) {
            detailMessage = `Rekonsiliasi ${cabangInfo}`;
          }
        }
      }
      
      // If we have wave information
      if (progressData.details.currentWave) {
        // If we're processing a specific wave
        const waveInfo = ` (Wave ${progressData.details.currentWave})`;
        
        // Add wave progress if available
        if (progressData.details.waveProgress) {
          detailMessage += `${waveInfo}: ${progressData.details.waveProgress}`;
        } else {
          detailMessage += waveInfo;
        }
      }
      
      // If we have current store information
      if (progressData.details.currentStore && !detailMessage.includes('Toko:')) {
        detailMessage += detailMessage ? `, Toko: ${progressData.details.currentStore}` : 
                                       `Memproses toko: ${progressData.details.currentStore}`;
      }
    }
    
    // Update progress message
    progressMessage.value = detailMessage || progressData.message || '';
    
    // Update wave and branch information
    currentWave.value = progressData.currentWave || 1;
    maxWaves.value = progressData.maxWaves || 1;
    
    // Set current branch information
    if (progressData.details && progressData.details.cab) {
      // Backend sends current branch in details.cab
      currentBranch.value = progressData.details.cab;
    } else if (progressData.details && progressData.details.currentBranch) {
      currentBranch.value = progressData.details.currentBranch;
    } else if (progressData.currentBranch) {
      currentBranch.value = progressData.currentBranch;
    } else {
      // If no specific branch is being processed, show the selected branch
      currentBranch.value = formData.cab === 'All' ? 'Semua Cabang' : formData.cab;
    }
    
    // Update progress title dynamically based on current branch being processed
    if (currentBranch.value && currentBranch.value !== 'Semua Cabang') {
      const cabangText = `Cabang ${currentBranch.value}`;
      const periodeText = formData.periode ? `Periode ${formData.periode}` : '';
      progressTitle.value = `Rekonsiliasi WT Harian - ${cabangText} ${periodeText}`.trim();
    }
    
    // Set current item information (store being processed)
    if (progressData.details && progressData.details.currentStore) {
      currentItem.value = progressData.details.currentStore;
    } else if (progressData.currentItem) {
      currentItem.value = progressData.currentItem;
    } else if (progressData.details && progressData.details.storeProgress) {
      currentItem.value = progressData.details.storeProgress;
    } else {
      currentItem.value = '';
    }
    
    // Update progress percentage - use backend calculated percentage if available
    if (progressData.details && progressData.details.percentage !== undefined) {
      progressPercentage.value = progressData.details.percentage;
    } else if (progressData.percentage !== undefined) {
      progressPercentage.value = progressData.percentage;
    } else {
      progressPercentage.value = totalItems.value > 0 ? Math.round((processedItems.value / totalItems.value) * 100) : 0;
    }
    // If reconciliation is complete, stop tracking
    if (progressData.status === 'completed' || progressData.status === 'failed' || progressData.status === 'error') {
      stopProgressTracking();
      
      if (progressData.status === 'completed') {
        toast.showSuccess('Sukses', 'Rekonsiliasi selesai');
        // Emit view-results to refresh the results
        emitViewResults();
      } else {
        toast.showError('Error', progressData.message || 'Terjadi kesalahan saat rekonsiliasi');
      }
    }
  } else if (data.type === 'connected') {
    // Connected to progress updates
  } else if (data.type === 'error') {
    toast.showError('Error', data.message || 'Terjadi kesalahan pada koneksi progress');
  } else {
    // Unknown message type received
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
  isReconciling.value = false;
  
  // Stop timer
  if (progressTimer.value) {
    clearInterval(progressTimer.value);
    progressTimer.value = null;
  }
  
  // Close WebSocket
  if (webSocket.value) {
    webSocket.value.close();
    webSocket.value = null;
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
    confirmDialogCallback.value = null;
  }
};

// Check for existing reconciliation on component mount
const checkExistingReconciliation = async () => {
  try {
    // Validasi formData sebelum membuat progressId
    if (!formData.cab || !formData.periode) {
      return false;
    }
    
    // Buat progressId yang tetap berdasarkan cabang dan periode yang dipilih
    const fixedProgressId = `rekon_${formData.cab || 'All'}_${formData.periode || ''}`;
    
    // Cek untuk semua cabang dan periode yang dipilih
    const response = await rekonWtHarianService.getLatestProgress(
      formData.cab || 'All',
      formData.periode || ''
    );
    
    // Check for existing reconciliation progress
    
    // Cek apakah ada proses rekonsiliasi yang sedang berjalan
    if (response.data && 
        (response.data.status === 'in_progress' || 
         response.data.status === 'running' || 
         response.data.status === 'pending')) {
      
      // Ada rekonsiliasi yang sedang berjalan, tampilkan progress bar
      progressId.value = fixedProgressId;
      progressStatus.value = response.data.status;
      processedItems.value = response.data.processedItems || 0;
      totalItems.value = response.data.totalItems || 0;
      
      // Set progress title with branch and period information from progress data
      let cabangText = '';
      if (response.data.details && response.data.details.cab) {
        cabangText = response.data.details.cab === 'All' ? 'Semua Cabang' : `Cabang ${response.data.details.cab}`;
      } else if (response.data.details && response.data.details.currentBranch) {
        cabangText = `Cabang ${response.data.details.currentBranch}`;
      } else {
        // Fallback to form data only if no progress data available
        cabangText = formData.cab === 'All' ? 'Semua Cabang' : `Cabang ${formData.cab}`;
      }
      const periodeText = formData.periode ? `Periode ${formData.periode}` : '';
      progressTitle.value = `Rekonsiliasi WT Harian - ${cabangText} ${periodeText}`.trim();
      
      // Set current branch information
       if (response.data.details && response.data.details.cab) {
         // Backend sends current branch in details.cab
         currentBranch.value = response.data.details.cab;
       } else if (response.data.details && response.data.details.currentBranch) {
         currentBranch.value = response.data.details.currentBranch;
       } else {
         currentBranch.value = formData.cab === 'All' ? 'Semua Cabang' : formData.cab;
       }
      
      // Update differences count if available
      if (response.data.details) {
        totalDifferences.value = response.data.details.totalDifferences || 
                                response.data.details.storesWithDifferences || 0;
      }
      
      // Create detailed message with wave and branch information
      let detailMessage = response.data.message || 'Rekonsiliasi sedang berjalan...';
      
      // Add wave and branch information if available
      if (response.data.details) {
        // Tampilkan informasi cabang yang sedang direkon (cabang tertentu atau semua cabang)
        const cabangInfo = response.data.cab === 'All' ? 'SEMUA CABANG' : `Cabang: ${response.data.cab}`;
        
        // If we have a current branch being processed
        if (response.data.details.currentBranch) {
          detailMessage = `Rekonsiliasi ${cabangInfo}, memproses cabang: ${response.data.details.currentBranch}`;
        } else {
          detailMessage = `Rekonsiliasi ${cabangInfo}`;
        }
        
        // If we have wave information
        if (response.data.details.currentWave) {
          // If we're processing a specific wave
          const waveInfo = ` (Wave ${response.data.details.currentWave}/${response.data.details.totalWaves || '?'})`;
          
          // Add wave progress if available
          if (response.data.details.waveProgress) {
            detailMessage += `${waveInfo}: ${response.data.details.waveProgress}`;
          } else {
            detailMessage += waveInfo;
          }
        }
        
        // If we have current store information
        if (response.data.details.currentStore && !detailMessage.includes('Toko:')) {
          detailMessage += detailMessage ? `, Toko: ${response.data.details.currentStore}` : 
                                         `Memproses toko: ${response.data.details.currentStore}`;
        }
      }
      
      progressMessage.value = detailMessage;
      
      // Aktifkan tracking progress
      isReconciling.value = true;
      showProgressBar.value = true;
      startProgressTimer();
      
      // Connect to WebSocket for real-time updates
      if (progressId.value) {
        connectToWebSocket();
      }
      
      // Tampilkan pesan info untuk user
      toast.showInfo('Info', 'Proses rekonsiliasi sedang berjalan. Anda dapat melihat progress rekonsiliasi yang sedang berlangsung.');
      
      return true; // Ada rekonsiliasi yang sedang berjalan
    }
    
    return false; // Tidak ada rekonsiliasi yang sedang berjalan
  } catch (error) {
    return false;
  }
};

// Clean up on component unmount
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
  justify-content: flex-end;
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