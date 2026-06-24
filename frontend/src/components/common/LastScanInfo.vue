<template>
  <div class="last-scan-widget" :class="{ loading, error }">
    <!-- Loading -->
    <template v-if="loading">
      <div class="scan-loading-state">
        <i class="pi pi-spin pi-spinner loading-spinner"></i>
        <span class="loading-text">Loading scan info...</span>
      </div>
    </template>

    <!-- Error -->
    <template v-else-if="error">
      <div class="scan-error-state">
        <i class="pi pi-exclamation-circle error-icon"></i>
        <span class="error-text">{{ error }}</span>
        <button @click="fetchLastScan" class="retry-button">
          <i class="pi pi-refresh"></i> Retry
        </button>
      </div>
    </template>

    <!-- Success -->
    <template v-else-if="scanInfo">
      <div class="scan-info-container">
        <!-- Header Minimalis -->
        <div class="scan-header">
          <div class="scan-icon-wrapper">
            <i class="pi pi-search scan-icon"></i>
            <div class="pulse-ring"></div>
          </div>
          <div class="scan-title-section">
            <div class="scan-header-text">
              <h4 class="scan-title">{{ moduleName }}</h4>
              <p class="scan-subtitle">Mass Screening Overview</p>
            </div>

            <div class="scan-last-info">
              <template v-if="filteredCabangs.length">
                <div class="last-info-label">
                  <i class="pi pi-clock"></i>
                  <span class="label-text">Last Scan</span>
                </div>

                <div class="last-info-value">
                  <span class="date">{{ fmt.date(filteredCabangs[0]?.last_scan) }}</span>
                  <span class="time">{{ fmt.time(filteredCabangs[0]?.last_scan) }}</span>

                  <!-- Badge "xx ago" -->
                  <span class="ago-badge" v-if="lastScanHoursAgo  !== null">{{ fmt.ago(filteredCabangs[0]?.last_scan) }}</span>
                </div>
              </template>

              <template v-else>
                <div class="last-info-empty">
                  <i class="pi pi-exclamation-circle"></i>
                  <span>No scan data available</span>
                </div>
              </template>
            </div>

          </div>

          <div class="scan-summary-badge" v-if="!singleCabMode">
            <span class="summary-count">{{ scanInfo.cabangs?.length ?? 0 }}</span>
            <span class="summary-label">Branches</span>
          </div>
          <button class="expand-btn" @click="!singleCabMode && (expanded = !expanded)" :disabled="singleCabMode"
            v-if="!singleCabMode">
            <i :class="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
          </button>

        </div>
        <!-- Expandable Detail -->
        <transition name="slide-fade">
          <div v-if="expanded && !singleCabMode" class="scan-body">
            <div v-if="scanInfo.cabangs?.length" class="branches-grid">
              <div v-for="cabang in scanInfo.cabangs" :key="cabang.cab" class="branch-card">
                <div class="branch-card-header">
                  <div class="branch-badge">{{ cabang.cab }}</div>
                </div>
                <div class="branch-card-body">
                  <div class="scan-time-info">
                    <i class="pi pi-clock"></i>
                    <div class="scan-time-content">
                      <span class="scan-time">{{ fmt.time(cabang.last_scan) }}</span>
                      <span class="scan-date">{{ fmt.date(cabang.last_scan) }}</span>
                    </div>
                  </div>
                  <div class="scan-ago-badge" :class="fmt.agoClass(cabang.last_scan)">
                    <i class="pi pi-history"></i> {{ fmt.ago(cabang.last_scan) }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="branches-empty">
              <i class="pi pi-inbox"></i>
              <span>No branch data available</span>
            </div>
          </div>
        </transition>
        <!-- Footer -->
        <div class="scan-footer" v-if="showRefresh">
          <button @click="fetchLastScan" class="refresh-button" :disabled="loading">
            <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i> Refresh
          </button>
        </div>
      </div>
    </template>

    <!-- No Data -->
    <template v-else>
      <div class="scan-empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <span class="empty-text">No scan data available</span>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import rekapRemoteService from '@/services/rekapRemote.service';

const props = defineProps({
  moduleName: String,
  selectedCabang: String,
  showRefresh: { type: Boolean, default: true },
  autoRefresh: { type: Boolean, default: false },
  refreshInterval: { type: Number, default: 300000 }
});

const emit = defineEmits(['scan-loaded', 'scan-error']);

const loading = ref(false);
const error = ref(null);
const scanInfo = ref(null);
const expanded = ref(false);
let refreshTimer = null;

const filteredCabangs = computed(() => {
  if (!scanInfo.value?.cabangs) return [];

  // Jika ALL → return semuanya
  if (!props.selectedCabang || props.selectedCabang === 'All')
    return scanInfo.value.cabangs;

  // Jika 1 cabang
  return scanInfo.value.cabangs.filter(
    c => c.cab === props.selectedCabang
  );
});

const singleCabMode = computed(() => {
  return props.selectedCabang && props.selectedCabang !== 'All';
});

const lastScanHoursAgo = computed(() => {
  const ts = filteredCabangs.value?.[0]?.last_scan;
  if (!ts) return null;

  const now = Date.now();
  const diffMs = now - new Date(ts).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  // hanya tampil jika kurang dari 24 jam
  return diffHours < 24 ? diffHours : null;
});


const fmt = {
  time: dt => dt ? new Date(dt).toLocaleTimeString('id-ID') : '-',
  date: dt => dt ? new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
  ago(dt) {
    if (!dt) return '-';
    const now = Date.now();
    const diffMs = now - new Date(dt).getTime();
    const mins = diffMs / 60000, hours = diffMs / 3600000, days = diffMs / 86400000;
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${Math.floor(mins)}m ago`;
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (days < 7) return `${Math.floor(days)}d ago`;
    return this.date(dt);
  },
  agoClass(dt) {
    if (!dt) return '';
    const diff = (Date.now() - new Date(dt)) / 3600000;
    if (diff < 6) return 'time-fresh';
    if (diff < 24) return 'time-recent';
    return 'time-old';
  }
};

const fetchLastScan = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await rekapRemoteService.getLastMassScanByModule(props.moduleName);
    scanInfo.value = data || null;
    emit('scan-loaded', data);
  } catch (err) {
    error.value = err.response?.data?.message || err.message;
    emit('scan-error', error.value);
  } finally {
    loading.value = false;
  }
};

watch(() => props.moduleName, fetchLastScan);
watch(() => props.autoRefresh, setupAutoRefresh);
watch(() => props.selectedCabang, () => {
  fetchLastScan();
  expanded.value = false;  // selalu collapse ketika ganti cabang
});


function setupAutoRefresh() {
  clearInterval(refreshTimer);
  if (props.autoRefresh) {
    refreshTimer = setInterval(fetchLastScan, props.refreshInterval);
  }
}

onMounted(() => {
  fetchLastScan();
  setupAutoRefresh();
});

onBeforeUnmount(() => clearInterval(refreshTimer));
</script>

<style scoped>
/* Widget Container */
.last-scan-widget {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 200px;
    display: flex;
    flex-direction: column;
}

.last-scan-widget:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
}

/* Loading State */
.scan-loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    gap: 1rem;
}

.loading-spinner {
    font-size: 2rem;
    color: var(--primary-color, #0ea5e9);
}

.loading-text {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
}

/* Error State */
.scan-error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    gap: 1rem;
    text-align: center;
}

.error-icon {
    font-size: 2.5rem;
    color: #ef4444;
}

.error-text {
    font-size: 0.875rem;
    color: #64748b;
    max-width: 250px;
}

.retry-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.retry-button:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
}

/* Empty State */
.scan-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    gap: 1rem;
}

.empty-icon {
    font-size: 3rem;
    color: #cbd5e1;
}

.empty-text {
    font-size: 0.875rem;
    color: #94a3b8;
}

/* Success State */
.scan-info-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* Header */
.scan-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-bottom: 1px solid #e2e8f0;
}

.scan-icon-wrapper {
    position: relative;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-color, #0ea5e9), #38bdf8);
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.scan-icon {
    font-size: 1.5rem;
    color: white;
    z-index: 1;
}

.pulse-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 2px solid var(--primary-color, #0ea5e9);
    border-radius: 14px;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    opacity: 0.5;
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 0.5;
    }

    50% {
        transform: scale(1.1);
        opacity: 0;
    }
}

.scan-title-section {
    flex: 1;
}

.scan-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.scan-subtitle {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    font-weight: 500;
}

.scan-summary-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    border-radius: 10px;
    gap: 0.125rem;
}

.summary-count {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1e40af;
    line-height: 1;
}

.summary-label {
    font-size: 0.7rem;
    color: #1e40af;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* Body */
.scan-body {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* Branches Grid */
.branches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
}

.branch-card {
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.branch-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    border-color: #cbd5e1;
}

.branch-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
    border-bottom: 1px solid #e2e8f0;
}

.branch-badge {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    color: white;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}

.branch-stores-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #475569;
    font-weight: 600;
}

.branch-stores-count i {
    color: #64748b;
    font-size: 1rem;
}

.branch-card-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.scan-time-info {
    display: flex;
    align-items: center;
    gap: 0.875rem;
}

.scan-time-info>i {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    border-radius: 10px;
    font-size: 1.125rem;
    color: #1e40af;
    flex-shrink: 0;
}

.scan-time-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
}

.scan-time {
    font-size: 1.5rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.scan-date {
    font-size: 0.8125rem;
    color: #64748b;
    font-weight: 500;
}

.scan-ago-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    width: fit-content;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.scan-ago-badge.time-fresh {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
}

.scan-ago-badge.time-recent {
    background: #fef3c7;
    color: #d97706;
    border: 1px solid #fde68a;
}

.scan-ago-badge.time-old {
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
}

/* Empty state for branches */
.branches-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    gap: 1rem;
    color: #94a3b8;
}

.branches-empty i {
    font-size: 3rem;
    color: #cbd5e1;
}

/* Footer */
.scan-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #f1f5f9;
    background: #fafbfc;
}

.refresh-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.refresh-button:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
}

.refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Transitions */
.slide-fade-enter-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.slide-fade-enter-from {
    transform: translateY(-10px);
    opacity: 0;
}

.slide-fade-leave-to {
    transform: translateY(-5px);
    opacity: 0;
}

.expand-btn {
  margin-left: 1rem;
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  font-size: 1.25rem;
  color: #64748b;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.08);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, box-shadow 0.2s, background 0.2s;
  cursor: pointer;
}
.expand-btn:hover {
  color: var(--primary-color, #0ea5e9);
  background: #e0f2fe;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.12);
}
.expand-btn:active {
  background: #bae6fd;
}
.scan-header {
  position: relative;
}
.scan-header-text {
  margin-bottom: 0.25rem;
}

.scan-last-info {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.last-info-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.last-info-label i {
  font-size: 0.85rem;
  color: var(--primary-color, #0ea5e9);
}

.last-info-value {
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
}

.last-info-value .date {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
}

.last-info-value .time {
  font-size: 0.8125rem;
  color: #475569;
}

.last-info-empty {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.last-info-empty i {
  font-size: 1rem;
  color: #cbd5e1;
}

.ago-badge {
  background: #e2e8f0;
  color: #475569;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-left: 0.5rem;
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 768px) {
    .scan-header {
        padding: 1rem;
    }

    .scan-body {
        padding: 1rem;
        gap: 1rem;
    }

    .branches-grid {
        grid-template-columns: 1fr;
        gap: 0.875rem;
    }

    .scan-time {
        font-size: 1.25rem;
    }
}

@media (max-width: 640px) {
    .scan-header {
        flex-wrap: wrap;
    }

    .scan-icon-wrapper {
        width: 44px;
        height: 44px;
    }

    .scan-icon {
        font-size: 1.25rem;
    }

    .scan-title {
        font-size: 1rem;
    }

    .summary-count {
        font-size: 1.25rem;
    }

    .branch-card-header {
        padding: 0.875rem 1rem;
    }

    .branch-card-body {
        padding: 1rem;
    }
}
</style>