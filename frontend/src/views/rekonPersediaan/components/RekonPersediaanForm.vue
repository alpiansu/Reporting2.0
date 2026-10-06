<template>
  <div class="rekon-persediaan-form">
    <div class="filter-panel">
      <!-- Row 1: Primary Inputs & Screening Button -->
      <form @submit.prevent="submitForm" class="filter-row-primary">
        <div class="filter-field">
          <label for="cab" class="filter-label">Cabang</label>
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
          <small v-if="errors.cab" class="error-text">{{ errors.cab }}</small>
        </div>

        <div class="filter-field">
          <label for="periode" class="filter-label">Periode</label>
          <Calendar
            id="periode"
            v-model="selectedDate"
            view="month"
            dateFormat="mm/yy"
            placeholder="Pilih Bulan/Tahun"
            :disabled="isReconciling"
            :maxDate="maxDate"
            showIcon
            class="filter-calendar"
            @date-select="updatePeriode"
          />
          <small v-if="errors.periode" class="error-text">{{ errors.periode }}</small>
        </div>

        <div class="filter-actions-col">
          <Button
            type="button"
            label="Mulai Screening"
            icon="pi pi-refresh"
            class="p-button-primary btn-action"
            @click="startScreening"
            :loading="isReconciling"
            :disabled="isReconciling"
          />
        </div>
      </form>

      <!-- Row 2: Slim Footer Bar (Force Re-screen + Operational Hint) -->
      <div class="filter-footer-bar">
        <div class="force-screen-pill">
          <Checkbox
            v-model="forceScreening"
            inputId="forceScreeningRekonPersediaan"
            :binary="true"
            :disabled="isReconciling"
          />
          <label for="forceScreeningRekonPersediaan" class="checkbox-label">
            <i class="pi pi-exclamation-triangle text-warning"></i>
            <span>Force Re-screen</span>
          </label>
          <small class="screen-hint">(Jalankan ulang rekonsiliasi meskipun sudah sukses hari ini)</small>
        </div>
      </div>
    </div>

    <!-- Standalone Slim LastScanInfo Status Strip -->
    <LastScanInfo
      moduleName="rekon_persediaan"
      :selectedCabang="formData.cab"
      v-if="!isReconciling"
      class="mt-2"
    />

    <!-- Processing Loading State -->
    <ProgressBar v-if="isReconciling" :visible="isReconciling" :percentage="progress.percentage" :info="progress.info">
      <template #title>
        Processing Reconciliation...
      </template>

      <template #subtitle>
        Connecting to stores/WRC and comparing HPP data.<br />
        This may take a while depending on the number of stores and days.
      </template>

      <template #details>
        <small>
          <strong>{{ progress.info }}</strong>
        </small>
      </template>
    </ProgressBar>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useToastService } from '@/utils/toast';
import { useCabangStore, useAuthStore } from '@/stores';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import ProgressBar from "@/components/common/ProgressBar.vue";
import progressService from "@/services/progress.service.js";
import rekonPersediaanService from '@/services/rekonPersediaan.service';
import api from "@/services/api.js";
import LastScanInfo from "@/components/common/LastScanInfo.vue";

const toast = useToastService();
const authStore = useAuthStore();
const cabangStore = useCabangStore();
const strUsername = authStore.user.username;

const errors = reactive({});
const cabangOptions = ref([]);
const selectedDate = ref(new Date());
const maxDate = ref(new Date());
const isReconciling = ref(false);
const forceScreening = ref(false);

const formData = reactive({
  cab: 'All',
  periode: ''
});

const progress = ref({
  percentage: 0,
  info: "",
  status: "idle",
});
let eventSource = null;

const emit = defineEmits(['view-results', 'screening-started']);

// Progress Tracking Logic
watch(isReconciling, (newVal) => {
  if (newVal) startProgressTracking();
  else stopProgressTracking();
});

