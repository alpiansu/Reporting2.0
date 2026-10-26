<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import logMaintenanceService from '@/services/logMaintenance.service.js';
import { formatBytes, formatDateTime } from '../utils.js';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  file: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:visible']);

const MAX_PREVIEW_BYTES = 256 * 1024;
const MAX_DISPLAY_CHARS = 1_000_000;
const MAX_SEARCH_RESULTS = 200;
const SEARCH_PAGE_LIMIT = 50;
const SEARCH_SCAN_BYTES = 2 * 1024 * 1024;

const contentEl = ref(null);
const loading = ref(false);
const loadingOlder = ref(false);
const error = ref(null);
const text = ref('');
const size = ref(0);
const nextCursor = ref(0);
const hasMore = ref(false);
const limitReached = ref(false);

const hours = ref([]);
const hoursLoading = ref(false);
const hoursError = ref(null);
const startHour = ref(null);
const endHour = ref(null);
const totalLines = ref(0);

const searchQuery = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const searchError = ref(null);
const searchCursor = ref(0);
const searchHasMore = ref(false);
const searchScanned = ref(0);
const searchLimitReached = ref(false);

let requestId = 0;
let searchRequestId = 0;
let searchTimer = null;

const visibleProxy = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const hourOptions = computed(() =>
  hours.value.map(bucket => ({
    label: `${padHour(bucket.hour)}:00`,
    value: bucket.hour,
    disabled: bucket.lines === 0,
  })),
);

const maxHourLines = computed(() =>
  Math.max(1, ...hours.value.map(bucket => bucket.lines)),
);

const selectedFrom = computed(() => {
  if (startHour.value === null || endHour.value === null) return null;
  return Math.min(startHour.value, endHour.value);
});

const selectedTo = computed(() => {
  if (startHour.value === null || endHour.value === null) return null;
  return Math.max(startHour.value, endHour.value);
});

const selectedBuckets = computed(() => {
  if (selectedFrom.value === null || selectedTo.value === null) return [];

  return hours.value.filter(
    bucket =>
      bucket.hour >= selectedFrom.value &&
      bucket.hour <= selectedTo.value &&
      bucket.lines > 0,
  );
});

const selectedLineCount = computed(() =>
  selectedBuckets.value.reduce((total, bucket) => total + bucket.lines, 0),
);

const selectedRangeStart = computed(() => {
  if (!selectedBuckets.value.length) {
    return totalLines.value === 0 && size.value > 0 ? 0 : null;
  }
  return Math.min(...selectedBuckets.value.map(bucket => bucket.startOffset));
});

const selectedRangeEnd = computed(() => {
  if (!selectedBuckets.value.length) {
    return totalLines.value === 0 && size.value > 0 ? size.value : null;
  }
  return Math.max(...selectedBuckets.value.map(bucket => bucket.endOffset));
});

const rangeLabel = computed(() => {
  if (totalLines.value === 0 && size.value > 0) {
    return 'Semua Data (Log tidak memiliki format timestamp per jam)';
  }

  if (selectedFrom.value === null || selectedTo.value === null) {
    return 'Pilih rentang jam';
  }

  if (selectedFrom.value === selectedTo.value) {
    return `${padHour(selectedFrom.value)}:00-${padHour(selectedFrom.value)}:59`;
  }

  return `${padHour(selectedFrom.value)}:00-${padHour(selectedTo.value)}:59`;
});

const renderedText = computed(() => {
  const normalized = text.value.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  if (!normalized) return '';

  return normalized.split('\n').reverse().join('\n');
});

const searchActive = computed(() => searchQuery.value.trim().length >= 2);

const isHourSelected = hour => {
  if (selectedFrom.value === null || selectedTo.value === null) return false;
  return hour >= selectedFrom.value && hour <= selectedTo.value;
};

const padHour = value => String(value).padStart(2, '0');

const hourBarHeight = bucket => {
  if (!bucket.lines) return '2px';
  return `${Math.max(4, Math.round((bucket.lines / maxHourLines.value) * 28))}px`;
};

const hourTooltip = bucket =>
  `${padHour(bucket.hour)}:00-${padHour(bucket.hour)}:59 - ${bucket.lines} baris - ${formatBytes(bucket.bytes)}`;

const resetSearchResults = () => {
  searchRequestId += 1;
  searchResults.value = [];
  searchCursor.value = 0;
  searchHasMore.value = false;
  searchScanned.value = 0;
  searchLimitReached.value = false;
  searchError.value = null;
  searchLoading.value = false;
};

