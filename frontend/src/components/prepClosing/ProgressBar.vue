<template>
  <div v-if="visible" class="progress-overlay">
    <div class="progress-modal">
      <div class="progress-header">
        <h3>{{ title }}</h3>
        <Button 
          icon="pi pi-times" 
          class="p-button-text p-button-plain" 
          @click="closeProgress"
          :disabled="status === 'running'"
        />
      </div>
      
      <div class="progress-content">
        <!-- Status Badge -->
        <div class="status-badge" :class="statusClass">
          <i :class="statusIcon"></i>
          <span>{{ statusText }}</span>
        </div>
        
        <!-- Wave Information -->
        <div v-if="maxWaves > 1" class="wave-info">
          <span class="wave-text">Wave {{ currentWave }} dari {{ maxWaves }}</span>
        </div>
        
        <!-- Progress Bar -->
        <div class="progress-bar-container">
          <div class="progress-info">
            <span class="progress-text">{{ processed }} / {{ total }} item</span>
            <span class="progress-percentage">{{ percentage }}%</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: percentage + '%' }"
              :class="progressBarClass"
            ></div>
          </div>
        </div>
        
        <!-- Current Processing Info -->
        <div v-if="currentBranch || currentItem" class="current-info">
          <div v-if="currentBranch" class="current-branch">
            <i class="pi pi-building"></i>
            <span>Cabang: {{ currentBranch }}</span>
          </div>
          <div v-if="currentItem" class="current-item">
            <i class="pi pi-cog"></i>
            <span>{{ currentItem }}</span>
          </div>
        </div>
        
        <!-- Statistics -->
        <div class="progress-stats">
          <div class="stat-item">
            <span class="stat-label">Waktu Berjalan</span>
            <span class="stat-value">{{ formattedTimeElapsed }}</span>
          </div>
          <div v-if="differences > 0" class="stat-item">
            <span class="stat-label">Total Perbedaan</span>
            <span class="stat-value differences">{{ differences }}</span>
          </div>
        </div>
        
        <!-- Message -->
        <div v-if="message" class="progress-message">
          <p>{{ message }}</p>
        </div>
        
        <!-- Error Details -->
        <div v-if="status === 'error' && errorDetails" class="error-details">
          <h4>Detail Error:</h4>
          <pre>{{ errorDetails }}</pre>
        </div>
      </div>
      
      <div class="progress-footer">
        <Button 
          v-if="status === 'completed' || status === 'error' || status === 'failed'"
          label="Tutup" 
          icon="pi pi-check" 
          class="p-button-primary" 
          @click="closeProgress"
        />
        <Button 
          v-else-if="status === 'running'"
          label="Sembunyikan" 
          icon="pi pi-minus" 
          class="p-button-secondary" 
          @click="closeProgress"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from 'primevue/button';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Progress'
  },
  status: {
    type: String,
    default: 'pending', // pending, starting, running, completed, error, failed
    validator: (value) => ['pending', 'starting', 'running', 'completed', 'error', 'failed'].includes(value)
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
    type: Number,
    default: 0
  },
  message: {
    type: String,
    default: ''
  },
  percentage: {
    type: Number,
    default: 0
  },
  currentWave: {
    type: Number,
    default: 1
  },
  maxWaves: {
    type: Number,
    default: 1
  },
  currentBranch: {
    type: String,
    default: ''
  },
  currentItem: {
    type: String,
    default: ''
  },
  errorDetails: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close']);

// Computed properties for status display
const statusClass = computed(() => {
  switch (props.status) {
    case 'pending':
    case 'starting':
      return 'status-pending';
    case 'running':
      return 'status-running';
    case 'completed':
      return 'status-completed';
    case 'error':
    case 'failed':
      return 'status-error';
    default:
      return 'status-pending';
  }
});

const statusIcon = computed(() => {
  switch (props.status) {
    case 'pending':
    case 'starting':
      return 'pi pi-clock';
    case 'running':
      return 'pi pi-spin pi-spinner';
    case 'completed':
      return 'pi pi-check-circle';
    case 'error':
    case 'failed':
      return 'pi pi-exclamation-triangle';
    default:
      return 'pi pi-clock';
  }
});

const statusText = computed(() => {
  switch (props.status) {
    case 'pending':
      return 'Menunggu';
    case 'starting':
      return 'Memulai';
    case 'running':
      return 'Sedang Berjalan';
    case 'completed':
      return 'Selesai';
    case 'error':
      return 'Error';
    case 'failed':
      return 'Gagal';
    default:
      return 'Tidak Diketahui';
  }
});

const progressBarClass = computed(() => {
  switch (props.status) {
    case 'completed':
      return 'progress-completed';
    case 'error':
    case 'failed':
      return 'progress-error';
    default:
      return 'progress-running';
  }
});

const formattedTimeElapsed = computed(() => {
  const hours = Math.floor(props.timeElapsed / 3600);
  const minutes = Math.floor((props.timeElapsed % 3600) / 60);
  const seconds = props.timeElapsed % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
});

// Methods
const closeProgress = () => {
  emit('close');
};
</script>

<style scoped>
.progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.progress-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 0 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.progress-header h3 {
  margin: 0;
  color: var(--primary-color);
  font-size: 1.25rem;
}

.progress-content {
  padding: 1.5rem;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  margin-bottom: 1rem;
  width: fit-content;
}

.status-pending {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-running {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.status-completed {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.wave-info {
  margin-bottom: 1rem;
  text-align: center;
}

.wave-text {
  font-weight: 600;
  color: var(--primary-color);
  background-color: #f8f9fa;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.progress-bar-container {
  margin-bottom: 1rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.progress-percentage {
  font-weight: 600;
  color: var(--primary-color);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-running {
  background-color: var(--primary-color);
}

.progress-completed {
  background-color: #28a745;
}

.progress-error {
  background-color: #dc3545;
}

.current-info {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid var(--primary-color);
}

.current-branch,
.current-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.current-branch:last-child,
.current-item:last-child {
  margin-bottom: 0;
}

.current-branch i,
.current-item i {
  color: var(--primary-color);
  width: 16px;
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-item {
  text-align: center;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  display: block;
  font-size: 1.125rem;
  font-weight: 600;
  color: #333;
}

.stat-value.differences {
  color: #dc3545;
}

.progress-message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #e3f2fd;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
}

.progress-message p {
  margin: 0;
  color: #1565c0;
  font-size: 0.875rem;
}

.error-details {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #fff5f5;
  border-radius: 6px;
  border-left: 4px solid #dc3545;
}

.error-details h4 {
  margin: 0 0 0.5rem 0;
  color: #dc3545;
  font-size: 0.875rem;
}

.error-details pre {
  margin: 0;
  font-size: 0.75rem;
  color: #721c24;
  white-space: pre-wrap;
  word-break: break-word;
}

.progress-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 576px) {
  .progress-modal {
    width: 95%;
    margin: 1rem;
  }
  
  .progress-stats {
    grid-template-columns: 1fr;
  }
  
  .progress-header {
    padding: 1rem 1rem 0 1rem;
  }
  
  .progress-content {
    padding: 1rem;
  }
  
  .progress-footer {
    padding: 1rem;
  }
}
</style>