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

<style scoped src="./PrepClosingSummaryCard.style.css"></style>