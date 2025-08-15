<template>
  <div class="rekon-form-container">
    <div class="card">
      <h2 class="form-title">Hasil Rekonsiliasi WT Harian</h2>
      <p class="form-description">
        Lihat hasil rekonsiliasi data transaksi antara WRC dan toko per tanggal.
      </p>

      <form @submit.prevent="submitForm" class="rekon-form">
        <div class="form-group">
          <label for="cab">Cabang</label>
          <Dropdown 
            id="cab" 
            v-model="formData.cab" 
            :options="cabangOptions" 
            optionLabel="namacab" 
            optionValue="kdcab"
            placeholder="Pilih Cabang" 
            :disabled="loading"
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
            :disabled="loading"
            :maxDate="today"
            showIcon
            class="w-full"
            @date-select="updatePeriode"
          />
          <small v-if="errors.periode" class="error-text">{{ errors.periode }}</small>
          <!-- <small class="help-text">Pilih bulan dan tahun untuk periode rekonsiliasi</small> -->
        </div>

        <!-- Tombol Lihat Hasil dihilangkan karena data sudah dimuat otomatis saat cabang atau periode berubah -->
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useToastService } from '../../utils/toast';
import { useCabangStore } from '../../stores';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';

const toast = useToastService();
const loading = ref(false);
const errors = reactive({});
const cabangOptions = ref([]);
const selectedDate = ref(null);
const today = ref(new Date()); // Tanggal hari ini sebagai batas maksimal calendar

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
    
    // Emit view-results event with default values
    if (formData.periode) {
      emitViewResults();
    }
  } catch (error) {
    console.error('Error fetching cabang data:', error);
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
    
    console.log('Emitting view-results event with data:', {
      cab: formData.cab,
      periode: formData.periode
    });
    
    toast.showInfo('Info', 'Mencari data rekonsiliasi...', 3000);
  } catch (error) {
    console.error('Error:', error);
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
    console.log('Emitting view-results with cab:', cabParam, 'periode:', formData.periode);
    emit('view-results', {
      cab: cabParam,
      periode: formData.periode
    });
  }
};

// Handler untuk perubahan cabang
const handleCabChange = () => {
  console.log('Cabang changed to:', formData.cab);
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
</script>

<style scoped>
.rekon-form-container {
  margin-bottom: 0;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
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