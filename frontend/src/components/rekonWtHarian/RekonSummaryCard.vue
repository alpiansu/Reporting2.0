<template>
  <div class="summary-section" v-if="summary">
    <!-- Row: Issue Bar Chart + Summary Metrics -->
    <div class="summary-row">
      <div class="summary-chart-col">
        <RekonIssueBar
          :summary="summary"
          :loading="loading"
          :tolerance-amount="toleranceAmount"
        />
      </div>
      <div class="summary-metrics-col">
        <div class="summary-card-modern">
          <div class="summary-header-modern">
            <div class="summary-title-section">
              <i class="pi pi-chart-line summary-icon-modern"></i>
              <div class="summary-title-content">
                <h3 class="summary-title-modern">Ringkasan Selisih</h3>
                <p class="summary-subtitle-modern">
                  {{ cabangName ? `${cabangName} - ` : '' }}{{ formatPeriode(periode) }}
                </p>
              </div>
            </div>
          </div>

          <div class="summary-grid-modern">
            <!-- Total Stores -->
            <div class="summary-item-modern stores">
              <div class="summary-item-icon">
                <i class="pi pi-building"></i>
              </div>
              <div class="summary-item-content">
                <span class="summary-item-value">{{ summary.total_stores || 0 }}</span>
                <span class="summary-item-label">Total Toko</span>
              </div>
            </div>

            <!-- Problematic Stores (need follow-up) -->
            <div class="summary-item-modern issues">
              <div class="summary-item-icon">
                <i class="pi pi-exclamation-triangle"></i>
              </div>
              <div class="summary-item-content">
                <span class="summary-item-value" :class="(summary.stores_to_follow_up || 0) > 0 ? 'negative-amount' : ''">
                  {{ summary.stores_to_follow_up || 0 }}
                </span>
                <span class="summary-item-label">Perlu Follow Up</span>
                <div class="summary-item-range">
                  <span class="range-min">{{ (summary.stores_to_follow_up || 0) > 0 ? ((Math.min(summary.stores_to_follow_up || 0, summary.total_stores || 0) / (summary.total_stores || 1)) * 100).toFixed(1) + '%' : '0%' }}</span>
                </div>
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
                <span class="summary-item-label">Selisih Gross</span>
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
                <span class="summary-item-label">Selisih PPN</span>
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
                <span class="summary-item-label">Selisih Gross IDM</span>
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
                <span class="summary-item-label">Selisih PPN IDM</span>
                <div class="summary-item-range" v-if="summary.min_ppn_idm !== undefined && summary.max_ppn_idm !== undefined">
                  <span class="range-min">{{ formatCurrencyCompact(summary.min_ppn_idm) }}</span>
                  <span class="range-separator">~</span>
                  <span class="range-max">{{ formatCurrencyCompact(summary.max_ppn_idm) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCabangStore } from '../../stores';
import RekonIssueBar from './RekonIssueBar.vue';

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
  },
  loading: {
    type: Boolean,
    default: false
  },
  toleranceAmount: {
    type: Number,
    default: undefined
  }
});

// Computed property to display cabang name
const cabangName = computed(() => {
  // Menggunakan helper function getCabangName dari cabangStore
  return cabangStore.getCabangName(props.cab);
});

// Utility functions
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
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
};const getAmountClass = (amount) => {
  if (!amount) return '';
  return amount < 0 ? 'negative-amount' : amount > 0 ? 'positive-amount' : '';
};
</script>

<style scoped src="./RekonSummaryCard.style.css"></style>