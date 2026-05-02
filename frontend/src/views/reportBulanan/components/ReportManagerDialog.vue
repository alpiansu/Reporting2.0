<template>
  <Dialog
    :visible="visible"
    modal
    header="Kelola Konfigurasi Laporan"
    :style="{ width: '90vw', maxWidth: '1100px' }"
    :closable="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <!-- Header toolbar dalam dialog -->
    <div class="manager-toolbar">
      <div>
        <p class="text-color-secondary text-sm m-0">
          Tambah, edit, atau hapus konfigurasi laporan. Perubahan langsung tersimpan di file JSON server.
        </p>
      </div>
      <Button
        label="+ Tambah Laporan Baru"
        icon="pi pi-plus"
        class="p-button-success p-button-sm"
        @click="$emit('open-form', null)"
      />
    </div>

    <!-- DataTable -->
    <DataTable
      :value="reports"
      :loading="loading"
      responsive-layout="scroll"
      class="p-datatable-sm manager-table"
      empty-message="Belum ada laporan yang terdaftar."
      striped-rows
    >
      <!-- ID -->
      <Column header="ID Laporan" style="width: 22%; min-width: 180px">
        <template #body="{ data }">
          <code class="id-badge">{{ data['id-reports'] }}</code>
        </template>
      </Column>

      <!-- Nama -->
      <Column field="name-reports" header="Nama Laporan" style="width: 25%" />

      <!-- Query WRC -->
      <Column header="Query WRC" style="width: 10%; text-align: center">
        <template #body="{ data }">
          <Badge :value="String(data['queries-wrc']?.length || 0)" severity="info" />
        </template>
      </Column>

      <!-- Sheet Export -->
      <Column header="Sheet Export" style="width: 10%; text-align: center">
        <template #body="{ data }">
          <Badge :value="String(data['queries-export']?.length || 0)" severity="warning" />
        </template>
      </Column>

      <!-- Dibuat -->
      <Column header="Dibuat" style="width: 16%">
        <template #body="{ data }">
          <div class="audit-info">
            <span>{{ data['addtime'] }}</span>
            <small class="text-color-secondary">{{ data['addid'] }}</small>
          </div>
        </template>
      </Column>

      <!-- Diperbarui -->
      <Column header="Diperbarui" style="width: 16%">
        <template #body="{ data }">
          <div class="audit-info">
            <span>{{ data['updtime'] }}</span>
            <small class="text-color-secondary">{{ data['updid'] }}</small>
          </div>
        </template>
      </Column>

      <!-- Aksi -->
      <Column header="Aksi" style="width: 100px" :exportable="false">
        <template #body="{ data }">
          <div class="action-btns">
            <Button
              icon="pi pi-pencil"
              class="p-button-rounded p-button-text p-button-info p-0 w-2rem h-2rem"
              v-tooltip.top="'Edit laporan'"
              @click="$emit('open-form', data)"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-rounded p-button-text p-button-danger p-0 w-2rem h-2rem"
              v-tooltip.top="'Hapus laporan'"
              @click="$emit('delete-report', data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <template #footer>
      <Button
        label="Tutup"
        icon="pi pi-times"
        class="p-button-text p-button-secondary"
        @click="$emit('update:visible', false)"
      />
    </template>
  </Dialog>
</template>

<script setup>
import Dialog    from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column    from 'primevue/column';
import Button    from 'primevue/button';
import Badge     from 'primevue/badge';

defineProps({
  visible:  { type: Boolean, default: false },
  reports:  { type: Array,   default: () => [] },
  loading:  { type: Boolean, default: false },
});

defineEmits(['update:visible', 'open-form', 'delete-report', 'refresh']);
</script>

<style scoped>
.manager-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.id-badge {
  font-size: 0.78rem;
  background: var(--surface-100, #f8f9fa);
  border: 1px solid var(--surface-border, #dee2e6);
  border-radius: 4px;
  padding: 2px 6px;
  color: var(--primary-color, #4472c4);
  word-break: break-all;
  display: block;
  max-width: 200px;
}

.audit-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.82rem;
}

.action-btns {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

:deep(.manager-table .p-datatable-thead th) {
  font-size: 0.82rem;
  font-weight: 700;
  background: var(--surface-50, #f8f9fa);
}
</style>