const startProgressTracking = async () => {
  const taskId = `rekonPersediaanTask_${strUsername}`;
  stopProgressTracking();

  try {
    const progressResponse = await api.get('/progress');
    const allTasks = progressResponse.data.data;
    const existingTask = allTasks[taskId];

    if (existingTask) {
      startDirectProgressMonitoring(taskId);
    } else {
      setTimeout(() => {
        if (isReconciling.value) startProgressTracking();
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
        info: progressData?.info.description || progressData?.status,
        status: progressData?.status
      };
    },
    (progressData) => {
      progress.value = { percentage: 100, info: "Processing completed", status: "completed" };
      isReconciling.value = false;
      emitViewResults();
    },
    (errorData) => {
      progress.value = { percentage: 0, info: errorData.description || "Processing failed", status: "failed" };
      isReconciling.value = false;
      toast.showError({ summary: "Progress Error", detail: errorData.description || "Progress monitoring failed" });
    },
    // onCancel callback - user-initiated cancellation, no error display
    (cancelData) => {
      console.log('ℹ️ Task cancelled by user:', cancelData);
      progress.value = { percentage: 0, info: "Proses dibatalkan oleh pengguna", status: "cancelled" };
      isReconciling.value = false;
    }
  );
};

const stopProgressTracking = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
};

// Form Handlers
onMounted(async () => {
  await cabangStore.fetchCabang();
  cabangOptions.value = [{ kdcab: 'All', namacab: 'SEMUA CABANG' }, ...cabangStore.allCabang];
  updatePeriode();
});

const updatePeriode = () => {
  if (selectedDate.value) {
    const year = selectedDate.value.getFullYear().toString().slice(-2);
    const month = (selectedDate.value.getMonth() + 1).toString().padStart(2, '0');
    formData.periode = year + month;
    emitViewResults();
  }
};

const handleCabChange = () => {
  emitViewResults();
};

const validateForm = () => {
  errors.cab = !formData.cab ? 'Cabang harus dipilih' : '';
  errors.periode = !formData.periode ? 'Periode harus dipilih' : '';
  return !errors.cab && !errors.periode;
};

const emitViewResults = () => {
  if (formData.periode) {
    emit('view-results', {
      cab: formData.cab === 'All' ? 'All' : formData.cab,
      periode: formData.periode
    });
  }
};

const startScreening = async () => {
  if (!validateForm()) return;
  
  try {
    isReconciling.value = true;
    toast.showInfo({ summary: 'Process Started', detail: 'Memulai proses rekonsiliasi HPP...' });
    
    await rekonPersediaanService.startScreening({
      cabang: formData.cab,
      periode: formData.periode,
      force: forceScreening.value
    });
    
    emit('screening-started');
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Gagal memulai rekonsiliasi';
    toast.showError({ summary: 'Error', detail: errorMessage });
    isReconciling.value = false;
  }
};

const submitForm = () => {
    emitViewResults();
};
</script>

<style scoped>
.rekon-persediaan-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-panel {
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 10px;
  padding: 0.85rem 1.15rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.filter-row-primary {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.85rem;
  align-items: flex-end;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-label {
  font-size: 0.785rem;
  font-weight: 600;
  color: var(--text-color-secondary, #64748b);
  letter-spacing: 0.02em;
}

:deep(.filter-dropdown),
:deep(.filter-calendar) {
  width: 100%;
}

:deep(.filter-dropdown .p-inputtext),
:deep(.filter-calendar .p-inputtext) {
  padding: 0.45rem 0.75rem;
  font-size: 0.85rem;
}

.filter-actions-col {
  display: flex;
  align-items: center;
}

.btn-action {
  font-size: 0.825rem;
  font-weight: 600;
  padding: 0.48rem 1rem;
  white-space: nowrap;
}

.filter-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.55rem;
  border-top: 1px solid var(--surface-border, #f1f5f9);
  flex-wrap: wrap;
  gap: 0.5rem;
}

.force-screen-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  color: var(--text-color, #334155);
  cursor: pointer;
  user-select: none;
}

.text-warning {
  color: #f59e0b;
}

.screen-hint {
  color: var(--text-color-secondary, #94a3b8);
  font-size: 0.75rem;
}

.error-text {
  color: var(--error-color, #ef4444);
  font-size: 0.75rem;
  margin-top: 0.2rem;
}

@media (max-width: 900px) {
  .filter-row-primary {
    grid-template-columns: 1fr;
  }
}
</style>

