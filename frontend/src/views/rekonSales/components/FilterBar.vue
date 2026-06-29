<template>
  <div class="filter-bar">
    <div class="field">
      <label>Cabang</label>
      <Dropdown v-model="localCabang" :options="cabangOptions" optionLabel="namacab" optionValue="kdcab"
        placeholder="Pilih Cabang" class="w-full" :disabled="loading" />
    </div>
    <div class="field">
      <label>Periode</label>
      <Calendar v-model="periodeDate" view="month" dateFormat="mm/yy" placeholder="Pilih Bulan/Tahun" :maxDate="today"
        showIcon appendTo="body" class="w-full" @date-select="emitMonthYear" :disabled="loading" />
    </div>
    <div class="actions">
      <Button icon="pi pi-refresh" label="Refresh" class="p-button-outlined" @click="emitRefresh" :disabled="loading" />
      <Button icon="pi pi-bolt" :label="loading ? 'Please Wait...' : 'Mulai Screening'" class="p-button-success"
        :loading="loading" :disabled="loading" @click="emitStart" />
    </div>
    <div class="force-toggle">
      <Checkbox v-model="forceScreening" inputId="forceScreeningRekonSales" :binary="true" :disabled="loading" />
      <label for="forceScreeningRekonSales" class="ml-2 text-sm text-color-secondary">
        <i class="pi pi-exclamation-triangle mr-1 text-yellow-500"></i>
        Force Re-screen (ulang meskipun sudah sukses hari ini)
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';

const props = defineProps({
  cabang: { type: String, default: 'All' },
  month: { type: String, default: '' },
  year: { type: String, default: '' },
  cabangOptions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['update:cabang', 'update:month', 'update:year', 'refresh', 'start-screening']);

const localCabang = ref(props.cabang);
const today = ref(new Date());
const periodeDate = ref(new Date());
const forceScreening = ref(false);

const emitMonthYear = () => {
  const month = String(periodeDate.value.getMonth() + 1).padStart(2, '0');
  const year = String(periodeDate.value.getFullYear());
  emit('update:month', month);
  emit('update:year', year);
};

const emitRefresh = () => emit('refresh');
const emitStart = () => emit('start-screening', { force: forceScreening.value });

watch(localCabang, (newVal, oldVal) => { if (oldVal !== undefined && newVal !== oldVal) emit('update:cabang', newVal); });
watch(periodeDate, (newVal, oldVal) => { if (oldVal !== undefined && newVal !== oldVal) emitMonthYear(); });
onMounted(() => {
  localCabang.value = props.cabang;
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

<style scoped>
.filter-bar { display: grid; grid-template-columns: 1fr 1fr auto; gap: 1rem; align-items: end; }
.field label { display: block; font-weight: 600; font-size: .85rem; color: var(--text-color); margin-bottom: .25rem; }
.actions { display: flex; gap: .5rem; align-items: end; justify-content: flex-end; }
.force-toggle { grid-column: 1 / -1; display: flex; align-items: center; margin-top: -0.25rem; }
</style>
