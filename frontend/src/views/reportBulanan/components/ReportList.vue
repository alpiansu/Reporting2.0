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
      <small class="text-color-secondary">Centang laporan yang ingin diekspor ke Excel</small>
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
    <div v-else class="report-list__items">
      <div
        v-for="report in reports"
        :key="report['id-reports']"
        class="report-item"
        :class="{ 'report-item--selected': isSelected(report['id-reports']) }"
        @click="toggleSelect(report['id-reports'])"
      >
        <Checkbox
          :model-value="isSelected(report['id-reports'])"
          :binary="true"
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
    <div v-if="reports.length > 0" class="report-list__footer">
      <Button
        label="Pilih Semua"
        class="p-button-text p-button-sm"
        icon="pi pi-check-square"
        @click="selectAll"
        :disabled="selectedIds.length === reports.length"
      />
      <Button
        label="Hapus Pilihan"
        class="p-button-text p-button-secondary p-button-sm"
        icon="pi pi-times"
        @click="clearAll"
        :disabled="selectedIds.length === 0"
      />
    </div>
  </div>
</template>

<script setup>
import Checkbox from 'primevue/checkbox';
import Badge    from 'primevue/badge';
import Button   from 'primevue/button';
import Skeleton from 'primevue/skeleton';

const props = defineProps({
  reports:     { type: Array,   default: () => [] },
  loading:     { type: Boolean, default: false },
  selectedIds: { type: Array,   default: () => [] },
});

const emit = defineEmits(['update:selectedIds']);

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
  margin-bottom: 1rem;
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
</style>
