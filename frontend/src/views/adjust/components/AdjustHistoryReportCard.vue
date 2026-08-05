<template>
  <div class="adjust-history-report-card">
    <div class="card-header">
      <div class="header-content">
        <div class="title-section">
          <div class="icon-wrapper">
            <i class="pi pi-chart-line"></i>
          </div>
          <div class="text-content">
            <h2 class="card-title">Laporan History Adjust</h2>
            <p class="card-subtitle">Filter dan ekspor riwayat adjust berdasarkan periode, PIC, dan toko</p>
          </div>
        </div>
      </div>
    </div>

    <div class="filters-section">
      <div class="filters-grid">
        <div class="filter-group">
          <label class="filter-label">Periode Bulan</label>
          <div class="filter-control">
            <DatePicker v-model="monthDate" view="month" dateFormat="yy-mm" showIcon class="month-picker"
              @update:modelValue="onMonthChange" />
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Status</label>
          <div class="filter-control">
            <Dropdown v-model="status" :options="statusOptions" optionLabel="label" optionValue="value"
              class="status-dropdown" placeholder="Pilih status">
              <template #value="slotProps">
                <div v-if="slotProps.value === 'ALL'" class="status-display">
                  <span class="status-badge all">All Status</span>
                </div>
                <div v-else-if="slotProps.value === 'SUCCESS'" class="status-display">
                  <span class="status-badge success">
                    <i class="pi pi-check-circle"></i>
                    SUCCESS
                  </span>
                </div>
                <div v-else-if="slotProps.value === 'FAILED'" class="status-display">
                  <span class="status-badge failed">
                    <i class="pi pi-times-circle"></i>
                    FAILED
                  </span>
                </div>
              </template>

              <template #option="slotProps">
                <div class="status-option">
                  <span :class="['status-badge', getStatusClass(slotProps.option.value)]">
                    <i :class="getStatusIcon(slotProps.option.value)"></i>
                    {{ slotProps.option.label }}
                  </span>
                </div>
              </template>
            </Dropdown>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">PIC</label>
          <div class="filter-control">
            <div class="radio-toggle-group">
              <div class="toggle-option">
                <RadioButton inputId="pic-all" name="pic-mode" value="all" v-model="picMode" />
                <label for="pic-all">Semua PIC</label>
              </div>
              <div class="toggle-option">
                <RadioButton inputId="pic-select" name="pic-mode" value="select" v-model="picMode" />
                <label for="pic-select">Pilih PIC</label>
              </div>
            </div>

            <AutoComplete v-model="pic" :suggestions="picSuggestions" :disabled="picMode === 'all'"
              optionLabel="username" class="autocomplete-field" placeholder="Cari nama PIC..." @complete="searchPic"
              :minLength="2" forceSelection showClear>
              <template #option="slotProps">
                <div class="pic-suggestion-item">
                  <i class="pi pi-user"></i>
                  <div class="pic-info">
                    <span class="pic-username">{{ slotProps.option.username }}</span>
                    <span class="pic-fullname" v-if="slotProps.option.fullName">{{ slotProps.option.fullName }}</span>
                  </div>
                </div>
              </template>
            </AutoComplete>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Toko (KDTK)</label>
          <div class="filter-control">
            <div class="radio-toggle-group">
              <div class="toggle-option">
                <RadioButton inputId="kdtk-all" name="kdtk-mode" value="all" v-model="kdtkMode" />
                <label for="kdtk-all">Semua Toko</label>
              </div>
              <div class="toggle-option">
                <RadioButton inputId="kdtk-select" name="kdtk-mode" value="select" v-model="kdtkMode" />
                <label for="kdtk-select">Pilih Toko</label>
              </div>
            </div>
            
            <AutoComplete v-model="selectedKdtks" :suggestions="kdtkSuggestions" multiple :disabled="kdtkMode === 'all'"
              optionLabel="storeCode" class="autocomplete-field" placeholder="Cari kode toko..." @complete="searchKdtk"
              @paste="onPasteKdtk" :minLength="2">
              <template #option="slotProps">
                <div class="kdtk-suggestion-item">
                  <i class="pi pi-building"></i>
                  <div class="kdtk-info">
                    <span class="kdtk-code">{{ slotProps.option.storeCode }}</span>
                    <span class="kdtk-name" v-if="slotProps.option.storeName">{{ slotProps.option.storeName }}</span>
                  </div>
                </div>
              </template>
            </AutoComplete>

            <div class="selection-info" v-if="selectedKdtks.length">
              <span class="badge">{{ selectedKdtks.length }} toko dipilih</span>
              <Button icon="pi pi-times" label="Clear" class="p-button-text clear-selection-btn" @click="clearKdtk"
                :disabled="loading" />
            </div>
          </div>
        </div>
      </div>

      <div class="active-filters-summary" v-if="hasActiveFilters">
        <div class="summary-content">
          <span class="summary-label">Filter aktif:</span>
          <div class="filter-tags">
            <Chip v-if="picMode === 'select' && pic" :label="`PIC: ${getPicDisplayName}`" class="filter-chip" removable
              @remove="pic = ''" />
            <Chip v-if="kdtkMode === 'select' && selectedKdtks.length" :label="`${selectedKdtks.length} toko`"
              class="filter-chip" removable @remove="clearKdtk" />
            <Chip v-if="status && status !== 'ALL'"
              :label="`Status: ${statusOptions.find(o => o.value === status)?.label}`" class="filter-chip" removable
              @remove="status = 'ALL'" />
          </div>
        </div>
      </div>

      <div class="actions-section">
        <div class="actions-content">
          <Button icon="pi pi-refresh" label="Reset Filter" class="p-button-outlined reset-btn" @click="resetFilters"
            :loading="loading" />
          <Button icon="pi pi-file-export" label="Export CSV" class="export-btn" @click="handleExport"
            :loading="loading" :disabled="!isFormValid" />
        </div>
        <div v-if="!isFormValid" class="validation-message">
          <i class="pi pi-exclamation-triangle"></i>
          {{ validationMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import AutoComplete from 'primevue/autocomplete';
import Dropdown from 'primevue/dropdown';
import DatePicker from 'primevue/datepicker';
import RadioButton from 'primevue/radiobutton';
import Button from 'primevue/button';
import Chip from 'primevue/chip';
import adjustService from "../../../services/adjust.service.js";
import storeService from "../../../services/store.service.js";
import { userService } from "../../../services/index.js";
import { useToast } from "primevue/usetoast";

const toast = useToast();

const month = ref(new Date().toISOString().slice(0, 7));
const monthDate = ref(new Date());
const picMode = ref('all');
const pic = ref('');
const kdtkMode = ref('all');
const selectedKdtks = ref([]);
const kdtkSuggestions = ref([]);
const status = ref('ALL');
const statusOptions = [
  { label: 'All Status', value: 'ALL' },
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'FAILED', value: 'FAILED' }
];
const loading = ref(false);
const filters = ref({ pics: [], kdtks: [] });
const picSuggestions = ref([]);

// ---------------------------------------------------------------------------
// Helper lokal: akses pic.value dengan aman (null-safe)
// PrimeVue AutoComplete dengan showClear mengeset v-model ke null (bukan '')
// saat user klik tombol clear, sehingga typeof null === 'object' akan crash
// ---------------------------------------------------------------------------

/** Kembalikan username string dari pic.value, apapun bentuknya (object/string/null) */
const getPicValue = () => {
  if (!pic.value) return '';
  if (typeof pic.value === 'object') return pic.value.username ?? '';
  return String(pic.value);
};

/** Apakah user sudah memilih PIC yang valid? */
const hasPicSelected = () => getPicValue() !== '';

// ---------------------------------------------------------------------------

// Computed property to check if any filters are active
const hasActiveFilters = computed(() =>
  (picMode.value === 'select' && hasPicSelected()) ||
  (kdtkMode.value === 'select' && selectedKdtks.value.length > 0) ||
  (status.value && status.value !== 'ALL')
);

// Computed property to get PIC display name
const getPicDisplayName = computed(() => {
  if (!hasPicSelected()) return '';
  if (typeof pic.value === 'object') {
    return pic.value.fullName
      ? `${pic.value.username} (${pic.value.fullName})`
      : pic.value.username ?? '';
  }
  return String(pic.value);
});

// Validation computed properties
const isFormValid = computed(() => {
  if (picMode.value === 'select' && !hasPicSelected()) return false;
  if (kdtkMode.value === 'select' && selectedKdtks.value.length === 0) return false;
  return true;
});

const validationMessage = computed(() => {
  if (picMode.value === 'select' && !hasPicSelected()) return 'Harap pilih PIC terlebih dahulu';
  if (kdtkMode.value === 'select' && selectedKdtks.value.length === 0) return 'Harap pilih minimal satu toko';
  return '';
});

onMounted(async () => {
  await loadFilters();
});

const loadFilters = async () => {
  try {
    const resp = await adjustService.getFilters();
    filters.value = resp.data || { pics: [], kdtks: [] };
  } catch (e) {
    filters.value = { pics: [], kdtks: [] };
  }
};

const onPasteKdtk = (e) => {
  if (kdtkMode.value === 'all') return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const list = text.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).map(s => s.toUpperCase());
  // Convert pasted codes to objects
  const newStores = list.map(code => ({
    storeCode: code,
    storeName: ''
  }));
  // Merge with existing, avoid duplicates
  const allStores = [...selectedKdtks.value, ...newStores];
  const uniqueStores = Array.from(
    new Map(allStores.map(item => [item.storeCode, item])).values()
  );
  selectedKdtks.value = uniqueStores;
};

