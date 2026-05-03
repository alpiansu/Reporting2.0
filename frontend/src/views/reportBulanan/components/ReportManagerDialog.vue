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
        label="Tambah Laporan Baru"
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
      v-model:filters="filters"
      :globalFilterFields="['name-reports', 'addid', 'updid']"
    >

      <template #header>
        <div class="flex justify-content-end">
          <IconField>
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText v-model="filters['global'].value" placeholder="Cari Laporan" />
          </IconField>
        </div>
      </template>
      <!-- Nama -->
      <Column field="name-reports" header="Nama Laporan" sortable style="width: 30%; min-width: 200px" />

      <!-- Query WRC -->
      <Column header="Query WRC" style="width: 12%; min-width: 100px; text-align: center">
        <template #body="{ data }">
          <div class="badge-center">
            <Badge :value="String(data['queries-wrc']?.length || 0)" severity="info" />
          </div>
        </template>
      </Column>

      <!-- Sheet Export -->
      <Column header="Sheet Export" style="width: 12%; min-width: 110px; text-align: center">
        <template #body="{ data }">
          <div class="badge-center">
            <Badge :value="String(data['queries-export']?.length || 0)" severity="warning" />
          </div>
        </template>
      </Column>

      <!-- Dibuat -->
      <Column header="Dibuat" style="width: 20%; min-width: 160px">
        <template #body="{ data }">
          <div class="audit-card">
            <div class="audit-date">
              <i class="pi pi-calendar audit-icon" />
              <span>{{ data['addtime'] }}</span>
            </div>
            <div class="audit-user">
              <i class="pi pi-user audit-icon" />
              <span class="audit-user-label">{{ data['addid'] }}</span>
            </div>
          </div>
        </template>
      </Column>

      <!-- Diperbarui -->
      <Column header="Diperbarui" style="width: 20%; min-width: 160px">
        <template #body="{ data }">
          <div class="audit-card audit-card--update">
            <div class="audit-date">
              <i class="pi pi-refresh audit-icon" />
              <span>{{ data['updtime'] }}</span>
            </div>
            <div class="audit-user">
              <i class="pi pi-user audit-icon" />
              <span class="audit-user-label">{{ data['updid'] }}</span>
            </div>
          </div>
        </template>
      </Column>

      <!-- Aksi -->
      <Column header="Aksi" style="width: 6%; min-width: 80px" :exportable="false">
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
import { ref } from 'vue';
import Dialog    from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column    from 'primevue/column';

defineProps({
  visible:  { type: Boolean, default: false },
  reports:  { type: Array,   default: () => [] },
  loading:  { type: Boolean, default: false },
});

defineEmits(['update:visible', 'open-form', 'delete-report', 'refresh']);

const filters = ref({
    'global': { value: null, matchMode: 'contains' },
    'name-reports': { value: null, matchMode: 'contains' },
    'addid': { value: null, matchMode: 'contains' },
    'updid': { value: null, matchMode: 'contains' },
});
</script>

<style scoped>
.manager-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

/* ── Badge center alignment ── */
.badge-center {
  display: flex;
  justify-content: center;
}

/* ── Audit card (Dibuat & Diperbarui) ── */
.audit-card {
  display: inline-flex;
  flex-direction: column;
  gap: 0.3rem;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  font-size: 0.78rem;
  min-width: 140px;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}

.audit-card:hover {
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.18);
  transform: translateY(-1px);
}

/* Diperbarui pakai palet hijau agar mudah dibedakan */
.audit-card--update {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #bbf7d0;
}

.audit-card--update:hover {
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.18);
}

.audit-date,
.audit-user {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #374151;
  line-height: 1.3;
}

.audit-icon {
  font-size: 0.72rem;
  opacity: 0.6;
  flex-shrink: 0;
}

.audit-date span {
  font-weight: 600;
  letter-spacing: 0.01em;
}

.audit-user-label {
  font-size: 0.72rem;
  color: #6b7280;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

/* ── Aksi ── */
.action-btns {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

/* ── Table header ── */
:deep(.manager-table .p-datatable-thead th) {
  font-size: 0.82rem;
  font-weight: 700;
  background: var(--surface-50, #f8f9fa);
}
</style>