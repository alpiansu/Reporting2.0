<template>
  <div class="cetak-bpb-form-card card">
    <div class="form-header">
      <div class="title-section">
        <i class="pi pi-file-pdf header-icon"></i>
        <div class="title-text">
          <h3 class="form-title">Cetak Bukti Penerimaan Barang (BPB)</h3>
          <p class="form-subtitle">Proses cetak dokumen BPB dari toko ke format PDF</p>
        </div>
      </div>
    </div>

    <div class="form-content">
      <div class="grid form-grid">
        <!-- Cabang Selection -->
        <div class="col-12 md:col-6 field">
          <label for="cabang" class="font-bold block mb-2">Cabang <span class="text-red-500">*</span></label>
          <Dropdown 
            id="cabang" 
            v-model="formData.cabang" 
            :options="cabangOptions" 
            optionLabel="namacab" 
            optionValue="kdcab"
            placeholder="Pilih Cabang" 
            class="w-full"
            :class="{ 'p-invalid': errors.cabang }"
            :disabled="isProcessing"
            @change="handleCabangChange"
            filter
            showClear
          />
          <small class="p-error" v-if="errors.cabang">{{ errors.cabang }}</small>
        </div>

        <!-- Bukti No -->
        <div class="col-12 md:col-6 field">
          <label for="bukti_no" class="font-bold block mb-2">No. Bukti BPB <span class="text-red-500">*</span></label>
          <InputText 
            id="bukti_no" 
            v-model="formData.bukti_no" 
            placeholder="Contoh: 0000001" 
            class="w-full"
            :class="{ 'p-invalid': errors.bukti_no }"
            :disabled="isProcessing"
          />
          <small class="p-error" v-if="errors.bukti_no">{{ errors.bukti_no }}</small>
        </div>

        <!-- Stores Selection (Optional) -->
        <div class="col-12 field">
          <label for="stores" class="font-bold block mb-2">Toko (Opsional)</label>
          <MultiSelect 
            id="stores" 
            v-model="formData.stores" 
            :options="storeOptions" 
            optionLabel="label" 
            optionValue="kdtk"
            placeholder="Pilih Toko (Ketik untuk mencari)" 
            class="w-full"
            :disabled="isProcessing || !formData.cabang"
            :loading="loadingStores"
            filter
            @filter="onStoreFilter"
            :autoFilterFocus="true"
            display="chip"
          />
          <small class="text-gray-500 block mt-1">Ketik kode atau nama toko untuk mencari. Kosongkan jika ingin memproses semua toko di cabang.</small>
        </div>
      </div>

      <div class="form-actions mt-4">
        <Button 
          type="button" 
          label="Mulai Proses Cetak" 
          icon="pi pi-print" 
          class="p-button-primary p-button-lg w-full md:w-auto"
          @click="handleSubmit" 
          :loading="isProcessing" 
          :disabled="isProcessing"
        />
        <Button 
          type="button" 
          label="Reset" 
          icon="pi pi-refresh" 
          class="p-button-secondary p-button-lg p-button-text w-full md:w-auto ml-0 md:ml-3 mt-2 md:mt-0"
          @click="resetForm" 
          :disabled="isProcessing"
        />
      </div>
    </div>

    <!-- Progress Section -->
    <div v-if="isProcessing" class="progress-section mt-6">
      <ProgressBar 
        :visible="isProcessing" 
        :percentage="progress.percentage" 
        :info="progress.info"
      >
        <template #title>
          Processing BPB Printing...
        </template>
        <template #subtitle>
          Connecting to stores and generating PDF documents.<br />
          This may take a while depending on the number of stores.
        </template>
      </ProgressBar>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import ProgressBar from '@/components/common/ProgressBar.vue';
import { useCabangStore } from '@/stores';
import api from '@/services/api';
import StoreService from '@/services/store.service';
import progressService from '@/services/progress.service';
import { useAuthStore } from '@/stores';
import { useToastService } from '@/utils/toast';

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['process', 'progress-update', 'complete']);

const toast = useToastService();
const cabangStore = useCabangStore();
const authStore = useAuthStore();
const strUsername = authStore.user.username;

// Form State
const formData = reactive({
  cabang: '',
  stores: [],
  bukti_no: ''
});

const errors = reactive({
  cabang: '',
  bukti_no: ''
});

// Options State
const cabangOptions = ref([]);
const storeOptions = ref([]);
const loadingStores = ref(false);

// Progress State
const progress = ref({
  percentage: 0,
  info: "Initializing...",
  status: "idle"
});

let eventSource = null;

