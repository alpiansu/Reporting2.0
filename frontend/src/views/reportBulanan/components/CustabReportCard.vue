<template>
  <Card>
    <template #content>
      <div class="custab-form">
        <h3>Laporan Sales Custab Custom (Harian)</h3>
        <p class="subtitle">Laporan penjualan per jam dengan format identik sistem legacy</p>

        <!-- Row 1: Cabang + Periode Awal + Periode Akhir -->
        <div class="form-row form-row--3col">
          <CabangSelect
            v-model="cabang"
            :options="cabangOptions"
            :disabled="isDownloading"
            show-error
            @update:model-value="onCabangChange"
          />

          <div class="field">
            <label>Periode Awal <span class="required">*</span></label>
            <Calendar
              v-model="prdLap"
              :min-date="minDate"
              :max-date="maxDate"
              placeholder="Pilih Tanggal"
              :disabled="isDownloading"
              date-format="yy-mm-dd"
            />
            <small>Pilih tanggal di bulan yang diinginkan</small>
          </div>

          <div class="field">
            <label>Periode Akhir <span class="required">*</span></label>
            <Calendar
              v-model="prdLap2"
              :min-date="prdLap2Min"
              :max-date="prdLap2Max"
              placeholder="Pilih Tanggal"
              :disabled="isDownloading || !prdLap"
              date-format="yy-mm-dd"
            />
            <small v-if="prdLap">{{ prdLap2Hint }}</small>
          </div>
        </div>

        <!-- Row 2: Upload CSV PLU -->
        <div class="form-row form-row--full">
          <div class="field">
            <label>Upload File PLU (CSV) <span class="required">*</span></label>
            <div class="csv-uploader">
              <FileUpload
                mode="basic"
                accept=".csv"
                :maxFileSize="1 * 1024 * 1024"
                :disabled="isDownloading"
                @select="onFileSelect"
                chooseLabel="Pilih File CSV"
              />
              <Button
                label="Unduh Template"
                icon="pi pi-download"
                class="p-button-outlined p-button-info p-button-sm template-btn"
                :disabled="isDownloading"
                @click="downloadTemplate"
              />
            </div>
            <div class="csv-help">
              <small>Format yang didukung: satu kolom kode PLU (angka saja), satu per baris.</small>
              <small>Dapat diunggah dengan atau tanpa header — header (PRDCD/plu/kode) akan otomatis dilewati.</small>
              <small>Maksimal 5.000 PLU, ukuran file maksimal 1 MB.</small>
            </div>
            <small v-if="csvError" class="error">{{ csvError }}</small>
            <div v-if="csvSummary" class="csv-summary">
              <small class="success">{{ csvSummary.valid }} PLU valid dari {{ csvSummary.total }} baris</small>
              <small v-if="csvSummary.duplicates > 0" class="warn">{{ csvSummary.duplicates }} duplikat diabaikan</small>
              <small v-if="csvSummary.invalid > 0" class="error">{{ csvSummary.invalid }} baris tidak valid</small>
              <small v-if="csvSummary.truncated" class="warn">Maksimal 5.000 PLU diproses, sisanya diabaikan</small>
            </div>
          </div>
        </div>

        <!-- Row 3: Shop Filter -->
        <div class="form-row">
          <div class="field">
            <label>Filter Toko</label>
            <div class="shop-options">
              <RadioButton
                v-model="shopMode"
                value="all"
                inputId="shop-all"
                :disabled="isDownloading"
              />
              <label for="shop-all">Semua Toko</label>

              <RadioButton
                v-model="shopMode"
                value="custom"
                inputId="shop-custom"
                :disabled="isDownloading"
              />
              <label for="shop-custom">Kustom Toko</label>
            </div>

            <MultiSelect
              v-if="shopMode === 'custom'"
              ref="storeSelect"
              v-model="selectedShops"
              :options="shopOptions"
              optionLabel="label"
              optionValue="kdtk"
              placeholder="Ketik untuk mencari toko..."
              filter
              :autoFilter="false"
              :maxSelectedLabels="3"
              :disabled="!cabang || isDownloading || loadingShops"
              :loading="loadingShops"
              class="w-full"
              @filter="onStoreFilter"
              @show="focusStoreFilter"
            />
            <small v-if="shopMode === 'custom' && selectedShops.length > 0">
              {{ selectedShops.length }} toko dipilih
            </small>
            <small v-if="shopMode === 'custom' && !cabang">Pilih cabang terlebih dahulu</small>
          </div>
        </div>

        <!-- Row 4: Action -->
        <div class="form-row actions">
          <Button
            label="Download Laporan CSV"
            icon="pi pi-download"
            :disabled="!canDownload || isDownloading"
            :loading="isDownloading"
            class="p-button-success"
            @click="handleDownload"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useCabangStore } from '@/stores';
