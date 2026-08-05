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

<style scoped src="./LastScanInfo.style.css"></style>