const clearSearchTimer = () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
};

const clearSearch = () => {
  clearSearchTimer();
  searchQuery.value = '';
  resetSearchResults();
};

const resetViewer = () => {
  requestId += 1;
  clearSearchTimer();
  resetSearchResults();

  loading.value = false;
  loadingOlder.value = false;
  error.value = null;
  text.value = '';
  size.value = 0;
  nextCursor.value = 0;
  hasMore.value = false;
  limitReached.value = false;

  hours.value = [];
  hoursLoading.value = false;
  hoursError.value = null;
  startHour.value = null;
  endHour.value = null;
  totalLines.value = 0;
};

const initialize = async () => {
  resetViewer();
  await loadHours();
};

const loadHours = async ({ preserveSelection = false } = {}) => {
  if (!props.file?.name) return;

  const previousStart = startHour.value;
  const previousEnd = endHour.value;

  hoursLoading.value = true;
  hoursError.value = null;

  try {
    const response = await logMaintenanceService.getHours(props.file.name);
    const data = response.data;

    hours.value = Array.isArray(data.hours) ? data.hours : [];
    size.value = data.size || 0;
    totalLines.value = data.totalLines || 0;

    const available = hours.value.filter(bucket => bucket.lines > 0);
    const latest = available[available.length - 1]?.hour ?? null;
    const keepPrevious =
      preserveSelection &&
      previousStart !== null &&
      previousEnd !== null &&
      available.some(bucket => bucket.hour === previousStart) &&
      available.some(bucket => bucket.hour === previousEnd);

    startHour.value = keepPrevious ? previousStart : latest;
    endHour.value = keepPrevious ? previousEnd : latest;

    await loadSelectedRange();
  } catch (err) {
    hoursError.value = err.message || 'Gagal memuat timeline log';
  } finally {
    hoursLoading.value = false;
  }
};

const loadSelectedRange = async ({ cursor, jumpToMatch = false } = {}) => {
  if (!props.file?.name) return;

  const rangeStart = selectedRangeStart.value;
  const rangeEnd = selectedRangeEnd.value;
  const resetMode = cursor === undefined || jumpToMatch;

  if (rangeStart === null || rangeEnd === null) {
    requestId += 1;
    text.value = '';
    nextCursor.value = 0;
    hasMore.value = false;
    limitReached.value = false;
    error.value = null;
    loading.value = false;
    loadingOlder.value = false;
    return;
  }

  const currentRequest = ++requestId;
  const previousHeight = contentEl.value?.scrollHeight || 0;

  if (resetMode) {
    loading.value = true;
    loadingOlder.value = false;
    text.value = '';
    limitReached.value = false;
  } else {
    loadingOlder.value = true;
  }

  error.value = null;

  try {
    const response = await logMaintenanceService.getContent(props.file.name, {
      cursor,
      maxBytes: MAX_PREVIEW_BYTES,
      startOffset: rangeStart,
      endOffset: rangeEnd,
    });

    if (currentRequest !== requestId) return;

    const data = response.data;

    text.value = resetMode ? data.text || '' : `${data.text || ''}${text.value}`;
    size.value = data.size || size.value;
    nextCursor.value = data.nextCursor || 0;
    hasMore.value = Boolean(data.hasMore);

    if (text.value.length >= MAX_DISPLAY_CHARS) {
      limitReached.value = true;
    }

    await nextTick();

    if (contentEl.value) {
      contentEl.value.scrollTop = resetMode ? 0 : previousHeight;
    }
  } catch (err) {
    if (currentRequest === requestId) {
      error.value = err.message || 'Gagal memuat isi log';
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false;
      loadingOlder.value = false;
    }
  }
};

const loadOlder = () => {
  if (
    !hasMore.value ||
    limitReached.value ||
    nextCursor.value <= 0 ||
    loading.value ||
    loadingOlder.value
  ) {
    return;
  }

  loadSelectedRange({ cursor: nextCursor.value });
};

const handleStartChange = () => {
  if (startHour.value === null) return;
  if (endHour.value === null || endHour.value < startHour.value) {
    endHour.value = startHour.value;
  }
  loadSelectedRange();
};

const handleEndChange = () => {
  if (endHour.value === null) return;
  if (startHour.value === null || endHour.value < startHour.value) {
    startHour.value = endHour.value;
  }
  loadSelectedRange();
};

