<template>
  <div class="rekon-persediaan-form">
    <RekonFormComponent :errors="errors" @submit="submitForm">
      <template #title>
        Parameter Rekonsiliasi Persediaan
      </template>

      <template #description>
        Pilih cabang dan periode untuk melakukan rekonsiliasi HPP Store vs WRC
      </template>

      <template #cab>
        <Dropdown id="cab" v-model="formData.cab" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab"
          placeholder="Pilih Cabang" :disabled="isReconciling" class="w-full" @change="handleCabChange" />
      </template>

      <template #periode>
        <Calendar id="periode" v-model="selectedDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun"
          :disabled="isReconciling" :maxDate="maxDate" showIcon class="w-full" @date-select="updatePeriode" />
      </template>

      <template #actions>
        <Button type="button" label="Mulai Screening" icon="pi pi-refresh" class="p-button-primary"
          @click="startScreening" :loading="isReconciling" :disabled="isReconciling" />
      </template>
    </RekonFormComponent>

    <!-- Force Re-screen Toggle -->
    <div class="flex align-items-center mb-3 mt-2" style="padding-left: 1rem;">
      <Checkbox v-model="forceScreening" inputId="forceScreeningRekonPersediaan" :binary="true" :disabled="isReconciling" />
      <label for="forceScreeningRekonPersediaan" class="ml-2 text-sm text-color-secondary">
        <i class="pi pi-exclamation-triangle mr-1 text-yellow-500"></i>
        Force Re-screen (ulang meskipun sudah sukses hari ini)
      </label>
    </div>

    <!-- card info last screening -->
    <LastScanInfo moduleName="rekon_persediaan" :selectedCabang="formData.cab" v-if="!isReconciling" />

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
import RekonFormComponent from "@/components/common/RekonFormComponent.vue";
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
