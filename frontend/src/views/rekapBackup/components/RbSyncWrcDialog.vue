<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: '420px' }"
    :closable="true"
    class="sync-wrc-dialog"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex align-items-center gap-3">
        <div class="dialog-header-icon">
          <i class="pi pi-sync text-lg"></i>
        </div>
        <div class="flex flex-column">
          <span class="font-bold text-900" style="font-size: 1rem; line-height: 1.3;">Manual Sync WRC</span>
          <span class="text-500" style="font-size: 0.78rem;">Sinkronisasi data toko aktif secara manual</span>
        </div>
      </div>
    </template>

    <div class="sync-dialog-body">
      <div class="sync-info-banner">
        <i class="pi pi-info-circle"></i>
        <p>Gunakan fitur ini hanya jika jumlah toko aktif untuk cabang/periode tertentu belum diperbarui secara otomatis.</p>
      </div>

      <div class="sync-form-row">
        <label class="sync-form-label">Cabang</label>
        <Dropdown
          v-model="form.cabang"
          :options="cabangOptions"
          option-label="namacab"
          option-value="kdcab"
          placeholder="Pilih Cabang"
          class="sync-dropdown"
          filter
          filter-placeholder="Cari cabang..."
        />
      </div>

      <div class="sync-form-row">
        <label class="sync-form-label">Periode</label>
        <InputText
          v-model="form.periode"
          placeholder="YYYYMM — Contoh: 202401"
          class="sync-form-input"
        />
        <small class="sync-helper">Format: 6 digit tahun bulan (misal: 202501 = Januari 2025)</small>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Batal"
          icon="pi pi-times"
          class="p-button-text p-button-secondary"
          @click="$emit('update:visible', false)"
        />
        <Button
          label="Mulai Sinkronisasi"
          icon="pi pi-sync"
          class="p-button-primary footer-submit-btn"
          :loading="loading"
          @click="handleSubmit"
          autofocus
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dropdown from 'primevue/dropdown';
import { useCabangStore } from '@/stores';

const props = defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['update:visible', 'submit']);

const cabangStore = useCabangStore();
const cabangOptions = computed(() => cabangStore.allCabang || []);

const form = ref({ cabang: null, periode: '' });

const handleSubmit = () => {
  emit('submit', { cabang: form.value.cabang, periode: form.value.periode });
};

// Reset form when dialog closes
watch(() => props.visible, (val) => {
  if (!val) setTimeout(() => { form.value = { cabang: null, periode: '' }; }, 300);
});
</script>

<style scoped>
.sync-dialog-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.sync-info-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
  border-radius: 0 8px 8px 0;
}

.sync-info-banner i {
  color: #3b82f6;
  font-size: 1rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.sync-info-banner p {
  margin: 0;
  font-size: 0.825rem;
  color: #1e40af;
  line-height: 1.6;
}

.sync-form-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.sync-form-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.sync-dropdown,
.sync-form-input {
  width: 100% !important;
  height: 40px;
  border-radius: 8px !important;
  border: 1.5px solid #e2e8f0 !important;
  background: #f8fafc !important;
  font-size: 0.875rem !important;
}

:deep(.sync-dropdown.p-dropdown) {
  height: 40px;
  align-items: center;
}

.sync-helper {
  font-size: 0.72rem;
  color: #94a3b8;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 0.25rem 0;
}

.footer-submit-btn {
  height: 40px;
  border-radius: 8px;
  font-weight: 600;
  padding: 0 1.25rem;
}

:deep(.sync-wrc-dialog .p-dialog-header) {
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #f1f5f9;
}

:deep(.sync-wrc-dialog .p-dialog-content) {
  padding: 0;
}

:deep(.sync-wrc-dialog .p-dialog-footer) {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f1f5f9;
  background: #fafafa;
}
</style>