const selectHour = bucket => {
  if (!bucket || !bucket.lines) return;
  startHour.value = bucket.hour;
  endHour.value = bucket.hour;
  loadSelectedRange();
};

const refreshAll = async () => {
  await loadHours({ preserveSelection: true });
  if (searchActive.value) {
    runSearch(true);
  }
};

const onSearchInput = event => {
  clearSearchTimer();

  const query = String(event?.target?.value ?? searchQuery.value).trim();
  if (query.length < 2) {
    resetSearchResults();
    return;
  }

  resetSearchResults();
  searchLoading.value = true;
  searchTimer = setTimeout(() => {
    searchTimer = null;
    runSearch(true);
  }, 450);
};

const runSearch = async reset => {
  clearSearchTimer();

  const query = searchQuery.value.trim();
  if (!props.file?.name || query.length < 2) return;
  if (!reset && searchLoading.value) return;
  if (!reset && searchResults.value.length >= MAX_SEARCH_RESULTS) {
    searchLimitReached.value = true;
    return;
  }

  const currentRequest = ++searchRequestId;

  if (reset) {
    searchResults.value = [];
    searchCursor.value = 0;
    searchScanned.value = 0;
    searchHasMore.value = false;
    searchLimitReached.value = false;
  }

  searchLoading.value = true;
  searchError.value = null;

  try {
    const response = await logMaintenanceService.search(props.file.name, {
      q: query,
      cursor: reset ? undefined : searchCursor.value,
      limit: SEARCH_PAGE_LIMIT,
    });

    if (currentRequest !== searchRequestId) return;

    const data = response.data;
    const newResults = Array.isArray(data.results) ? data.results : [];
    const existingOffsets = new Set(searchResults.value.map(item => item.offset));
    const merged = searchResults.value.concat(
      newResults.filter(item => !existingOffsets.has(item.offset)),
    );

    searchResults.value = merged.slice(0, MAX_SEARCH_RESULTS);
    searchLimitReached.value = searchResults.value.length >= MAX_SEARCH_RESULTS;
    searchCursor.value = data.nextCursor || 0;
    searchHasMore.value = Boolean(data.hasMore) && !searchLimitReached.value;
    searchScanned.value += data.scannedBytes || 0;
  } catch (err) {
    if (currentRequest === searchRequestId) {
      searchError.value = err.message || 'Gagal mencari log';
    }
  } finally {
    if (currentRequest === searchRequestId) {
      searchLoading.value = false;
    }
  }
};

const openSearchResult = result => {
  if (!result || result.hour === null || result.hour === undefined) return;

  const bucketExists = hours.value.some(
    bucket => bucket.hour === result.hour && bucket.lines > 0,
  );
  if (!bucketExists) return;

  startHour.value = result.hour;
  endHour.value = result.hour;
  loadSelectedRange({
    cursor: result.endOffset ?? 0,
    jumpToMatch: true,
  });
};

onBeforeUnmount(() => {
  requestId += 1;
  searchRequestId += 1;
  clearSearchTimer();
});
</script>