import { useToastService } from '@/utils/toast';
import salesCustabService from '@/services/salesCustab.service';
import StoreService from '@/services/store.service';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Calendar from 'primevue/calendar';
import FileUpload from 'primevue/fileupload';
import RadioButton from 'primevue/radiobutton';
import MultiSelect from 'primevue/multiselect';
import CabangSelect from './CabangSelect.vue';

const toast = useToastService();
const cabangStore = useCabangStore();

const cabang = ref('');
const prdLap = ref(null);
const prdLap2 = ref(null);
const shopMode = ref('all');
const selectedShops = ref([]);
const csvFile = ref(null);
const csvSummary = ref(null);
const csvError = ref('');
const isDownloading = ref(false);
const shopOptions = ref([]);
const loadingShops = ref(false);
const storeSelect = ref(null);

const cabangOptions = computed(() => cabangStore.allCabang || []);

const today = new Date();
const minDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
const maxDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

const prdLap2Min = computed(() => prdLap.value ? new Date(prdLap.value) : null);
const prdLap2Max = ref(null);

watch(prdLap, (newVal) => {
  if (!newVal) {
    prdLap2.value = null;
    prdLap2Max.value = null;
    return;
  }

  const selected = new Date(newVal);
  const isCurrentMonth = selected.getFullYear() === today.getFullYear() &&
                          selected.getMonth() === today.getMonth();

  if (isCurrentMonth) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    prdLap2Max.value = yesterday;
  } else {
    const lastDay = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    prdLap2Max.value = lastDay;
  }

  if (prdLap2.value && (prdLap2.value < newVal || prdLap2.value > prdLap2Max.value)) {
    prdLap2.value = new Date(newVal);
  }
});

const prdLap2Hint = computed(() => {
  if (!prdLap.value) return '';
  const selected = new Date(prdLap.value);
  const isCurrentMonth = selected.getFullYear() === today.getFullYear() &&
                          selected.getMonth() === today.getMonth();

  if (isCurrentMonth) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return `Maksimal: ${yesterday.toISOString().split('T')[0]} (H-1)`;
  } else {
    const lastDay = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    return `Maksimal: ${lastDay.toISOString().split('T')[0]} (akhir bulan)`;
  }
});

const onCabangChange = () => {
  selectedShops.value = [];
  shopOptions.value = [];

  // Tidak load semua toko sekaligus — akan di-fetch via live search saat user mengetik
};

// ─── Live search toko (pola halaman Virtual Margin Based) ────────────────────
const focusStoreFilter = () => {
  setTimeout(() => {
    if (storeSelect.value && storeSelect.value.$el) {
      const filterInput = storeSelect.value.$el.querySelector('.p-multiselect-filter');
      if (filterInput) {
        filterInput.focus();
      }
    }
  }, 100);
};

const fetchStores = async (search = '') => {
  if (!cabang.value) return;

  try {
    loadingShops.value = true;
    const response = await StoreService.getStoresByBranch(cabang.value, {
      limit: 20,
      onlyInduk: true,
      search: search.trim(),
    });

    const stores = response.data?.stores || [];
    const newOptions = stores.map(s => ({
      kdtk: s.storeCode,
      label: `${s.storeCode} - ${s.storeName}`,
    }));

    // Gabungkan dengan toko yang sedang terpilih agar label tidak hilang
    const currentSelected = shopOptions.value.filter(opt => (selectedShops.value || []).includes(opt.kdtk));

    // Gunakan Map untuk unikisasi berdasarkan kdtk
    const uniqueOptionsMap = new Map();
    [...currentSelected, ...newOptions].forEach(opt => {
      uniqueOptionsMap.set(opt.kdtk, opt);
    });

    shopOptions.value = Array.from(uniqueOptionsMap.values());
  } catch (error) {
    console.error('Error fetching shops:', error);
    toast.showError('Gagal', 'Gagal memuat daftar toko');
  } finally {
    loadingShops.value = false;
  }
};

let filterTimeout = null;
const onStoreFilter = (event) => {
  const query = event.value;

  if (filterTimeout) clearTimeout(filterTimeout);

  if (query && query.length >= 2) {
    filterTimeout = setTimeout(() => {
      fetchStores(query);
    }, 500);
  }
};

const onFileSelect = (event) => {
  const file = event.files[0];
  if (!file) return;

  csvError.value = '';
  csvSummary.value = null;

  if (!file.name.endsWith('.csv')) {
    csvError.value = 'File harus berformat .csv';
    csvFile.value = null;
    return;
  }

  if (file.size > 1 * 1024 * 1024) {
    csvError.value = 'Ukuran file maksimal 1MB';
    csvFile.value = null;
    return;
  }

  csvFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    csvSummary.value = analyzeCsv(e.target.result);

    if (csvSummary.value.valid === 0) {
      csvError.value = 'Tidak ada PLU valid ditemukan di file CSV';
      csvFile.value = null;
    }
  };
  reader.readAsText(file);
};