const clearKdtk = () => {
  selectedKdtks.value = [];
};

const searchKdtk = (event) => {
  const q = (event.query || '').trim();
  if (!q || q.length < 2) {
    kdtkSuggestions.value = [];
    return;
  }

  // Ambil dari module store (pagination + search)
  storeService.getAllStores({ page: 1, limit: 20, search: q })
    .then(resp => {
      const payload = resp.data || resp; // adapt to service shape
      const stores = (payload.stores || payload.data?.stores || [])
        .filter(s => s.storeCode)
        .map(s => ({
          storeCode: s.storeCode,
          storeName: s.storeName || s.name || ''
        }));
      // Hindari duplikat berdasarkan storeCode
      const uniqueStores = Array.from(
        new Map(stores.map(item => [item.storeCode, item])).values()
      );
      kdtkSuggestions.value = uniqueStores;
    })
    .catch(() => { kdtkSuggestions.value = []; });
};

// Updated function to search for PICs using the userService with search endpoint
const searchPic = async (event) => {
  const query = (event.query || '').trim();

  if (!query || query.length < 2) {
    picSuggestions.value = [];
    return;
  }

  try {
    // Fetch users from backend API using userService search endpoint
    const response = await userService.searchUsers(query);
    const users = response.data || [];

    // Extract usernames
    const usernames = users
      .filter(u => u.username)
      .slice(0, 20)
      .map(u => ({
        username: u.username,
        fullName: u.fullName
      }));

    picSuggestions.value = usernames;
  } catch (error) {
    console.error('Error searching users:', error);
    picSuggestions.value = [];
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Gagal mencari PIC. Silakan coba lagi.',
      life: 3000
    });
  }
};