<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    :header="`Log: ${file?.name || '-'}`"
    :style="{ width: '92vw', maxWidth: '1400px' }"
    :breakpoints="{ '1200px': '96vw' }"
    class="log-viewer-dialog"
    :draggable="false"
    @show="initialize"
  >
    <div class="log-viewer">
      <div class="log-meta">
        <span><strong>Ukuran:</strong> {{ formatBytes(file?.size || 0) }}</span>
        <span><strong>Diubah:</strong> {{ formatDateTime(file?.modifiedAt) }}</span>
      </div>

      <div class="viewer-controls">
        <div class="range-controls">
          <span class="control-label">Rentang</span>
          <Dropdown
            v-model="startHour"
            :options="hourOptions"
            optionLabel="label"
            optionValue="value"
            :optionDisabled="option => option.disabled"
            placeholder="Dari"
            class="hour-dropdown"
            :disabled="hoursLoading || !hourOptions.length"
            @change="handleStartChange"
          />
          <span class="range-separator">s/d</span>
          <Dropdown
            v-model="endHour"
            :options="hourOptions"
            optionLabel="label"
            optionValue="value"
            :optionDisabled="option => option.disabled"
            placeholder="Sampai"
            class="hour-dropdown"
            :disabled="hoursLoading || !hourOptions.length"
            @change="handleEndChange"
          />
          <Button
            icon="pi pi-refresh"
            label="Refresh"
            class="p-button-text p-button-sm refresh-button"
            :loading="hoursLoading || loading"
            v-tooltip.top="'Muat ulang timeline dan isi log'"
            @click="refreshAll"
          />
        </div>

        <div class="search-controls">
          <IconField iconPosition="left" class="search-icon-field">
            <InputIcon><i class="pi pi-search" /></InputIcon>
            <InputText
              v-model="searchQuery"
              placeholder="Cari log (min. 2 karakter)..."
              class="search-input"
              :disabled="hoursLoading || !hours.length"
              @input="onSearchInput"
              @keyup.enter="runSearch(true)"
            />
          </IconField>
          <Button
            v-if="searchQuery"
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-sm"
            v-tooltip.top="'Hapus pencarian'"
            @click="clearSearch"
          />
        </div>
      </div>

      <div v-if="hoursLoading" class="timeline-state">
        <i class="pi pi-spin pi-spinner" />
        <span>Memuat timeline...</span>
      </div>
      <div v-else-if="hoursError" class="timeline-state timeline-state--error">
        {{ hoursError }}
      </div>
      <div v-else class="timeline-wrap">
        <div class="hour-timeline">
          <button
            v-for="bucket in hours"
            :key="bucket.hour"
            type="button"
            class="hour-bar"
            :class="{
              'hour-bar--selected': isHourSelected(bucket.hour),
              'hour-bar--empty': !bucket.lines,
            }"
            :disabled="!bucket.lines"
            v-tooltip.top="hourTooltip(bucket)"
            @click="selectHour(bucket)"
          >
            <span class="hour-track">
              <span
                class="hour-fill"
                :style="{ height: hourBarHeight(bucket) }"
              />
            </span>
            <span class="hour-label">{{ padHour(bucket.hour) }}</span>
            <span class="hour-count">{{ bucket.lines || '' }}</span>
          </button>
        </div>
        <div class="timeline-summary">
          <span>{{ rangeLabel }} - {{ selectedLineCount }} baris</span>
          <span>{{ totalLines }} baris total - {{ formatBytes(size) }}</span>
        </div>
      </div>

      <div v-if="searchActive" class="search-panel">
        <div class="search-panel-head">
          <span class="search-title">
            Hasil pencarian "{{ searchQuery.trim() }}"
          </span>
          <span class="search-meta">
            {{ searchResults.length }} hasil - {{ formatBytes(searchScanned) }}
            dipindai
          </span>
        </div>

        <div v-if="searchLoading" class="search-state">
          <i class="pi pi-spin pi-spinner" />
          <span>Mencari...</span>
        </div>
        <div v-else-if="searchError" class="search-state search-state--error">
          {{ searchError }}
        </div>
        <div v-else-if="!searchResults.length" class="search-state">
          Tidak ada hasil pada bagian log yang dipindai.
        </div>
        <div v-else class="search-results">
          <button
            v-for="result in searchResults"
            :key="result.offset"
            type="button"
            class="search-result"
            @click="openSearchResult(result)"
          >
            <span class="search-result-meta">
              <span class="search-time">{{ result.timestamp || '-' }}</span>
              <span
                v-if="result.level"
                class="search-level"
                :class="`search-level--${result.level}`"
              >
                {{ result.level }}
              </span>
            </span>
            <span class="search-message">{{ result.message }}</span>
          </button>
        </div>

        <div class="search-actions">
          <Button
            v-if="searchHasMore"
            label="Cari Lebih Lama"
            icon="pi pi-arrow-up"
            class="p-button-sm p-button-outlined"
            :loading="searchLoading"
            @click="runSearch(false)"
          />
          <span v-if="searchLimitReached" class="log-hint">
            Batas {{ MAX_SEARCH_RESULTS }} hasil tercapai. Persempit kata kunci.
          </span>
          <span v-else-if="searchHasMore" class="log-hint">
            Klik untuk memindai {{ formatBytes(SEARCH_SCAN_BYTES) }} lebih lama.
          </span>
          <span v-else-if="searchResults.length" class="log-hint">
            Semua bagian file sudah dipindai.
          </span>
        </div>
      </div>

      <div v-if="loading" class="log-state">
        <i class="pi pi-spin pi-spinner" />
        <span>Memuat log...</span>
      </div>

      <template v-else>
        <div v-if="error" class="log-notice log-notice--error">
          <span>{{ error }}</span>
          <Button
            label="Coba Lagi"
            icon="pi pi-refresh"
            class="p-button-sm p-button-text"
            @click="loadSelectedRange()"
          />
        </div>

        <pre
          v-if="text || !error"
          ref="contentEl"
          class="log-output"
        >{{ renderedText || '(tidak ada log pada rentang jam ini)' }}</pre>

        <div v-if="text" class="log-actions">
          <Button
            label="Muat Lebih Lama"
            icon="pi pi-arrow-down"
            class="p-button-sm p-button-outlined"
            :loading="loadingOlder"
            :disabled="!hasMore || loadingOlder || limitReached"
            @click="loadOlder"
          />
          <span v-if="limitReached" class="log-hint">
            Batas tampilan tercapai. Pilih jam lain atau cari teks tertentu.
          </span>
          <span v-else-if="hasMore" class="log-hint">
            Data lebih lama tersedia ({{ formatBytes(MAX_PREVIEW_BYTES) }} per
            muat).
          </span>
          <span v-else class="log-hint">
            Awal rentang jam sudah tercapai.
          </span>
        </div>
      </template>
    </div>
  </Dialog>
