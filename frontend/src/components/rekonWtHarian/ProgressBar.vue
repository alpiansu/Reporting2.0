<template>
  <div class="progress-container" v-if="visible">
    <div class="progress-card">
      <div class="progress-header">
        <h3>{{ title }}</h3>
        <Button 
          v-if="showCloseButton" 
          icon="pi pi-times" 
          class="p-button-rounded p-button-text p-button-sm" 
          @click="$emit('close')"
        />
      </div>
      
      <div class="progress-info">
        <div class="progress-status">
          <span class="status-label">Status:</span>
          <span class="status-value" :class="statusClass">{{ statusText }}</span>
        </div>
        
        <div class="progress-details" v-if="showDetails">
          <div class="detail-item">
            <span class="detail-label">Diproses:</span>
            <span class="detail-value">{{ processed }} / {{ total }}</span>
          </div>
          <div class="detail-item" v-if="showDifferences">
            <span class="detail-label">Perbedaan:</span>
            <span class="detail-value">{{ differences }}</span>
          </div>
          <div class="detail-item" v-if="showTimeElapsed">
            <span class="detail-label">Waktu:</span>
            <span class="detail-value">{{ formattedTimeElapsed }}</span>
          </div>
        </div>
      </div>
      
      <ProgressBar 
        :value="progressPercentage" 
        :class="{'indeterminate': indeterminate}"
      />
      
      <div class="progress-message" v-if="message">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import ProgressBar from 'primevue/progressbar';
import Button from 'primevue/button';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Proses Rekonsiliasi'
  },
  status: {
    type: String,
    default: 'pending',
    validator: (value) => ['pending', 'in_progress', 'completed', 'error'].includes(value)
  },
  processed: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  differences: {
    type: Number,
    default: 0
  },
  timeElapsed: {
    type: Number, // in seconds
    default: 0
  },
  message: {
    type: String,
    default: ''
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  showDetails: {
    type: Boolean,
    default: true
  },
  showDifferences: {
    type: Boolean,
    default: true
  },
  showTimeElapsed: {
    type: Boolean,
    default: true
  },
  indeterminate: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

// Computed properties
const progressPercentage = computed(() => {
  if (props.total === 0) return 0;
  return Math.min(Math.round((props.processed / props.total) * 100), 100);
});

const statusText = computed(() => {
  switch (props.status) {
    case 'pending': return 'Menunggu';
    case 'in_progress': return 'Sedang Berjalan';
    case 'completed': return 'Selesai';
    case 'error': return 'Error';
    default: return 'Tidak Diketahui';
  }
});

const statusClass = computed(() => {
  return `status-${props.status}`;
});

const formattedTimeElapsed = computed(() => {
  const seconds = props.timeElapsed;
  if (seconds < 60) {
    return `${seconds} detik`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} menit ${remainingSeconds} detik`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours} jam ${minutes} menit ${remainingSeconds} detik`;
  }
});
</script>

<style scoped>
.progress-container {
  margin-top: 2rem;
  margin-bottom: 1.5rem;
}

.progress-card {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 1.5rem;
  border: 1px solid #f0f0f0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid #f5f5f5;
  padding-bottom: 0.75rem;
}

.progress-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
  letter-spacing: 0.01em;
}

.progress-info {
  margin-bottom: 1.5rem;
}

.progress-status {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-label {
  font-weight: 500;
  margin-right: 0.75rem;
  color: #64748b;
}

.status-value {
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.status-value::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-pending {
  background-color: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.status-pending::before {
  background-color: #94a3b8;
}

.status-in_progress {
  background-color: #eff6ff;
  color: #1e40af;
  border: 1px solid #dbeafe;
}

.status-in_progress::before {
  background-color: #3b82f6;
}

.status-completed {
  background-color: #f0fdf4;
  color: #166534;
  border: 1px solid #dcfce7;
}

.status-completed::before {
  background-color: #22c55e;
}

.status-error {
  background-color: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fee2e2;
}

.status-error::before {
  background-color: #ef4444;
}

.progress-details {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  background-color: #fafbfc;
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
}

.detail-label {
  font-weight: 500;
  margin-right: 0.5rem;
  color: #64748b;
}

.detail-value {
  font-weight: 600;
  color: #334155;
}

.progress-message {
  margin-top: 1.25rem;
  font-size: 0.95rem;
  color: #5a6a85;
  font-style: normal;
  line-height: 1.5;
  background-color: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border-left: 3px solid #2196f3;
}

/* Custom styling for PrimeVue ProgressBar */
:deep(.p-progressbar) {
  height: 0.85rem;
  background: #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

:deep(.p-progressbar-value) {
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
  transition: width 0.3s ease;
}

:deep(.indeterminate .p-progressbar-value) {
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 50%, #3b82f6 100%);
  animation: p-progressbar-indeterminate 2s linear infinite;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
}

@keyframes p-progressbar-indeterminate {
  0% {
    left: -50%;
    width: 50%;
  }
  100% {
    left: 100%;
    width: 50%;
  }
}
</style>