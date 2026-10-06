<template>
  <div class="cetak-bpb-form-card card">
    <div class="form-content">
      <div class="grid form-grid">
        <!-- Cabang Selection -->
        <div class="col-12 md:col-6 field">
          <label for="cabang" class="field-label">Cabang <span class="text-red-500">*</span></label>
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
          <label for="bukti_no" class="field-label">No. Bukti BPB <span class="text-red-500">*</span></label>
          <InputText 
            id="bukti_no" 
            v-model="formData.bukti_no" 
            placeholder="Contoh: 0000001" 
            class="w-full font-mono"
            :class="{ 'p-invalid': errors.bukti_no }"
            :disabled="isProcessing"
          />
          <small class="p-error" v-if="errors.bukti_no">{{ errors.bukti_no }}</small>
        </div>

        <!-- Store Selection (Mandatory) -->
        <div class="col-12 field">
          <label for="store" class="field-label">Toko <span class="text-red-500">*</span></label>
          <Dropdown 
            id="store" 
            v-model="formData.store" 
            :options="storeOptions" 
            optionLabel="label" 
            optionValue="kdtk"
            placeholder="Pilih Toko (Ketik untuk mencari)" 
            class="w-full font-mono"
            :class="{ 'p-invalid': errors.store }"
            :disabled="isProcessing || !formData.cabang"
            :loading="loadingStores"
            filter
            @filter="onStoreFilter"
            :autoFilterFocus="true"
            showClear
          />
          <small class="p-error" v-if="errors.store">{{ errors.store }}</small>
          <small class="helper-text" v-else>Ketik kode atau nama toko untuk mencari.</small>
        </div>
      </div>

      <div class="form-actions mt-3">
        <Button 
          type="button" 
          label="Mulai Proses Cetak" 
          icon="pi pi-print" 
          class="p-button-primary p-button-sm"
          @click="handleSubmit" 
          :loading="isProcessing" 
          :disabled="isProcessing"
        />
        <Button 
          type="button" 
          label="Reset" 
          icon="pi pi-refresh" 
          class="p-button-secondary p-button-outlined p-button-sm ml-2"
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

function formatCode(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
}

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
    const newOptions = stores.map(s => {
      const code = formatCode(s.storeCode);
      return {
        kdtk: code,
        label: `${code} - ${s.storeName}`
      };
    });

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

<style scoped src="./CetakBpbForm.style.css"></style>
