<template>
  <div class="filter-bar">
    <div class="filter-bar__header">
      <div>
        <h4 class="filter-bar__title">
          <i class="pi pi-sliders-h mr-2 text-primary" />
          Parameter Screening
        </h4>
        <p class="filter-bar__subtitle">Pilih cabang, periode, dan toko yang ingin discreening</p>
      </div>
    </div>

    <div class="filter-bar__fields">
      <div class="field">
        <label class="field-label">
          <i class="pi pi-building mr-1" />
          Cabang
        </label>
        <Dropdown v-model="localCabang" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab"
          placeholder="Pilih Cabang" class="w-full" :disabled="loading" />
      </div>

      <div class="field">
        <label class="field-label">
          <i class="pi pi-calendar mr-1" />
          Periode
        </label>
        <Calendar v-model="periodeDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun" :maxDate="today"
          showIcon appendTo="body" class="w-full" @date-select="emitMonthYear" :disabled="loading" />
      </div>

      <div class="field">
        <label class="field-label">
          <i class="pi pi-tag mr-1" />
          Toko <span class="label-optional">(Opsional)</span>
        </label>
        <MultiSelect 
          v-model="localShops" 
          :options="storeOptions" 
          optionLabel="label" 
          optionValue="kdtk"
          placeholder="Ketik untuk mencari toko..." 
          class="w-full"
          :disabled="loading || !localCabang || localCabang === 'All'"
          :loading="loadingStores"
          filter
          :autoFilter="false"
          @filter="onStoreFilter"
          :showClear="true"
          :maxSelectedLabels="3"
        />
        <small class="helper-text">Kosongkan untuk semua toko di cabang.</small>
      </div>

      <div class="field field--action">
        <label class="field-label field-label--spacer">&nbsp;</label>
        <div class="actions-row">
          <Button icon="pi pi-refresh" label="Refresh" class="p-button-outlined action-btn" @click="emitRefresh" :disabled="loading" />
          <Button icon="pi pi-bolt" :label="loading ? 'Processing...' : 'Mulai Screening'" class="p-button-success action-btn action-btn--primary"
            :loading="loading" :disabled="loading" @click="emitStart" />
        </div>
      </div>
    </div>

    <div class="filter-bar__footer">
      <div class="force-toggle">
        <Checkbox v-model="forceScreening" inputId="forceScreeningRekonSales" :binary="true" :disabled="loading" />
        <label for="forceScreeningRekonSales" class="force-toggle__label">
          <i class="pi pi-exclamation-triangle mr-1 text-yellow-500" />
          Force Re-screen (ulang meskipun sudah sukses hari ini)
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import MultiSelect from 'primevue/multiselect';
import StoreService from '@/services/store.service';
import { useToastService } from '@/utils/toast';

const toast = useToastService();

const props = defineProps({
  cabang: { type: String, default: 'All' },
  month: { type: String, default: '' },
  year: { type: String, default: '' },
  cabangOptions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  shops: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:cabang', 'update:month', 'update:year', 'update:shops', 'refresh', 'start-screening']);

const localCabang = ref(props.cabang);
const localShops = ref([...props.shops]);
const today = ref(new Date());
const periodeDate = ref(new Date());
const forceScreening = ref(false);
const storeOptions = ref([]);
const loadingStores = ref(false);

const emitMonthYear = () => {
  const month = String(periodeDate.value.getMonth() + 1).padStart(2, '0');
  const year = String(periodeDate.value.getFullYear());
  emit('update:month', month);
  emit('update:year', year);
};

const emitRefresh = () => emit('refresh');
const emitStart = () => emit('start-screening', { force: forceScreening.value, shops: localShops.value });

watch(localCabang, (newVal, oldVal) => { 
  if (oldVal !== undefined && newVal !== oldVal) {
    emit('update:cabang', newVal);
    localShops.value = [];
    storeOptions.value = [];
  }
});
watch(localShops, (newVal) => {
  emit('update:shops', newVal);
});
watch(periodeDate, (newVal, oldVal) => { if (oldVal !== undefined && newVal !== oldVal) emitMonthYear(); });

let filterTimeout = null;
const onStoreFilter = (event) => {
  const query = event.value;
  if (filterTimeout) clearTimeout(filterTimeout);
  if (query && query.length >= 2) {
    filterTimeout = setTimeout(() => fetchStores(query), 500);
  }
};

const fetchStores = async (search = '') => {
  if (!localCabang.value || localCabang.value === 'All') return;
  try {
    loadingStores.value = true;
    const response = await StoreService.getStoresByBranch(localCabang.value, { 
      limit: 20, 
      onlyInduk: true,
      search: search.trim()
    });
    const stores = response.data?.stores || [];
    const newOptions = stores.map(s => ({
      kdtk: s.storeCode,
      label: `${s.storeCode} - ${s.storeName}`
    }));
    const currentSelected = storeOptions.value.filter(opt => (localShops.value || []).includes(opt.kdtk));
    const uniqueOptionsMap = new Map();
    [...currentSelected, ...newOptions].forEach(opt => {
      uniqueOptionsMap.set(opt.kdtk, opt);
    });
    storeOptions.value = Array.from(uniqueOptionsMap.values());
  } catch (error) {
    console.error('Error fetching stores:', error);
    toast.showError('Error', 'Gagal memuat data toko');
  } finally {
    loadingStores.value = false;
  }
};

onMounted(() => {
  localCabang.value = props.cabang;
  localShops.value = [...props.shops];
  if (props.year && props.month) {
    const y = Number(props.year);
    const m = Number(props.month) - 1;
    const d = new Date(); d.setFullYear(y); d.setMonth(m); d.setDate(1);
    periodeDate.value = d;
  } else {
    periodeDate.value = new Date();
  }
  emit('update:cabang', localCabang.value);
  emitMonthYear();
});
</script>

<style scoped src="./FilterBar.style.css"></style>
