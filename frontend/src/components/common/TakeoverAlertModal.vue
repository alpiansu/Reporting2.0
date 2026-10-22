<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    :closable="true"
    :style="{ width: '700px', maxWidth: '95vw' }"
    class="takeover-alert-modal"
  >
    <template #header>
      <div class="takeover-modal-header">
        <div class="alert-icon-wrap">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <div>
          <div class="alert-title">Peringatan: Jadwal Toko Takeover</div>
          <div class="alert-subtitle">
            Ditemukan <strong>{{ alerts.length }} toko</strong> dalam periode takeover (H-3 s.d. H+2)
          </div>
        </div>
      </div>
    </template>

    <div class="takeover-modal-body">
      <div class="alert-banner-box">
        <i class="pi pi-info-circle"></i>
        <span>
          Toko-toko berikut sedang dalam jadwal pergantian kode / kepemilikan (takeover).
          Harap perhatikan proses administrasi dan cut-off operasional.
        </span>
      </div>

      <div class="takeover-cards-list">
        <div v-for="toko in alerts" :key="toko.kodeLama + '-' + toko.kodeBaru" class="takeover-item-card">
          <div class="card-left">
            <div class="card-header-row">
              <span class="branch-pill">{{ toko.cabang }}</span>
              <span class="store-name-title">{{ toko.namaToko }}</span>
            </div>
            <div class="transition-row">
              <span class="code-box old" title="Kode Toko Lama">{{ toko.kodeLama }}</span>
              <i class="pi pi-arrow-right arrow-icon"></i>
              <span class="code-box new" title="Kode Toko Baru">{{ toko.kodeBaru }}</span>
              <span class="transition-type-pill">{{ toko.tipeTransisi }}</span>
            </div>
          </div>

          <div class="card-right">
            <span class="takeover-date-label">
              <i class="pi pi-calendar"></i>
              {{ formatDate(toko.tglTakeover) }}
            </span>
            <span :class="['alert-status-badge', toko.badgeSeverity || 'warning']">
              {{ toko.statusAlert }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer-actions">
        <Button
          label="Tutup Peringatan"
          icon="pi pi-times"
          class="p-button-text p-button-secondary"
          @click="$emit('update:visible', false)"
        />
        <Button
          label="Lihat di Monitoring Toko"
          icon="pi pi-arrow-up-right"
          class="p-button-primary"
          @click="handleGoToMonitoring"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  alerts: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:visible', 'closed']);
const router = useRouter();

const handleGoToMonitoring = () => {
  emit('update:visible', false);
  router.push('/stores');
};

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }
  return dateStr;
};
</script>

<style scoped>
.takeover-modal-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.alert-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.alert-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-color, #0f172a);
}

.alert-subtitle {
  font-size: 0.825rem;
  color: var(--text-color-secondary, #64748b);
}

.takeover-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.5rem;
}

.alert-banner-box {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem 1rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  font-size: 0.825rem;
  color: #b45309;
  line-height: 1.4;
}

.takeover-cards-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.takeover-item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.takeover-item-card:hover {
  border-color: #3b82f6;
  background: var(--surface-hover, #f8fafc);
}

.card-left {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.card-header-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.branch-pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  background: var(--surface-ground, #f1f5f9);
  color: var(--text-color, #334155);
}

.store-name-title {
  font-size: 0.925rem;
  font-weight: 700;
  color: var(--text-color, #0f172a);
}

.transition-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.code-box {
  font-family: monospace;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.code-box.old {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  text-decoration: line-through;
}

.code-box.new {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.arrow-icon {
  font-size: 0.75rem;
  color: var(--text-color-secondary, #94a3b8);
}

.transition-type-pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}

.takeover-date-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color-secondary, #64748b);
}

.alert-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 6px;
}

.alert-status-badge.danger {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.alert-status-badge.warning {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.alert-status-badge.info {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}

@media (prefers-color-scheme: dark) {
  .alert-title,
  .store-name-title {
    color: #f1f5f9;
  }
  .alert-banner-box {
    background: rgba(245, 158, 11, 0.15);
    color: #fde68a;
  }
  .takeover-item-card {
    background: #1e293b;
    border-color: #334155;
  }
  .takeover-item-card:hover {
    background: #334155;
  }
  .branch-pill {
    background: #334155;
    color: #cbd5e1;
  }
}
</style>
