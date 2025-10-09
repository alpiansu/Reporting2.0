<template>
  <div class="summary-card-modern" v-if="summary">
    <div class="summary-header-modern">
      <div class="summary-title-section">
        <i class="pi pi-chart-line summary-icon-modern"></i>
        <div class="summary-title-content">
          <h3 class="summary-title-modern">Reconciliation Summary</h3>
          <p class="summary-subtitle-modern">
            {{ cabangName ? `${cabangName} - ` : '' }}{{ formatPeriode(periode) }}
          </p>
        </div>
      </div>
      <div class="summary-badge-modern">
        <span class="status-indicator" :class="getOverallStatusClass()">
          <i class="pi" :class="getOverallStatusIcon()"></i>
          {{ getOverallStatusText() }}
        </span>
      </div>
    </div>

    <!-- Compact Summary Grid -->
    <div class="summary-grid-modern">
      <!-- Total Stores -->
      <div class="summary-item-modern stores">
        <div class="summary-item-icon">
          <i class="pi pi-building"></i>
        </div>
        <div class="summary-item-content">
          <span class="summary-item-value">{{ summary.jml_toko || 0 }}</span>
          <span class="summary-item-label">Stores</span>
        </div>
      </div>
      
      <!-- Gross Difference -->
      <div class="summary-item-modern gross">
        <div class="summary-item-icon">
          <i class="pi pi-dollar"></i>
        </div>
        <div class="summary-item-content">
          <span class="summary-item-value" :class="getAmountClass(summary.sel_gross)">
            {{ formatCurrencyCompact(summary.sel_gross || 0) }}
          </span>
          <span class="summary-item-label">Gross Diff</span>
          <div class="summary-item-range" v-if="summary.min_gross !== undefined && summary.max_gross !== undefined">
            <span class="range-min">{{ formatCurrencyCompact(summary.min_gross) }}</span>
            <span class="range-separator">~</span>
            <span class="range-max">{{ formatCurrencyCompact(summary.max_gross) }}</span>
          </div>
        </div>
      </div>
      
      <!-- PPN Difference -->
      <div class="summary-item-modern ppn">
        <div class="summary-item-icon">
          <i class="pi pi-percentage"></i>
        </div>
        <div class="summary-item-content">
          <span class="summary-item-value" :class="getAmountClass(summary.sel_ppn)">
            {{ formatCurrencyCompact(summary.sel_ppn || 0) }}
          </span>
          <span class="summary-item-label">PPN Diff</span>
          <div class="summary-item-range" v-if="summary.min_ppn !== undefined && summary.max_ppn !== undefined">
            <span class="range-min">{{ formatCurrencyCompact(summary.min_ppn) }}</span>
            <span class="range-separator">~</span>
            <span class="range-max">{{ formatCurrencyCompact(summary.max_ppn) }}</span>
          </div>
        </div>
      </div>
      
      <!-- IDM Gross Difference -->
      <div class="summary-item-modern idm-gross">
        <div class="summary-item-icon">
          <i class="pi pi-credit-card"></i>
        </div>
        <div class="summary-item-content">
          <span class="summary-item-value" :class="getAmountClass(summary.sel_gross_idm)">
            {{ formatCurrencyCompact(summary.sel_gross_idm || 0) }}
          </span>
          <span class="summary-item-label">IDM Gross</span>
          <div class="summary-item-range" v-if="summary.min_gross_idm !== undefined && summary.max_gross_idm !== undefined">
            <span class="range-min">{{ formatCurrencyCompact(summary.min_gross_idm) }}</span>
            <span class="range-separator">~</span>
            <span class="range-max">{{ formatCurrencyCompact(summary.max_gross_idm) }}</span>
          </div>
        </div>
      </div>
      
      <!-- IDM PPN Difference -->
      <div class="summary-item-modern idm-ppn">
        <div class="summary-item-icon">
          <i class="pi pi-calculator"></i>
        </div>
        <div class="summary-item-content">
          <span class="summary-item-value" :class="getAmountClass(summary.sel_ppn_idm)">
            {{ formatCurrencyCompact(summary.sel_ppn_idm || 0) }}
          </span>
          <span class="summary-item-label">IDM PPN</span>
          <div class="summary-item-range" v-if="summary.min_ppn_idm !== undefined && summary.max_ppn_idm !== undefined">
            <span class="range-min">{{ formatCurrencyCompact(summary.min_ppn_idm) }}</span>
            <span class="range-separator">~</span>
            <span class="range-max">{{ formatCurrencyCompact(summary.max_ppn_idm) }}</span>
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

