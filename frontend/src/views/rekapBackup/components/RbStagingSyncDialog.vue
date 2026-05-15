<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: '420px' }"
    :closable="!loading"
    class="staging-sync-dialog"
    @update:visible="!loading && $emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex align-items-center gap-3">
        <div class="dialog-icon-wrap">
          <i class="pi pi-database text-lg"></i>
        </div>
        <div class="flex flex-column gap-1">
          <span class="dialog-title">Sinkronisasi Data</span>
          <span class="dialog-subtitle">JSON Staging → Database</span>
        </div>
      </div>
    </template>

    <div class="dialog-body">
      <!-- Info Banner -->
      <div class="info-banner">
        <i class="pi pi-info-circle"></i>
        <div>
          <p class="info-title">Proses ini akan:</p>
          <ul class="info-list">
            <li>Membaca seluruh file JSON staging backup harian & bulanan</li>
            <li>Menyinkronkan data ke database secara menyeluruh</li>
            <li>Memperbarui jumlah toko aktif jika nilainya belum terisi</li>
          </ul>
        </div>
      </div>

      <!-- Warning -->
      <div class="warning-banner">
        <i class="pi pi-exclamation-triangle"></i>
        <p>Proses ini mungkin memerlukan waktu beberapa saat tergantung volume data. Jangan tutup halaman selama proses berlangsung.</p>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Batal"
          icon="pi pi-times"
          class="p-button-text p-button-secondary"
          :disabled="loading"
          @click="$emit('update:visible', false)"
        />
        <Button
          label="Ya, Sinkronkan Sekarang"
          icon="pi pi-database"
          class="p-button-info footer-confirm-btn"
          :loading="loading"
          @click="$emit('confirm')"
          autofocus
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});

defineEmits(['update:visible', 'confirm']);
</script>

<style scoped>
:deep(.staging-sync-dialog .p-dialog-header) {
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #f1f5f9;
}

:deep(.staging-sync-dialog .p-dialog-content) {
  padding: 0;
}

:deep(.staging-sync-dialog .p-dialog-footer) {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f1f5f9;
  background: #fafafa;
}

.dialog-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #0ea5e9;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

.dialog-subtitle {
  font-size: 0.78rem;
  color: #94a3b8;
}

.dialog-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* Info banner */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #f0f9ff;
  border-left: 3px solid #0ea5e9;
  border-radius: 0 8px 8px 0;
}

.info-banner > .pi {
  color: #0ea5e9;
  font-size: 1rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.info-title {
  margin: 0 0 0.4rem;
  font-size: 0.825rem;
  font-weight: 700;
  color: #0c4a6e;
}

.info-list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  color: #075985;
  line-height: 1.7;
}

/* Warning banner */
.warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  border-radius: 0 8px 8px 0;
}

.warning-banner > .pi {
  color: #f59e0b;
  font-size: 0.9rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.warning-banner p {
  margin: 0;
  font-size: 0.8rem;
  color: #78350f;
  line-height: 1.6;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.625rem;
}

.footer-confirm-btn {
  height: 40px;
  border-radius: 8px;
  font-weight: 600;
  padding: 0 1.25rem;
}
</style>
