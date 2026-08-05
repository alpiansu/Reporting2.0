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

<style scoped src="./RbStagingSyncDialog.style.css"></style>
