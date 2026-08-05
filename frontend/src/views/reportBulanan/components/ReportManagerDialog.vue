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
              <span class="audit-user-label">{{ data['addname'] }}</span>
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
              <span class="audit-user-label">{{ data['updname'] }}</span>
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
    'addname': { value: null, matchMode: 'contains' },
    'updname': { value: null, matchMode: 'contains' },
});
</script>

<style scoped src="./ReportManagerDialog.style.css"></style>