<template>
  <div class="filter-bar card">
    <div class="filter-bar__header">
      <div>
        <h4 class="filter-bar__title">
          <i class="pi pi-sliders-h mr-2 text-primary" />
          Parameter Laporan
        </h4>
        <p class="filter-bar__subtitle">Pilih cabang dan periode sebelum mengekspor laporan</p>
      </div>
      <Button
        v-if="showManagerButton"
        label="Kelola Laporan"
        icon="pi pi-cog"
        class="p-button-outlined p-button-secondary"
        @click="$emit('open-manager')"
      />
    </div>

    <div class="filter-bar__fields">
      <!-- Pilihan Cabang -->
      <CabangSelect
        :model-value="cabang"
        :options="cabangOptions"
        :disabled="isExporting"
        show-error
        @update:model-value="$emit('update:cabang', $event)"
      />

      <!-- Picker Periode (Month only) -->
      <div class="field">
        <label for="mr-periode" class="field-label">
          Periode <span class="text-red-500">*</span>
        </label>
        <Calendar
          id="mr-periode"
          :model-value="selectedDate"
          view="month"
          date-format="MM yy"
          placeholder="Pilih Bulan / Tahun"
          :show-icon="true"
          :max-date="today"
          class="w-full"
          :disabled="isExporting"
          @date-select="onDateSelect"
        />
        <small class="helper-text">Format yang dikirim: YYMM (contoh: 2501 = Januari 2025)</small>
      </div>

      <!-- Tombol Export -->
      <div class="field field--action">
        <label class="field-label field-label--spacer">&nbsp;</label>
        <Button
          :label="isExporting ? 'Memproses...' : `Export Laporan${selectedCount > 0 ? ` (${selectedCount})` : ''}`"
          :icon="isExporting ? 'pi pi-spin pi-spinner' : 'pi pi-download'"
          class="p-button-success export-btn"
          :disabled="isButtonDisabled"
          @click="$emit('export-clicked')"
        />
        <small v-if="selectedCount === 0" class="helper-text text-orange-500">
          Centang minimal 1 laporan terlebih dahulu
        </small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import CabangSelect from './CabangSelect.vue';
import { useCabangStore } from '@/stores';

const props = defineProps({
  cabang:        { type: String,  default: '' },
  periode:       { type: String,  default: '' },
  selectedDate:  { type: Date,    default: null },
  selectedCount: { type: Number,  default: 0 },
  isExporting:   { type: Boolean, default: false },
  showManagerButton: { type: Boolean, default: true },
});

const emit = defineEmits([
  'update:cabang',
  'update:periode',
  'update:selectedDate',
  'export-clicked',
  'open-manager',
]);

const today = ref(new Date());
const cabangStore = useCabangStore();

// Load cabang dari store (sudah di-fetch di app level)
const cabangOptions = computed(() => cabangStore.allCabang || []);

// Validasi: apakah periode YYMM 4 digit valid
const isPeriodeValid = computed(() => /^\d{4}$/.test(props.periode));

const isButtonDisabled = computed(() =>
  !props.cabang ||
  !isPeriodeValid.value ||
  props.selectedCount === 0 ||
  props.isExporting
);

// Saat user pilih bulan di Calendar → konversi ke YYMM
const onDateSelect = (date) => {
  emit('update:selectedDate', date);
  if (date) {
    const yy = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    emit('update:periode', yy + mm);
  }
};
</script>

<style scoped src="./ReportFilterBar.style.css"></style>
