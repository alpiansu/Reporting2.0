<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal confirm-delete-modal">
      <div class="dialog-header-modern delete-mode">
        <div class="dialog-header-left">
          <div class="dialog-icon-badge danger">
            <i class="pi pi-exclamation-triangle"></i>
          </div>
          <div>
            <h3 class="dialog-title">Konfirmasi Hapus</h3>
            <span class="dialog-subtitle">Tindakan ini tidak dapat dibatalkan</span>
          </div>
        </div>
        <button type="button" class="dialog-close-btn" @click="$emit('close')" title="Tutup modal">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <div class="dialog-body-modern">
        <div class="delete-confirmation-content">
          <p class="delete-msg">
            Apakah Anda yakin ingin menghapus departemen berikut?
          </p>
          <div class="delete-target-card">
            <div class="target-title">
              <i class="pi pi-building"></i>
              <strong>{{ dept?.dep_nm }}</strong>
            </div>
            <div class="target-meta">
              <span>Kode Dept: #{{ dept?.dep_kd }}</span> &bull; 
              <span>Divisi: {{ dept?.div_kd || '-' }}</span>
              <span v-if="dept?.dep_mgr"> &bull; Mgr: {{ dept?.dep_mgr }}</span>
            </div>
          </div>
          <p class="delete-warning-sub">
            Departemen yang dihapus dapat mempengaruhi data master produk dan mapping modul terkait.
          </p>
        </div>

        <div class="form-actions-redesign">
          <button 
            type="button" 
            class="btn-form-cancel" 
            @click="$emit('close')" 
            :disabled="deleting"
          >
            <i class="pi pi-times"></i>
            <span>Batal</span>
          </button>
          <button 
            type="button" 
            class="btn-danger-confirm" 
            @click="$emit('confirm')" 
            :disabled="deleting"
          >
            <i v-if="deleting" class="pi pi-spin pi-spinner"></i>
            <i v-else class="pi pi-trash"></i>
            <span>{{ deleting ? 'Menghapus...' : 'Ya, Hapus Departemen' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  },
  dept: {
    type: Object,
    default: null
  },
  deleting: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close', 'confirm']);
</script>

<style src="./MasterDeptConfirmDialog.css" scoped />