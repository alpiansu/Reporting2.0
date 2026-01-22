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

        <!-- Store Selection (Mandatory) -->
        <div class="col-12 field">
          <label for="store" class="font-bold block mb-2">Toko <span class="text-red-500">*</span></label>
          <Dropdown 
            id="store" 
            v-model="formData.store" 
            :options="storeOptions" 
            optionLabel="label" 
            optionValue="kdtk"
            placeholder="Pilih Toko (Ketik untuk mencari)" 
            class="w-full"
            :class="{ 'p-invalid': errors.store }"
            :disabled="isProcessing || !formData.cabang"
            :loading="loadingStores"
            filter
            @filter="onStoreFilter"
            :autoFilterFocus="true"
            showClear
          />
          <small class="p-error" v-if="errors.store">{{ errors.store }}</small>
          <small class="text-gray-500 block mt-1" v-else>Ketik kode atau nama toko untuk mencari.</small>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { useCabangStore } from '@/stores';
import StoreService from '@/services/store.service';
import { useToastService } from '@/utils/toast';

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['process']);

const toast = useToastService();
const cabangStore = useCabangStore();

// Form State
const formData = reactive({
  cabang: '',
  store: null,
  bukti_no: ''
});

const errors = reactive({
  cabang: '',
  store: '',
  bukti_no: ''
});

// Options State
const cabangOptions = ref([]);
const storeOptions = ref([]);
const loadingStores = ref(false);

// Load Cabang on Mount
onMounted(async () => {
  if (cabangStore.allCabang.length === 0) {
    await cabangStore.fetchCabang();
  }
  cabangOptions.value = cabangStore.allCabang;
});

// Handle Cabang Change
const handleCabangChange = () => {
  formData.store = null;
  storeOptions.value = [];
  
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
    
    const response = await StoreService.getStoresByBranch(formData.cabang, { 
      search, 
      limit: 20,
      onlyInduk: true 
    });
    
    const stores = response.data?.stores || [];
    const newOptions = stores.map(s => ({
      kdtk: s.storeCode,
      label: `${s.storeCode} - ${s.storeName}`
    }));

    // For single selection, we can just replace or append if we want to keep current
    if (formData.store) {
      const current = storeOptions.value.find(o => o.kdtk === formData.store);
      if (current && !newOptions.find(o => o.kdtk === current.kdtk)) {
        newOptions.unshift(current);
      }
    }

    storeOptions.value = newOptions;
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
  errors.store = '';
  errors.bukti_no = '';

  if (!formData.cabang) {
    errors.cabang = 'Cabang wajib dipilih';
    isValid = false;
  }

  if (!formData.store) {
    errors.store = 'Toko wajib dipilih';
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
  formData.store = null;
  formData.bukti_no = '';
  errors.cabang = '';
  errors.store = '';
  errors.bukti_no = '';
  storeOptions.value = [];
};
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
