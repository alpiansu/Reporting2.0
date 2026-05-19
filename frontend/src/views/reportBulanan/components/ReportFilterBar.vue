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
        label="Kelola Laporan"
        icon="pi pi-cog"
        class="p-button-outlined p-button-secondary"
        @click="$emit('open-manager')"
      />
    </div>

    <div class="filter-bar__fields">
      <!-- Pilihan Cabang -->
      <div class="field">
        <label for="mr-cabang" class="field-label">
          Cabang <span class="text-red-500">*</span>
        </label>
        <Dropdown
          id="mr-cabang"
          :model-value="cabang"
          :options="cabangOptions"
          option-label="namacab"
          option-value="kdcab"
          placeholder="Pilih Cabang"
          class="w-full"
          :disabled="isExporting"
          filter
          filter-placeholder="Cari cabang..."
          @change="$emit('update:cabang', $event.value)"
        />
        <small v-if="!cabang" class="p-error">Cabang wajib dipilih</small>
      </div>

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
          :icon="isExporting ? 'pi pi-spin pi-spinner' : 'pi pi-file-excel'"
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
import { useCabangStore } from '@/stores';

const props = defineProps({
  cabang:        { type: String,  default: '' },
  periode:       { type: String,  default: '' },
  selectedDate:  { type: Date,    default: null },
  selectedCount: { type: Number,  default: 0 },
  isExporting:   { type: Boolean, default: false },
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

<style scoped>
.filter-bar {
  background: var(--surface-card, #fff);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--surface-border, #e9ecef);
}

.filter-bar__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.filter-bar__title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  color: var(--text-color, #212529);
}

.filter-bar__subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-color-secondary, #6c757d);
}

.filter-bar__fields {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 200px;
}

.field--action {
  flex: 0 0 auto;
  min-width: 200px;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color, #212529);
}

.field-label--spacer {
  visibility: hidden;
}

.helper-text {
  font-size: 0.75rem;
  color: var(--text-color-secondary, #6c757d);
}

.export-btn {
  width: 100%;
}

:deep(.p-dropdown),
:deep(.p-calendar) {
  width: 100%;
}

@media (max-width: 768px) {
  .filter-bar__header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .filter-bar__fields {
    flex-direction: column;
  }

  .field,
  .field--action {
    min-width: unset;
    width: 100%;
  }
}
</style>
