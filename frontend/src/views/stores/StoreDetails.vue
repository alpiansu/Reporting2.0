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

<style scoped src="./StoreDetails.style.css"></style>