const formatCurrencyCompact = (value) => {
  const absValue = Math.abs(value || 0);
  
  if (absValue >= 1000000000) {
    return (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  
  return new Intl.NumberFormat('id-ID').format(value || 0);
};

const formatPeriode = (periode) => {
  if (!periode || periode.length !== 4) return periode;
  
  const year = '20' + periode.substring(0, 2);
  const month = parseInt(periode.substring(2, 4));
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
};

const getAmountClass = (amount) => {
  if (!amount) return '';
  return amount < 0 ? 'negative-amount' : amount > 0 ? 'positive-amount' : '';
};

const getOverallStatusClass = () => {
  const hasIssues = (props.summary.sel_gross !== 0) || 
                   (props.summary.sel_ppn !== 0) || 
                   (props.summary.sel_gross_idm !== 0) || 
                   (props.summary.sel_ppn_idm !== 0);
  
  return hasIssues ? 'status-warning' : 'status-success';
};

const getOverallStatusIcon = () => {
  const hasIssues = (props.summary.sel_gross !== 0) || 
                   (props.summary.sel_ppn !== 0) || 
                   (props.summary.sel_gross_idm !== 0) || 
                   (props.summary.sel_ppn_idm !== 0);
  
  return hasIssues ? 'pi-exclamation-triangle' : 'pi-check-circle';
};

const getOverallStatusText = () => {
  const hasIssues = (props.summary.sel_gross !== 0) || 
                   (props.summary.sel_ppn !== 0) || 
                   (props.summary.sel_gross_idm !== 0) || 
                   (props.summary.sel_ppn_idm !== 0);
  
  return hasIssues ? 'Has Differences' : 'All Clear';
};
</script>

<style scoped>
/* Modern Minimalist Summary Card */
.summary-card-modern {
  background: linear-gradient(135deg, #fefffe 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  margin-bottom: 1.5rem;
  transition: all 0.3s ease;
}

.summary-card-modern:hover {
  box-shadow: 0 8px 12px -1px rgba(0, 0, 0, 0.1), 0 4px 8px -1px rgba(0, 0, 0, 0.06);
}

/* Header Section */
.summary-header-modern {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.summary-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-icon-modern {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #38bdf8);
  color: white;
  border-radius: 12px;
  font-size: 1.5rem;
  box-shadow: 0 4px 8px rgba(14, 165, 233, 0.25);
}

.summary-title-content h3 {
  font-size: 1.375rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.25rem 0;
  line-height: 1.2;
}

.summary-title-content p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

.summary-badge-modern {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.status-indicator.status-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-indicator.status-warning {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

/* Compact Summary Grid */
.summary-grid-modern {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
  background: white;
}

.summary-item-modern {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #fafbfc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.summary-item-modern::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  transition: all 0.2s ease;
}

.summary-item-modern.stores::before {
  background: linear-gradient(90deg, #0ea5e9, #38bdf8);
}

.summary-item-modern.gross::before {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.summary-item-modern.ppn::before {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.summary-item-modern.idm-gross::before {
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
}

.summary-item-modern.idm-ppn::before {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.summary-item-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #e2e8f0;
}

.summary-item-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.summary-item-modern.stores .summary-item-icon {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1e40af;
}

.summary-item-modern.gross .summary-item-icon {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  color: #166534;
}

.summary-item-modern.ppn .summary-item-icon {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #d97706;
}

.summary-item-modern.idm-gross .summary-item-icon {
  background: linear-gradient(135deg, #ede9fe, #ddd6fe);
  color: #7c3aed;
}

.summary-item-modern.idm-ppn .summary-item-icon {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #dc2626;
}

.summary-item-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.summary-item-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 0.25rem;
  word-break: break-word;
}

.summary-item-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-bottom: 0.5rem;
}

.summary-item-range {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 500;
}

.range-min, .range-max {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: #f1f5f9;
  white-space: nowrap;
}

.range-min {
  color: #059669;
}

.range-max {
  color: #dc2626;
}

.range-separator {
  color: #94a3b8;
  font-weight: 400;
}

.positive-amount {
  color: #059669;
}

.negative-amount {
  color: #dc2626;
}

/* Responsive Design */
@media (max-width: 768px) {
  .summary-header-modern {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    text-align: center;
  }
  
  .summary-grid-modern {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    padding: 1rem;
  }
  
  .summary-item-modern {
    padding: 0.875rem;
  }
  
  .summary-item-icon {
    width: 40px;
    height: 40px;
    font-size: 1.125rem;
  }
  
  .summary-item-value {
    font-size: 1.25rem;
  }
}

@media (max-width: 576px) {
  .summary-grid-modern {
    grid-template-columns: 1fr;
  }
  
  .summary-header-modern {
    padding: 1rem;
  }
  
  .summary-title-content h3 {
    font-size: 1.25rem;
  }
}
</style>