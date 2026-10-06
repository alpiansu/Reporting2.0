<template>
  <div class="cetak-nrb-form-card card">
    <div class="form-content">
      <div class="grid form-grid">
        <div class="col-12 md:col-6 field">
          <label for="cabang" class="field-label">Cabang <span class="text-red-500">*</span></label>
          <Dropdown id="cabang" v-model="formData.cabang" :options="cabangOptions"
            optionLabel="namacab" optionValue="kdcab" placeholder="Pilih Cabang" class="w-full"
            :class="{ 'p-invalid': errors.cabang }" :disabled="isProcessing"
            @change="handleCabangChange" filter showClear />
          <small class="p-error" v-if="errors.cabang">{{ errors.cabang }}</small>
        </div>

        <div class="col-12 md:col-6 field">
          <label for="bukti_no" class="field-label">No. Bukti NRB <span class="text-red-500">*</span></label>
          <InputText id="bukti_no" v-model="formData.bukti_no" placeholder="Contoh: 729" class="w-full font-mono"
            :class="{ 'p-invalid': errors.bukti_no }" :disabled="isProcessing" />
          <small class="p-error" v-if="errors.bukti_no">{{ errors.bukti_no }}</small>
        </div>

        <div class="col-12 field">
          <label for="store" class="field-label">Toko <span class="text-red-500">*</span></label>
          <Dropdown id="store" v-model="formData.store" :options="storeOptions"
            optionLabel="label" optionValue="kdtk" placeholder="Pilih Toko (Ketik untuk mencari)" class="w-full font-mono"
            :class="{ 'p-invalid': errors.store }" :disabled="isProcessing || !formData.cabang"
            :loading="loadingStores" filter @filter="onStoreFilter" :autoFilterFocus="true" showClear />
          <small class="p-error" v-if="errors.store">{{ errors.store }}</small>
          <small class="helper-text" v-else>Ketik kode atau nama toko untuk mencari.</small>
        </div>

        <div class="col-12 md:col-6 field">
          <label class="field-label">Sumber Data <span class="text-red-500">*</span></label>
          <SelectButton v-model="formData.source" :options="sourceOptions" optionLabel="label" optionValue="value"
            :disabled="isProcessing" @change="handleSourceChange" class="mt-1" />
          <small class="p-error" v-if="errors.source">{{ errors.source }}</small>
        </div>

        <div class="col-12 md:col-6 field" v-if="formData.source === 'wrc'">
          <label for="tanggal" class="field-label">Tanggal Transaksi <span class="text-red-500">*</span></label>
          <Calendar id="tanggal" v-model="formData.tanggal" view="date" dateFormat="dd/mm/yy"
            placeholder="Pilih tanggal transaksi" :maxDate="today" showIcon class="w-full"
            :class="{ 'p-invalid': errors.tanggal }" :disabled="isProcessing" />
          <small class="p-error" v-if="errors.tanggal">{{ errors.tanggal }}</small>
          <small class="helper-text" v-else>Tanggal transaksi NRB (untuk resolve tabel harian WRC)</small>
        </div>
      </div>

      <div class="form-actions mt-3">
        <Button type="button" label="Mulai Proses Cetak" icon="pi pi-print"
          class="p-button-primary p-button-sm"
          @click="handleSubmit" :loading="isProcessing" :disabled="isProcessing || !isFormValid" />
        <Button type="button" label="Reset" icon="pi pi-refresh"
          class="p-button-secondary p-button-outlined p-button-sm ml-2"
          @click="resetForm" :disabled="isProcessing" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import Calendar from 'primevue/calendar';
import { useCabangStore } from '@/stores';
import StoreService from '@/services/store.service';
import { useToastService } from '@/utils/toast';

const props = defineProps({ isProcessing: { type: Boolean, default: false } });
const emit = defineEmits(['process']);
const toast = useToastService();
const cabangStore = useCabangStore();

const today = ref(new Date());
const formData = reactive({ cabang: '', store: null, bukti_no: '', source: 'store', tanggal: null });
const errors = reactive({ cabang: '', store: '', bukti_no: '', source: '', tanggal: '' });
const cabangOptions = ref([]);
const storeOptions = ref([]);
const loadingStores = ref(false);

const sourceOptions = ref([
  { label: 'Toko', value: 'store' },
  { label: 'WRC', value: 'wrc' },
]);

const isFormValid = computed(() => {
  if (!formData.cabang || !formData.store || !formData.bukti_no || !formData.source) return false;
  if (formData.source === 'wrc' && !formData.tanggal) return false;
  return true;
});

onMounted(async () => {
  if (cabangStore.allCabang.length === 0) { await cabangStore.fetchCabang(); }
  cabangOptions.value = cabangStore.allCabang;
});

const handleCabangChange = () => {
  formData.store = null;
  storeOptions.value = [];
  if (formData.cabang) { fetchStores(''); }
};

const handleSourceChange = () => {
  formData.tanggal = null;
  errors.tanggal = '';
};

let searchTimeout = null;
const onStoreFilter = (event) => {
  const query = event.value;
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { fetchStores(query); }, 500);
};

function formatCode(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
}

const fetchStores = async (search = '') => {
  if (!formData.cabang) return;
  try {
    loadingStores.value = true;
    const response = await StoreService.getStoresByBranch(formData.cabang, { search, limit: 20, onlyInduk: true });
    const stores = response.data?.stores || [];
    const newOptions = stores.map(s => {
      const code = formatCode(s.storeCode);
      return {
        kdtk: code,
        label: `${code} - ${s.storeName}`
      };
    });
    if (formData.store) {
      const current = storeOptions.value.find(o => o.kdtk === formData.store);
      if (current && !newOptions.find(o => o.kdtk === current.kdtk)) { newOptions.unshift(current); }
    }
    storeOptions.value = newOptions;
  } catch (error) { console.error('Error fetching stores:', error); }
  finally { loadingStores.value = false; }
};

const validateForm = () => {
  let isValid = true;
  errors.cabang = ''; errors.store = ''; errors.bukti_no = ''; errors.source = ''; errors.tanggal = '';
  if (!formData.cabang) { errors.cabang = 'Cabang wajib dipilih'; isValid = false; }
  if (!formData.store) { errors.store = 'Toko wajib dipilih'; isValid = false; }
  if (!formData.bukti_no) { errors.bukti_no = 'Nomor Bukti wajib diisi'; isValid = false; }
  if (!formData.source) { errors.source = 'Sumber data wajib dipilih'; isValid = false; }
  if (formData.source === 'wrc' && !formData.tanggal) { errors.tanggal = 'Tanggal wajib diisi untuk sumber WRC'; isValid = false; }
  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;
  const payload = { cabang: formData.cabang, store: formData.store, bukti_no: formData.bukti_no, source: formData.source };
  if (formData.source === 'wrc' && formData.tanggal) {
    payload.tanggal = formData.tanggal.toISOString();
  }
  emit('process', payload);
};

const resetForm = () => {
  formData.cabang = ''; formData.store = null; formData.bukti_no = '';
  formData.source = 'store'; formData.tanggal = null;
  errors.cabang = ''; errors.store = ''; errors.bukti_no = ''; errors.source = ''; errors.tanggal = '';
  storeOptions.value = [];
};
</script>

<style scoped src="./CetakNrbForm.style.css"></style>