</template>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  font-size: 0.82rem;
  color: #64748b;
}

.log-meta strong {
  color: #334155;
}

.viewer-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.range-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.control-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
}

.range-separator {
  font-size: 0.78rem;
  color: #94a3b8;
}

.hour-dropdown {
  width: 110px;
}

.refresh-button {
  margin-left: 0.25rem;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  min-width: 240px;
  max-width: 560px;
}

.search-input {
  width: 100%;
}

.search-icon-field {
  flex: 1;
  width: 100%;
  min-width: 0;
}

.timeline-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 64px;
  color: #64748b;
  font-size: 0.85rem;
}

.timeline-state--error {
  color: #b91c1c;
}

.timeline-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hour-timeline {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 2px;
  padding: 0.4rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.hour-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.hour-bar:disabled {
  cursor: default;
  opacity: 0.45;
}

.hour-track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 30px;
  overflow: hidden;
  border-radius: 4px;
  background: #e2e8f0;
}

.hour-fill {
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: #3b82f6;
  transition: height 0.2s ease;
}

.hour-bar--selected .hour-track {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

.hour-bar--selected .hour-fill {
  background: #1d4ed8;
}

.hour-bar--empty .hour-fill {
  background: #cbd5e1;
}

.hour-label {
  font-size: 0.62rem;
  line-height: 1;
  color: #64748b;
}

.hour-bar--selected .hour-label {
  font-weight: 700;
  color: #1d4ed8;
}

.hour-count {
  height: 10px;
  font-size: 0.55rem;
  line-height: 1;
  color: #94a3b8;
}

.timeline-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  font-size: 0.78rem;
  color: #64748b;
}

.search-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
}

.search-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
}

.search-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e3a8a;
}

.search-meta {
  font-size: 0.75rem;
  color: #64748b;
}

.search-state {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0;
  font-size: 0.8rem;
  color: #64748b;
}

.search-state--error {
  color: #b91c1c;
}

.search-results {
  display: flex;
  flex-direction: column;
  max-height: 180px;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.search-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.45rem 0.6rem;
  border: 0;
  border-bottom: 1px solid #f1f5f9;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.search-result:last-child {
  border-bottom: 0;
}

.search-result:hover {
  background: #eff6ff;
}

.search-result-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: #64748b;
}

.search-time {
  font-family: Consolas, "Courier New", monospace;
}

.search-level {
  padding: 0 0.3rem;
  border-radius: 4px;
  background: #e2e8f0;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.search-level--error,
.search-level--fatal {
  background: #fee2e2;
  color: #991b1b;
}

.search-level--warn,
.search-level--warning {
  background: #fef3c7;
  color: #92400e;
}

.search-level--info {
  background: #dbeafe;
  color: #1e40af;
}

.search-message {
  overflow-wrap: anywhere;
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.75rem;
  color: #334155;
}

.search-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.log-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 280px;
  color: #64748b;
}

.log-state i {
  font-size: 1.6rem;
}

.log-state--error {
  color: #b91c1c;
}

.log-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.82rem;
}

.log-notice--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.log-output {
  margin: 0;
  padding: 1rem;
  height: clamp(240px, 46vh, 560px);
  overflow: auto;
  border-radius: 10px;
  border: 1px solid #1e293b;
  background: #0f172a;
  color: #e2e8f0;
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.55;
  white-space: pre;
  tab-size: 2;
}

.log-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.log-hint {
  font-size: 0.8rem;
  color: #64748b;
}
</style>