const buildParams = () => {
  const params = { month: month.value };
  if (picMode.value === 'select' && hasPicSelected()) {
    params.pic = getPicValue();
  }
  if (status.value && status.value !== 'ALL') {
    params.status = status.value;
  }
  if (kdtkMode.value === 'select' && selectedKdtks.value.length) {
    params.kdtk = selectedKdtks.value.map(k =>
      typeof k === 'object' ? k.storeCode : k
    );
  }
  return params;
};

const resetFilters = async () => {
  month.value = new Date().toISOString().slice(0, 7);
  monthDate.value = new Date();
  picMode.value = 'all';
  pic.value = '';
  kdtkMode.value = 'all';
  selectedKdtks.value = [];
  status.value = 'ALL';
};

const handleExport = async () => {
  if (!isFormValid.value) {
    toast.add({
      severity: 'warn',
      summary: 'Validasi Gagal',
      detail: validationMessage.value,
      life: 3000
    });
    return;
  }

  exportCsv();
};

const exportCsv = async () => {
  loading.value = true;
  try {
    await adjustService.exportHistoryCsv(buildParams());
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'File CSV berhasil diunduh',
      life: 3000
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Gagal mengekspor data. Silakan coba lagi.',
      life: 5000
    });
    console.error('Export error:', error);
  } finally {
    loading.value = false;
  }
};

const onMonthChange = (val) => {
  try {
    const d = new Date(val);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    month.value = `${y}-${m}`;
  } catch { }
};

// Helper functions for status display
const getStatusClass = (status) => {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'failed';
    case 'ALL': return 'all';
    default: return 'all';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'SUCCESS': return 'pi pi-check-circle';
    case 'FAILED': return 'pi pi-times-circle';
    default: return '';
  }
};
</script>

<style scoped src="./AdjustHistoryReportCard.style.css"></style>