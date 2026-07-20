<template>
  <div class="report-list card">
    <!-- Header panel -->
    <div class="report-list__header">
      <div class="report-list__title-wrap">
        <h4 class="report-list__title">
          <i class="pi pi-list mr-2 text-primary" />
          Pilih Laporan
        </h4>
        <Badge
          v-if="selectedIds.length > 0"
          :value="`${selectedIds.length} dipilih`"
          severity="success"
          class="ml-2"
        />
      </div>
      <div class="report-list__header-right">
        <small class="text-color-secondary">Centang laporan yang ingin diekspor</small>
        <Button
          icon="pi pi-refresh"
          :class="['p-button-text p-button-sm p-button-secondary refresh-btn', { 'spinning': loading }]"
          v-tooltip.top="'Muat ulang daftar laporan'"
          :disabled="loading || disabled"
          @click="$emit('refresh')"
        />
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="report-list__skeleton">
      <Skeleton v-for="i in 3" :key="i" height="3rem" class="mb-2" border-radius="8px" />
    </div>

    <!-- Empty state -->
    <div v-else-if="reports.length === 0" class="report-list__empty">
      <i class="pi pi-inbox text-4xl text-color-secondary mb-3" />
      <p class="font-semibold">Belum ada laporan terdaftar</p>
      <p class="text-sm text-color-secondary">
        Klik <strong>Kelola Laporan</strong> di panel atas untuk menambahkan laporan baru.
      </p>
    </div>

    <!-- Checklist items -->
    <template v-else>
      <!-- Search bar -->
      <div class="report-list__search">
        <IconField>
          <InputIcon><i class="pi pi-search" /></InputIcon>
          <InputText
            v-model="searchQuery"
            placeholder="Cari laporan..."
            class="w-full"
            :disabled="disabled"
          />
        </IconField>
        <small v-if="searchQuery" class="text-color-secondary">
          {{ filteredReports.length }} dari {{ reports.length }} laporan
        </small>
      </div>

      <div class="report-list__items">
        <div
          v-if="filteredReports.length === 0"
          class="report-list__no-result"
        >
          <i class="pi pi-search text-2xl text-color-secondary mb-2" />
          <p class="text-sm text-color-secondary">Tidak ada laporan yang cocok</p>
        </div>
        <div
          v-for="report in filteredReports"
          :key="report['id-reports']"
          class="report-item"
          :class="{
            'report-item--selected': isSelected(report['id-reports']),
            'report-item--disabled': disabled
          }"
          @click="!disabled && toggleSelect(report['id-reports'])"
        >
          <Checkbox
            :model-value="isSelected(report['id-reports'])"
            :binary="true"
            :disabled="disabled"
            @click.stop
            @change="toggleSelect(report['id-reports'])"
            class="report-item__checkbox"
          />
          <div class="report-item__info">
            <span class="report-item__name">{{ report['name-reports'] }}</span>
            <span class="report-item__meta">
              {{ report['queries-export']?.length || 0 }} sheet
              &bull;
              {{ report['queries-wrc']?.length || 0 }} query WRC
            </span>
          </div>
          <i
            v-if="isSelected(report['id-reports'])"
            class="pi pi-check-circle text-green-500 text-xl"
          />
        </div>
      </div>

      <!-- Select all / clear -->
      <div class="report-list__footer">
        <Button
          :label="allSelected ? 'Batal Pilih Semua' : 'Pilih Semua'"
          class="p-button-text p-button-sm"
          :icon="allSelected ? 'pi pi-minus-square' : 'pi pi-check-square'"
          @click="allSelected ? clearAll() : selectAll()"
          :disabled="disabled || reports.length === 0"
        />
        <Button
          label="Hapus Pilihan"
          class="p-button-text p-button-secondary p-button-sm"
          icon="pi pi-times"
          @click="clearAll"
          :disabled="disabled || selectedIds.length === 0"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Checkbox from 'primevue/checkbox';
import Badge    from 'primevue/badge';
import Button   from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';

const props = defineProps({
  reports:     { type: Array,   default: () => [] },
  loading:     { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
  selectedIds: { type: Array,   default: () => [] },
});

const emit = defineEmits(['update:selectedIds', 'refresh']);

const searchQuery = ref('');

watch(() => props.reports, () => {
  searchQuery.value = '';
});

const filteredReports = computed(() => {
  if (!searchQuery.value.trim()) return props.reports;
  const q = searchQuery.value.toLowerCase();
  return props.reports.filter(r =>
    r['name-reports']?.toLowerCase().includes(q)
  );
});

const allSelected = computed(() =>
  props.reports.length > 0 && props.selectedIds.length === props.reports.length
);

const isSelected = (id) => props.selectedIds.includes(id);

const toggleSelect = (id) => {
  const current = [...props.selectedIds];
  const idx = current.indexOf(id);
  if (idx === -1) {
    current.push(id);
  } else {
    current.splice(idx, 1);
  }
  emit('update:selectedIds', current);
};

const selectAll = () => {
  emit('update:selectedIds', props.reports.map(r => r['id-reports']));
};

const clearAll = () => {
  emit('update:selectedIds', []);
};
</script>

<style scoped>
.report-list {
  background: var(--surface-card, #fff);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--surface-border, #e9ecef);
}

.report-list__header {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  margin-bottom: 1rem;
}

.report-list__header-right {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.refresh-btn {
  transition: transform 0.5s ease;
}

.refresh-btn.spinning :deep(.p-button-icon) {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.report-list__title-wrap {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
}

.report-list__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  color: var(--text-color, #212529);
}

/* ─── Loading ─── */
.report-list__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ─── Empty ─── */
.report-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-color-secondary, #6c757d);
}

/* ─── Items ─── */
.report-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.report-list__items:has(.report-item--disabled) {
  opacity: 0.55;
  pointer-events: none;
}

.report-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  border: 1.5px solid var(--surface-border, #dee2e6);
  cursor: pointer;
  transition: border-color 0.18s, background-color 0.18s, box-shadow 0.18s;
  user-select: none;
}

.report-item:hover {
  border-color: var(--primary-color, #4472c4);
  background-color: var(--primary-50, #f0f4ff);
}

.report-item--selected {
  border-color: var(--primary-color, #4472c4);
  background-color: var(--primary-50, #f0f4ff);
  box-shadow: 0 0 0 3px rgba(68, 114, 196, 0.12);
}

.report-item__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.2rem;
}

.report-item__name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-color, #212529);
}

.report-item__meta {
  font-size: 0.775rem;
  color: var(--text-color-secondary, #6c757d);
}

/* ─── Footer ─── */
.report-list__footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--surface-border, #e9ecef);
}

/* ─── Search ─── */
.report-list__search {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

/* ─── No Result ─── */
.report-list__no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
  text-align: center;
}
</style>
