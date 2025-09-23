<template>
  <div class="summary-card">
    <div class="summary-header">
      <div class="summary-title">
        <h3>Ringkasan Screening Persiapan Closing</h3>
        <p class="summary-subtitle">
          {{ getCabangDisplay(cab) }} - {{ formatPeriode(periode) }}
        </p>
      </div>
      <div class="summary-actions">
        <Button 
          icon="pi pi-refresh" 
          class="p-button-text p-button-plain" 
          @click="$emit('refresh')"
          v-tooltip.top="'Refresh Data'"
        />
      </div>
    </div>
    
    <div class="summary-content">
      <!-- Status Overview -->
      <div class="status-overview">
        <div class="status-item status-total">
          <div class="status-icon">
            <i class="pi pi-building"></i>
          </div>
          <div class="status-info">
            <span class="status-label">Total Toko</span>
            <span class="status-value">{{ summary.totalStores || 0 }}</span>
          </div>
        </div>
        
        <div class="status-item status-ready">
          <div class="status-icon">
            <i class="pi pi-check-circle"></i>
          </div>
          <div class="status-info">
            <span class="status-label">Siap Closing</span>
            <span class="status-value">{{ summary.readyStores || 0 }}</span>
          </div>
        </div>
        
        <div class="status-item status-not-ready">
          <div class="status-icon">
            <i class="pi pi-exclamation-triangle"></i>
          </div>
          <div class="status-info">
            <span class="status-label">Belum Siap</span>
            <span class="status-value">{{ summary.notReadyStores || 0 }}</span>
          </div>
        </div>
        
        <div class="status-item status-error">
          <div class="status-icon">
            <i class="pi pi-times-circle"></i>
          </div>
          <div class="status-info">
            <span class="status-label">Error</span>
            <span class="status-value">{{ summary.errorStores || 0 }}</span>
          </div>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Progress Kesiapan</span>
          <span class="progress-percentage">{{ readinessPercentage }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: readinessPercentage + '%' }"></div>
        </div>
      </div>
      
      <!-- Issue Categories -->
      <div v-if="summary.issues && Object.keys(summary.issues).length > 0" class="issues-section">
        <h4 class="issues-title">Kategori Masalah</h4>
        <div class="issues-grid">
          <div 
            v-for="(count, issue) in summary.issues" 
            :key="issue"
            class="issue-item"
          >
            <div class="issue-icon">
              <i :class="getIssueIcon(issue)"></i>
            </div>
            <div class="issue-info">
              <span class="issue-label">{{ getIssueLabel(issue) }}</span>
              <span class="issue-count">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Last Updated -->
      <div class="last-updated">
        <i class="pi pi-clock"></i>
        <span>Terakhir diperbarui: {{ formatLastUpdated(summary.lastUpdated) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from 'primevue/button';

const props = defineProps({
  summary: {
    type: Object,
    required: true
  },
  cab: {
    type: String,
    required: true
  },
  periode: {
    type: String,
    required: true
  }
});

defineEmits(['refresh']);

// Computed properties
const readinessPercentage = computed(() => {
  const total = props.summary.totalStores || 0;
  const ready = props.summary.readyStores || 0;
  
  if (total === 0) return 0;
  return Math.round((ready / total) * 100);
});

// Methods
const getCabangDisplay = (cab) => {
  if (cab === '' || cab === 'SEMUA' || cab === 'All') {
    return 'SEMUA CABANG';
  }
  return cab;
};

const formatPeriode = (periode) => {
  if (!periode || periode.length !== 6) return periode;
  
  const year = periode.substring(0, 4);
  const month = parseInt(periode.substring(4, 6));
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
};

const getIssueIcon = (issue) => {
  const iconMap = {
    'wrc_missing': 'pi pi-database',
    'data_incomplete': 'pi pi-exclamation-circle',
    'connection_error': 'pi pi-wifi',
    'validation_error': 'pi pi-times-circle',
    'timeout': 'pi pi-clock',
    'permission_error': 'pi pi-lock'
  };
  
  return iconMap[issue] || 'pi pi-question-circle';
};

const getIssueLabel = (issue) => {
  const labelMap = {
    'wrc_missing': 'Data WRC Tidak Ada',
    'data_incomplete': 'Data Tidak Lengkap',
    'connection_error': 'Koneksi Error',
    'validation_error': 'Validasi Error',
    'timeout': 'Timeout',
    'permission_error': 'Permission Error'
  };
  
  return labelMap[issue] || issue;
};

const formatLastUpdated = (timestamp) => {
  if (!timestamp) return 'Tidak diketahui';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) {
    return 'Baru saja';
  } else if (diffMins < 60) {
    return `${diffMins} menit yang lalu`;
  } else if (diffHours < 24) {
    return `${diffHours} jam yang lalu`;
  } else if (diffDays < 7) {
    return `${diffDays} hari yang lalu`;
  } else {
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
</script>

<style scoped>
.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 0;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
  color: white;
  overflow: hidden;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.summary-title h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.summary-subtitle {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.9;
}

.summary-actions {
  display: flex;
  gap: 0.5rem;
}

.summary-content {
  padding: 1.5rem;
}

.status-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.status-total .status-icon {
  background: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.status-ready .status-icon {
  background: rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.status-not-ready .status-icon {
  background: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.status-error .status-icon {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.status-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.status-label {
  font-size: 0.75rem;
  opacity: 0.9;
  margin-bottom: 0.25rem;
}

.status-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.progress-section {
  margin-bottom: 1.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-size: 0.875rem;
  font-weight: 600;
}

.progress-percentage {
  font-size: 0.875rem;
  font-weight: 700;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.issues-section {
  margin-bottom: 1.5rem;
}

.issues-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
}

.issues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.issue-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: #fbbf24;
  flex-shrink: 0;
}

.issue-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.issue-label {
  font-size: 0.75rem;
  opacity: 0.9;
  margin-bottom: 0.125rem;
}

.issue-count {
  font-size: 1rem;
  font-weight: 600;
}

.last-updated {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.8;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.last-updated i {
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .summary-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .status-overview {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .issues-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .status-overview {
    grid-template-columns: 1fr;
  }
  
  .summary-card {
    margin: 0 -0.5rem;
  }
}
</style>