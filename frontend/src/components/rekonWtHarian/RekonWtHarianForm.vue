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
      <ProgressBar v-if="isReconciling" :visible="isReconciling" :percentage="progressPercentage" :info="currentInfo">
        <template #title>
          Proses Rekonsiliasi WT Harian
        </template>
        <template #subtitle>
          Menghubungkan ke toko/WRC dan membandingkan data transaksi.<br />
          Proses ini mungkin memakan waktu tergantung jumlah toko dan hari.
        </template>
        <template #details>
          <small><strong>{{ currentInfo }}</strong></small>
        </template>
      </ProgressBar>

      <!-- Confirmation Dialog -->
      <ConfirmDialog v-model="showConfirmDialog" :title="confirmDialogTitle" :message="confirmDialogMessage"
        :confirm-text="confirmDialogConfirmText" :cancel-text="confirmDialogCancelText"
        @confirm="handleConfirmDialogConfirm" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { useToastService } from '../../utils/toast';
import { useCabangStore } from '../../stores';
import { useProgress } from '../../composables/useProgress';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import ProgressBar from '../common/ProgressBar.vue';
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
  isCompleted,
  isFailed,
  isVisible,
  currentInfo,
  startMonitoring,
  stopMonitoring,
} = useProgress();

const isReconciling = ref(false);

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

const startReconciliation = async () => {
  if (!validateForm()) return;
  
  await checkExistingReconciliation();
  
  if (isReconciling.value) {
    toast.showWarning('Perhatian', 'Proses rekonsiliasi sedang berjalan. Harap tunggu hingga selesai.');
    return;
  }
  
  try {
    isReconciling.value = true;
    
    const response = await rekonWtHarianService.startReconciliation({
      cab: formData.cab,
      periode: formData.periode,
      force: forceReScreen.value ? "true" : undefined
    });
    
    if (response.data && response.data.taskId) {
      const taskId = response.data.taskId;
      
      await startMonitoring(taskId, {
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
      
      if (activeProcess && activeProcess.id) {
        confirmDialogTitle.value = 'Proses Rekonsiliasi Sedang Berjalan';
        confirmDialogMessage.value = `Proses rekonsiliasi untuk ${activeCab === 'All' ? 'semua cabang' : `cabang ${activeCab}`} periode ${activePeriode} sedang berjalan.\n\nApakah Anda ingin melihat progress proses yang sedang berjalan?`;
        confirmDialogConfirmText.value = 'Ya, Lihat Progress';
        confirmDialogCancelText.value = 'Tidak';
        
        confirmDialogCallback.value = async () => {
          await startMonitoring(activeProcess.id, {
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
      toast.showError('Error', error.message || 'Terjadi kesalahan saat memulai rekonsiliasi');
    }
    
    stopProgressTracking();
  }
};

const stopProgressTracking = () => {
  isReconciling.value = false;
  stopMonitoring();
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
        isReconciling.value = true;
        
        if (taskData.id) {
          await startMonitoring(taskData.id, {
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

// Backup watches (rekon_sales pattern) — handles completion if callback timing changes
watch(isCompleted, async (newVal) => {
  if (!isReconciling.value) return;
  if (newVal) {
    setTimeout(async () => {
      if (isReconciling.value) {
        stopProgressTracking();
        toast.showSuccess('Sukses', 'Rekonsiliasi selesai');
        emitViewResults();
      }
    }, 1000);
  }
});

watch(isFailed, async (newVal) => {
  if (!isReconciling.value) return;
  if (newVal) {
    setTimeout(async () => {
      if (isReconciling.value) {
        const errorMsg = progress.value?.error?.description || progress.value?.description || 'Terjadi kesalahan saat rekonsiliasi';
        stopProgressTracking();
        toast.showError('Error', errorMsg);
      }
    }, 1000);
  }
});

onBeforeUnmount(() => {
  stopProgressTracking();
});
</script>

<style scoped src="./RekonWtHarianForm.style.css"></style>
