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

<style scoped src="./ProgressBar.style.css"></style>