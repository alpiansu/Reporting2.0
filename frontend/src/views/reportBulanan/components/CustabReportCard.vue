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
            <div v-if="csvPreview.length > 0" class="csv-preview">
              <small class="success">{{ csvPreview.length }} baris PLU siap diproses</small>
              <div class="preview-table">
                <table>
                  <thead><tr><th>No</th><th>PRDCD</th></tr></thead>
                  <tbody>
                    <tr v-for="(row, idx) in csvPreview.slice(0, 5)" :key="idx">
                      <td>{{ idx + 1 }}</td>
                      <td>{{ row.PRDCD || row.prdcd || row[0] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
              v-model="selectedShops"
              :options="shopOptions"
              optionLabel="label"
              optionValue="kdtk"
              placeholder="Pilih Toko"
              filter
              :maxSelectedLabels="3"
              :disabled="!cabang || isDownloading || loadingShops"
              class="w-full"
              @change="onShopChange"
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
const csvPreview = ref([]);
const csvError = ref('');
const isDownloading = ref(false);
const shopOptions = ref([]);
const loadingShops = ref(false);

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

const onCabangChange = async () => {
  selectedShops.value = [];
  shopOptions.value = [];

  if (!cabang.value) return;

  await fetchShops(cabang.value);
};

const fetchShops = async (branchCode) => {
  try {
    loadingShops.value = true;
    const response = await StoreService.getStoresByBranch(branchCode, {
      limit: 1000,
      onlyInduk: false,
    });

    const stores = response.data?.stores || [];
    shopOptions.value = stores.map(s => ({
      kdtk: s.storeCode,
      label: `${s.storeCode} - ${s.storeName}`,
    }));
  } catch (error) {
    console.error('Error fetching shops:', error);
    toast.showError('Gagal', 'Gagal memuat daftar toko');
  } finally {
    loadingShops.value = false;
  }
};

const onShopChange = () => {
  // handled by v-model
};

const onFileSelect = (event) => {
  const file = event.files[0];
  if (!file) return;

  csvError.value = '';
  csvPreview.value = [];

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
    const text = e.target.result;
    const lines = text.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1, 6);
    csvPreview.value = dataLines.map(line => {
      const cols = line.split(',');
      return { PRDCD: cols[0]?.trim() };
    });
  };
  reader.readAsText(file);
};

const canDownload = computed(() => {
  return cabang.value &&
         prdLap.value &&
         prdLap2.value &&
         csvFile.value &&
         csvPreview.value.length > 0 &&
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

.csv-preview {
  margin-top: 0.5rem;
}

.preview-table {
  margin-top: 0.5rem;
  border: 1px solid var(--surface-border, #e9ecef);
  border-radius: 6px;
  overflow: hidden;
}

.preview-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.preview-table th,
.preview-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--surface-border, #e9ecef);
  text-align: left;
}

.preview-table th {
  background: var(--surface-section, #f8f9fa);
  font-weight: 600;
}

.preview-table tbody tr:last-child td {
  border-bottom: none;
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
