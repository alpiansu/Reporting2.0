<template>
  <div class="summary-card" v-if="summary">
    <div class="summary-header">
      <h3 class="summary-title">Ringkasan Rekonsiliasi</h3>
      <div class="summary-info">
        <div class="info-item" v-if="cabangName">
          <span class="info-label">Cabang:</span>
          <span class="info-value">{{ cabangName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Periode:</span>
          <span class="info-value">{{ formatPeriode(periode) }}</span>
        </div>
      </div>
    </div>
    
    <div class="summary-stats">
      <!-- Jumlah Toko -->
      <div class="stat-item">
        <div class="stat-icon total-icon">
          <i class="pi pi-shopping-bag"></i>
        </div>
        <div class="stat-content">
          <span class="stat-label">Jumlah Toko</span>
          <span class="stat-value">{{ summary.jml_toko || 0 }}</span>
        </div>
      </div>
      
      <!-- Selisih Gross -->
      <div class="stat-item">
        <div class="stat-icon" :class="[summary.sel_gross !== 0 ? 'warning-icon' : 'success-icon']">
          <i class="pi pi-dollar"></i>
        </div>
        <div class="stat-content">
          <span class="stat-label">Selisih Gross</span>
          <span class="stat-value" :class="getAmountClass(summary.sel_gross)">
            {{ formatCurrency(summary.sel_gross || 0) }}
          </span>
          <div class="stat-minmax">
            <span class="stat-min">Min: {{ formatCurrency(summary.min_gross || 0) }}</span>
            <span class="stat-max">Max: {{ formatCurrency(summary.max_gross || 0) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Selisih PPN -->
      <div class="stat-item">
        <div class="stat-icon" :class="[summary.sel_ppn !== 0 ? 'warning-icon' : 'success-icon']">
          <i class="pi pi-percentage"></i>
        </div>
        <div class="stat-content">
          <span class="stat-label">Selisih PPN</span>
          <span class="stat-value" :class="getAmountClass(summary.sel_ppn)">
            {{ formatCurrency(summary.sel_ppn || 0) }}
          </span>
          <div class="stat-minmax">
            <span class="stat-min">Min: {{ formatCurrency(summary.min_ppn || 0) }}</span>
            <span class="stat-max">Max: {{ formatCurrency(summary.max_ppn || 0) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Selisih Gross IDM -->
      <div class="stat-item">
        <div class="stat-icon" :class="[summary.sel_gross_idm !== 0 ? 'warning-icon' : 'success-icon']">
          <i class="pi pi-dollar"></i>
        </div>
        <div class="stat-content">
          <span class="stat-label">Selisih Gross IDM</span>
          <span class="stat-value" :class="getAmountClass(summary.sel_gross_idm)">
            {{ formatCurrency(summary.sel_gross_idm || 0) }}
          </span>
          <div class="stat-minmax">
            <span class="stat-min">Min: {{ formatCurrency(summary.min_gross_idm || 0) }}</span>
            <span class="stat-max">Max: {{ formatCurrency(summary.max_gross_idm || 0) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Selisih PPN IDM -->
      <div class="stat-item">
        <div class="stat-icon" :class="[summary.sel_ppn_idm !== 0 ? 'warning-icon' : 'success-icon']">
          <i class="pi pi-percentage"></i>
        </div>
        <div class="stat-content">
          <span class="stat-label">Selisih PPN IDM</span>
          <span class="stat-value" :class="getAmountClass(summary.sel_ppn_idm)">
            {{ formatCurrency(summary.sel_ppn_idm || 0) }}
          </span>
          <div class="stat-minmax">
            <span class="stat-min">Min: {{ formatCurrency(summary.min_ppn_idm || 0) }}</span>
            <span class="stat-max">Max: {{ formatCurrency(summary.max_ppn_idm || 0) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCabangStore } from '../../stores';

const cabangStore = useCabangStore();

const props = defineProps({
  summary: {
    type: Object,
    required: true
  },
  periode: {
    type: String,
    required: true
  },
  cab: {
    type: String,
    default: ''
  }
});

// Computed property to display cabang name
const cabangName = computed(() => {
  // Menggunakan helper function getCabangName dari cabangStore
  return cabangStore.getCabangName(props.cab);
});

// Utility functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const formatPeriode = (periode) => {
  if (!periode || periode.length !== 4) return periode;
  
  const year = '20' + periode.substring(0, 2);
  const month = parseInt(periode.substring(2, 4));
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
};

const getAmountClass = (amount) => {
  if (!amount) return '';
  return amount < 0 ? 'negative-amount' : amount > 0 ? 'positive-amount' : '';
};
</script>

<style scoped>
.summary-card {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.summary-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.summary-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  margin: 0;
  position: relative;
  padding-left: 1.5rem;
  transition: color 0.3s ease;
}

.summary-title::before {
  content: '\f0ae'; /* pi-chart-bar icon */
  font-family: 'primeicons';
  font-size: 1.125rem;
  color: var(--primary-color);
  opacity: 0.8;
  position: absolute;
  left: 0;
}

.summary-card:hover .summary-title {
  color: var(--primary-color);
}

.summary-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.info-label {
  color: #666;
}

.info-value {
  font-weight: 600;
  color: #333;
  background-color: #f5f5f5;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #eee;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.summary-card:hover .info-value {
  background-color: #f0f7ff;
  color: var(--primary-color);
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}

.stat-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background-color: white;
  transition: box-shadow 0.3s ease, border-left 0.3s ease;
  border-left: 3px solid transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-item:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border-left: 3px solid var(--primary-color);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #e3f2fd;
  color: #2196f3;
  box-shadow: 0 1px 3px rgba(33, 150, 243, 0.15);
  transition: box-shadow 0.3s ease;
}

.stat-item:hover .stat-icon {
  box-shadow: 0 2px 6px rgba(33, 150, 243, 0.2);
}

.total-icon {
  background-color: #e8f5e9;
  color: #4caf50;
  box-shadow: 0 1px 3px rgba(76, 175, 80, 0.15);
}

.stat-item:hover .total-icon {
  box-shadow: 0 2px 6px rgba(76, 175, 80, 0.2);
}

.warning-icon {
  background-color: #fff3e0;
  color: #ff9800;
  box-shadow: 0 1px 3px rgba(255, 152, 0, 0.15);
}

.stat-item:hover .warning-icon {
  box-shadow: 0 2px 6px rgba(255, 152, 0, 0.2);
}

.success-icon {
  background-color: #e8f5e9;
  color: #4caf50;
  box-shadow: 0 1px 3px rgba(76, 175, 80, 0.15);
}

.stat-item:hover .success-icon {
  box-shadow: 0 2px 6px rgba(76, 175, 80, 0.2);
}

.stat-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.2;
  transition: color 0.3s ease;
  word-break: break-word;
}

.stat-minmax {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stat-min, .stat-max {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background-color: #f5f5f5;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.stat-min {
  color: #2ecc71;
}

.stat-max {
  color: #e74c3c;
}

.stat-item:hover .stat-value {
  color: var(--primary-color);
}

.positive-amount {
  color: #2ecc71;
}

.negative-amount {
  color: #e74c3c;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .summary-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .summary-stats {
    grid-template-columns: 1fr;
  }
  
  .stat-value {
    font-size: 1.125rem;
  }
}
</style>