// Analisis isi CSV tanpa render ke DOM — cukup statistik ringkas + validasi format
const analyzeCsv = (text) => {
  const MAX_PLU = 5000; // Harus sinkron dengan config.maxPluCount di backend
  const lines = text.split(/\r?\n/).filter(line => line.trim());

  // Deteksi header: baris pertama mengandung kata "PRDCD" / "plu" / "kode" di kolom pertama
  const hasHeader = lines.length > 0 && /PRDCD|plu|kode/i.test((lines[0].split(',')[0] || '').trim());

  const pluSet = new Set();
  let duplicates = 0;
  let invalid = 0;
  let truncated = false;

  // Mulai dari baris ke-1 jika ada header — total baris data tidak termasuk header
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',');
    const raw = (cols[0] || '').trim();
    if (!raw) continue;

    // Hanya terima numerik (sama dengan validasi backend)
    if (!/^\d+$/.test(raw)) {
      invalid++;
      continue;
    }

    if (pluSet.has(raw)) {
      duplicates++;
      continue;
    }

    // Cap 5.000 PLU — sama dengan config.maxPluCount di backend (sales_custab.config.js)
    if (pluSet.size >= MAX_PLU) {
      truncated = true;
      break;
    }

    pluSet.add(raw);
  }

  return {
    total: lines.length - (hasHeader ? 1 : 0),
    valid: pluSet.size,
    duplicates,
    invalid,
    truncated,
  };
};

const canDownload = computed(() => {
  return cabang.value &&
         prdLap.value &&
         prdLap2.value &&
         csvFile.value &&
         csvSummary.value && csvSummary.value.valid > 0 &&
         !csvError.value &&
         (shopMode.value === 'all' || selectedShops.value.length > 0);
});

const downloadTemplate = () => {
  const content = 'PRDCD\n';
  const blob = new Blob([content], { type: 'text/csv; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'template_plu.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleDownload = async () => {
  // Guard re-entry: cegah multiple request saat proses download berlangsung
  if (!canDownload.value || isDownloading.value) return;

  isDownloading.value = true;
  try {
    const prdLapStr = formatDate(prdLap.value);
    const prdLap2Str = formatDate(prdLap2.value);
    const kdtkInStr = shopMode.value === 'custom'
      ? selectedShops.value.join(',')
      : '';

    const response = await salesCustabService.downloadReport({
      csvFile: csvFile.value,
      cab: cabang.value,
      prdLap: prdLapStr,
      prdLap2: prdLap2Str,
      kdtkIn: kdtkInStr,
    });

    const fileName = `Custab Custom ${cabang.value} ${prdLapStr} s.d ${prdLap2Str}.csv`;
    const blob = new Blob([response.data], { type: 'text/csv; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.showSuccess('Sukses', 'Laporan berhasil diunduh');
  } catch (error) {
    toast.showError('Gagal', error.response?.data?.message || 'Gagal mengunduh laporan');
  } finally {
    isDownloading.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
</script>

<style scoped>
.custab-form {
  max-width: 900px;
}

.custab-form h3 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.subtitle {
  margin: 0 0 1.25rem;
  font-size: 0.85rem;
  color: var(--text-color-secondary, #6c757d);
}

/* ─── Form Rows ─── */

.form-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.form-row--3col {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.form-row .field {
  flex: 1;
  min-width: 200px;
}

/* Field di dalam grid 3-col: periode awal & akhir sejajar */
.form-row--3col .field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-row--3col .field label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color, #212529);
}

.form-row--3col .field small {
  font-size: 0.75rem;
  color: var(--text-color-secondary, #6c757d);
}

/* Force Calendar width sama untuk periode awal & akhir */
.form-row--3col :deep(.p-calendar) {
  width: 100%;
}

.shop-options {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.shop-options label {
  margin: 0;
  cursor: pointer;
}

.actions {
  margin-top: 1rem;
}

.required {
  color: #ef4444;
}

.error {
  color: #ef4444;
}

.success {
  color: #22c55e;
}

.csv-uploader {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.template-btn {
  flex-shrink: 0;
}

.csv-help {
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.csv-help small {
  font-size: 0.75rem;
  color: var(--text-color-secondary, #6c757d);
  line-height: 1.4;
}

.csv-summary {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.csv-summary small {
  display: block;
  font-size: 0.78rem;
}

.csv-summary .warn {
  color: #d97706;
}

.csv-summary .success {
  font-weight: 600;
}

:deep(.p-fileupload-basic) {
  width: 100%;
}

:deep(.p-multiselect) {
  width: 100%;
}

@media (max-width: 768px) {
  .form-row--3col {
    grid-template-columns: 1fr;
  }

  .form-row .field {
    min-width: unset;
    width: 100%;
  }
}
</style>
