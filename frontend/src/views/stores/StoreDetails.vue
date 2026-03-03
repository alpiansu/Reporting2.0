<template>
  <!-- Store Detail Dialog -->
  <div v-if="isOpen" class="dialog-overlay-modern" @click="$emit('close')">
    <div class="dialog-content-modern" @click.stop>
      <div class="dialog-header-modern">
        <div class="dialog-title-section">
          <i class="pi pi-info-circle dialog-icon"></i>
          <h2 class="dialog-title">Store Details</h2>
        </div>
        <button class="dialog-close-btn" @click="$emit('close')">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <div class="dialog-body-modern">
        <div v-if="store" class="detail-grid-modern">
          <div class="detail-group-modern">
            <label class="detail-label">Store Name</label>
            <div class="detail-value">{{ store.storeName }}</div>
          </div>
          
          <div class="detail-group-modern">
            <label class="detail-label">Store Code</label>
            <div class="detail-value-badge">{{ store.storeCode }}</div>
          </div>

          <div class="detail-group-modern">
            <label class="detail-label">Station</label>
            <div class="detail-value">{{ store.station }}</div>
          </div>

          <div class="detail-group-modern">
            <label class="detail-label">Branch Code</label>
            <div class="detail-value">{{ store.branch }}</div>
          </div>

          <div class="detail-group-modern full-width">
            <label class="detail-label">Database Host</label>
            <div class="detail-value-host">
              <i class="pi pi-server"></i>
              <span>{{ store.dbHost }}</span>
            </div>
          </div>

          <div class="detail-group-modern">
            <label class="detail-label">Store Type</label>
            <div class="status-badge" :class="getStatusClass(store.notes === 'INDUK' ? 'Active' : 'Pending')">
              {{ store.notes }}
            </div>
          </div>

          <div class="detail-group-modern full-width" v-if="store.address">
            <label class="detail-label">Address</label>
            <div class="detail-value">{{ store.address }}</div>
          </div>

          <div class="detail-group-modern full-width">
            <div class="detail-timestamps">
              <div class="timestamp-item">
                <span class="timestamp-label">Created At:</span>
                <span class="timestamp-value">{{ formatDate(store.createdAt) }}</span>
              </div>
              <div class="timestamp-item">
                <span class="timestamp-label">Last Updated:</span>
                <span class="timestamp-value">{{ formatDate(store.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="loading-state-mini">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Loading details...</span>
        </div>

        <div class="form-actions-modern">
          <button class="btn-primary" @click="$emit('close')">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  store: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close']);

const getStatusClass = (status) => {
  if (!status) return '';
  switch (status.toLowerCase()) {
    case 'active': return 'status-active';
    case 'inactive': return 'status-inactive';
    case 'pending': return 'status-pending';
    default: return '';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleString(undefined, options);
};
</script>

<style scoped>
.dialog-overlay-modern {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.dialog-content-modern {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}

.dialog-header-modern {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
}

.dialog-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dialog-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #38bdf8);
  color: white;
  border-radius: 10px;
  font-size: 1.25rem;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.dialog-close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-body-modern {
  padding: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
}

.detail-grid-modern {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.detail-group-modern {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-group-modern.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.detail-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.detail-value-badge {
  display: inline-flex;
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: var(--primary-color, #0ea5e9);
  background: #f0f9ff;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.detail-value-host {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.detail-value-host i {
  color: var(--primary-color, #0ea5e9);
}

.detail-timestamps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #fafbfc;
  border-radius: 10px;
  border: 1px dashed #e2e8f0;
}

.timestamp-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.timestamp-label {
  color: #64748b;
}

.timestamp-value {
  color: #374151;
  font-weight: 500;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  width: fit-content;
}

.status-badge.status-active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-badge.status-pending {
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fef08a;
}

.loading-state-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
  color: #64748b;
}

.form-actions-modern {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-primary {
  background: var(--primary-color, #0ea5e9);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #0284c7;
}
</style>