// Load Cabang on Mount
onMounted(async () => {
  if (cabangStore.allCabang.length === 0) {
    await cabangStore.fetchCabang();
  }
  cabangOptions.value = cabangStore.allCabang;
});

// Handle Cabang Change
const handleCabangChange = () => {
  formData.stores = [];
  storeOptions.value = [];
  
  // Ambil data awal saat cabang dipilih (opsional, bisa juga dikosongkan)
  if (formData.cabang) {
    fetchStores('');
  }
};

let searchTimeout = null;
const onStoreFilter = (event) => {
  const query = event.value;
  
  if (searchTimeout) clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(() => {
    fetchStores(query);
  }, 500);
};

const fetchStores = async (search = '') => {
  if (!formData.cabang) return;

  try {
    loadingStores.value = true;
    
    // Ambil data toko dengan limit kecil untuk efisiensi
    const response = await StoreService.getStoresByBranch(formData.cabang, { 
      search, 
      limit: 20, // Batasi hasil pencarian agar cepat
      onlyInduk: true 
    });
    
    const stores = response.data?.stores || [];
    const newOptions = stores.map(s => ({
      kdtk: s.storeCode,
      label: `${s.storeCode} - ${s.storeName}`
    }));

    // Tetap pertahankan toko yang sudah terpilih agar tidak hilang dari list saat filter berubah
    const currentlySelected = storeOptions.value.filter(opt => formData.stores.includes(opt.kdtk));
    
    // Gabungkan (union) hasil baru dengan yang sudah terpilih
    const combined = [...currentlySelected];
    newOptions.forEach(opt => {
      if (!combined.find(c => c.kdtk === opt.kdtk)) {
        combined.push(opt);
      }
    });

    storeOptions.value = combined;
  } catch (error) {
    console.error('Error fetching stores:', error);
  } finally {
    loadingStores.value = false;
  }
};

// Validation
const validateForm = () => {
  let isValid = true;
  errors.cabang = '';
  errors.bukti_no = '';

  if (!formData.cabang) {
    errors.cabang = 'Cabang wajib dipilih';
    isValid = false;
  }

  if (!formData.bukti_no) {
    errors.bukti_no = 'Nomor Bukti wajib diisi';
    isValid = false;
  }

  return isValid;
};

// Submit handler
const handleSubmit = () => {
  if (!validateForm()) return;
  emit('process', { ...formData });
};

// Reset form
const resetForm = () => {
  formData.cabang = '';
  formData.stores = [];
  formData.bukti_no = '';
  errors.cabang = '';
  errors.bukti_no = '';
  storeOptions.value = [];
};

// Progress Tracking Logic
const startProgressTracking = async () => {
  const taskId = `CetakBPB_${strUsername}`; // Match backend taskProgressName
  
  stopProgressTracking();

  try {
    // Initial check
    const progressResponse = await api.get('/progress');
    const allTasks = progressResponse.data.data;
    const existingTask = allTasks[taskId];

    if (existingTask) {
      console.log('✅ CetakBPB task found');
      startDirectMonitoring(taskId);
    } else {
      console.log('Waiting for CetakBPB task creation...');
      setTimeout(() => {
        if (props.isProcessing) startProgressTracking();
      }, 1000);
    }
  } catch (error) {
    console.error('Error checking progress:', error);
    startDirectMonitoring(taskId);
  }
};

const startDirectMonitoring = (taskId) => {
  eventSource = progressService.monitorProgress(
    taskId,
    (data) => {
      progress.value = {
        percentage: data?.percentage || 0,
        info: data?.info?.description || data?.status || "Processing...",
        status: data?.status
      };
      emit('progress-update', progress.value);
    },
    (data) => {
      progress.value = {
        percentage: 100,
        info: data?.info?.description || "Completed",
        status: "completed"
      };
      emit('complete', data);
    },
    (error) => {
      console.error('Progress error:', error);
      toast.showError('Error', error.description || 'Gagal memantau progres');
      progress.value.status = 'failed';
    }
  );
};

const stopProgressTracking = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  progress.value = { percentage: 0, info: "", status: "idle" };
};

// Watch for isProcessing prop to start/stop tracking
watch(() => props.isProcessing, (newVal) => {
  if (newVal) {
    startProgressTracking();
  } else {
    stopProgressTracking();
  }
});
</script>

<style scoped>
.cetak-bpb-form-card {
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.form-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 1.5rem;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  font-size: 2.5rem;
  color: #ef4444; /* PDF Red */
  background: #fef2f2;
  padding: 0.75rem;
  border-radius: 12px;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.form-subtitle {
  color: #64748b;
  margin: 0.25rem 0 0 0;
}

.field label {
  color: #334155;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 1.5rem;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
}
</style>
