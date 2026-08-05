<template>
  <div class="filter-bar card">
    <div class="filter-bar__fields">
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
            class="p-button-outlined p-button-info sync-btn"
            v-tooltip.bottom="'Sinkronisasi data JSON ke database'"
            @click="$emit('staging-sync-clicked')"
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
  startYear:        { type: String,  default: 'All' },
  endYear:          { type: String,  default: '' },
  cabang:           { type: String,  default: null },
  isExporting:      { type: Boolean, default: false },
  startYearOptions: { type: Array,   default: () => ['All'] },
  endYearOptions:   { type: Array,   default: () => [] },
});

defineEmits([
  'update:startYear',
  'update:endYear',
  'update:cabang',
  'export-clicked',
  'staging-sync-clicked',
]);

const cabangStore = useCabangStore();
const cabangOptions = computed(() => cabangStore.allCabang || []);
</script>

<style scoped src="./RbFilterBar.style.css"></style>
