<template>
  <div class="filter-bar card">
    <div class="filter-bar__fields">
      <!-- Tahun Awal -->
      <div class="field">
        <label class="field-label">Tahun Awal</label>
        <Dropdown
          :model-value="startYear"
          :options="startYearOptions"
          placeholder="Semua Tahun"
          class="w-full"
          @change="$emit('update:startYear', $event.value)"
        />
      </div>

      <!-- Tahun Akhir -->
      <div class="field">
        <label class="field-label">Tahun Akhir</label>
        <Dropdown
          :model-value="endYear"
          :options="startYear !== 'All' ? endYearOptions : []"
          placeholder="Tahun Akhir"
          :disabled="startYear === 'All'"
          class="w-full"
          @change="$emit('update:endYear', $event.value)"
        />
      </div>

      <!-- Cabang -->
      <div class="field">
        <label class="field-label">Cabang Export</label>
        <Dropdown
          :model-value="cabang"
          :options="cabangOptions"
          option-label="namacab"
          option-value="kdcab"
          placeholder="Semua Cabang"
          class="w-full"
          filter
          filter-placeholder="Cari cabang..."
          show-clear
          @change="$emit('update:cabang', $event.value)"
        />
      </div>

      <!-- Action Buttons -->
      <div class="field field--action">
        <label class="field-label field-label--spacer">&nbsp;</label>
        <div class="action-row">
          <Button
            label="Export Excel"
            icon="pi pi-file-excel"
            class="p-button-success export-btn"
            :loading="isExporting"
            v-tooltip.bottom="'Unduh laporan dalam format Excel'"
            @click="$emit('export-clicked')"
          />
          <Button
            icon="pi pi-sync"
            class="p-button-outlined p-button-secondary sync-btn"
            v-tooltip.bottom="'Manual sync data toko aktif WRC'"
            @click="$emit('sync-clicked')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import { useCabangStore } from '@/stores';

const props = defineProps({
  startYear:   { type: String, default: 'All' },
  endYear:     { type: String, default: '' },
  cabang:      { type: String, default: null },
  isExporting: { type: Boolean, default: false },
  startYearOptions: { type: Array, default: () => ['All'] },
  endYearOptions:   { type: Array, default: () => [] },
});

defineEmits([
  'update:startYear',
  'update:endYear',
  'update:cabang',
  'export-clicked',
  'sync-clicked',
]);

const cabangStore = useCabangStore();
const cabangOptions = computed(() => cabangStore.allCabang || []);
</script>

<style scoped>
.filter-bar {
  background: var(--surface-card, #fff);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--surface-border, #e9ecef);
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
  gap: 0.375rem;
  flex: 1;
  min-width: 160px;
}

.field--action {
  flex: 0 0 auto;
}

.field-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  white-space: nowrap;
}

.field-label--spacer {
  visibility: hidden;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  height: 40px;
}

.export-btn {
  height: 40px;
  border-radius: 8px;
  font-weight: 600;
  padding: 0 1.25rem;
  white-space: nowrap;
}

.sync-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px !important;
  flex-shrink: 0;
}

:deep(.p-dropdown) {
  height: 40px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  align-items: center;
}

:deep(.p-dropdown .p-dropdown-label) {
  font-size: 0.875rem;
  color: #334155;
}

:deep(.p-dropdown.p-disabled) {
  opacity: 0.5;
}

@media (max-width: 768px) {
  .filter-bar__fields {
    flex-direction: column;
  }

  .field {
    min-width: unset;
    width: 100%;
  }

  .action-row {
    width: 100%;
  }

  .export-btn {
    flex: 1;
  }
}
</style>
