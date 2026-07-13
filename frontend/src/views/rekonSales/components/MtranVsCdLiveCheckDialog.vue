<template>
  <Dialog v-model:visible="localVisible" :header="dialogHeader" :modal="true"
    :style="{ width: '1400px' }" :maximizable="true">
    <template v-if="loading">
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Mengambil data live dari toko...</span>
      </div>
    </template>

    <template v-else-if="error">
      <div class="error-state">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ error }}</span>
      </div>
    </template>

    <template v-else>
      <div class="summary-bar">
        <div class="summary-item">
          <span class="label">Total Item</span>
          <span class="value">{{ items.length }}</span>
        </div>
        <div class="summary-item" v-if="shiftInfo">
          <span class="label">Shift</span>
          <span class="value">{{ shiftInfo.TANGGAL }} / St{{ shiftInfo.STATION }} / S{{ shiftInfo.SHIFT }}</span>
        </div>
        <div class="summary-item warning" v-if="validationSummary.totalBkpSelisih > 0">
          <span class="label">BKP/SUB_BKP Selisih</span>
          <span class="value">{{ validationSummary.totalBkpSelisih }}</span>
        </div>
        <div class="summary-item warning" v-if="validationSummary.totalPpnRateSelisih > 0">
          <span class="label">PPN Rate Selisih</span>
          <span class="value">{{ validationSummary.totalPpnRateSelisih }}</span>
        </div>
        <div class="summary-item" v-if="validationSummary.totalGrossDppSelisih > 0">
          <span class="label">GROSS DPP Selisih</span>
          <span class="value">{{ validationSummary.totalGrossDppSelisih }}</span>
        </div>
      </div>

      <div class="table-toolbar">
        <div class="search-box">
          <i class="pi pi-search search-icon"></i>
          <InputText v-model="globalSearch" placeholder="Cari PLU, DOCNO, Nama Item..." class="search-input" />
        </div>
        <div class="toggle-filter">
          <span class="toggle-label">Hanya Selisih</span>
          <InputSwitch v-model="showOnlySelisih" />
        </div>
      </div>

      <DataTable :value="filteredItems" dataKey="id" size="small" stripedRows scrollable scrollHeight="500px"
        :rowClass="rowValidationClass" :paginator="true" :rows="25"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        :rowsPerPageOptions="[25, 50, 100]">
        <template #empty>
          <div class="empty-state"><i class="pi pi-check-circle"></i>Tidak ada data</div>
        </template>

        <Column field="TANGGAL" header="Tanggal" style="min-width:100px" frozen sortable />
        <Column field="STATION" header="Station" style="width:70px" sortable />
        <Column field="SHIFT" header="Shift" style="width:60px" sortable />
        <Column field="RTYPE" header="Rtype" style="width:60px" sortable />
        <Column field="DOCNO" header="DOCNO" style="min-width:110px" sortable />
        <Column field="PLU" header="PLU" style="min-width:90px" sortable />
        <Column field="SINGKATAN" header="Nama Item" style="min-width:160px" sortable />

        <Column field="QTY" header="Qty" class="text-right" style="width:70px" sortable>
          <template #body="{ data }">{{ formatDecimal(data.QTY) }}</template>
        </Column>
        <Column field="PRICE" header="Harga" class="text-right" style="width:90px" sortable>
          <template #body="{ data }">{{ formatNumber(data.PRICE) }}</template>
        </Column>
        <Column field="GROSS" header="Gross" class="text-right" style="width:100px" sortable>
          <template #body="{ data }">{{ formatNumber(data.GROSS) }}</template>
        </Column>

        <Column header="BKP" style="width:100px" sortable field="BKP">
          <template #body="{ data }">
            <div class="validation-cell">
              <span :class="bkpStatusClass(data)">{{ data.BKP || '-' }}</span>
              <i v-if="data.BKP_VALIDATION === 'SELISIH'" class="pi pi-exclamation-circle validation-icon error-icon"
                v-tooltip="`Prodmast: BKP=${data.PRODMAST_BKP || '-'}, SUB_BKP=${data.PRODMAST_SUB_BKP || '-'}`"></i>
              <i v-else class="pi pi-check-circle validation-icon ok-icon"></i>
            </div>
          </template>
        </Column>
        <Column header="SUB_BKP" style="width:80px" sortable field="SUB_BKP">
          <template #body="{ data }">
            <span :class="bkpStatusClass(data)">{{ data.SUB_BKP || '-' }}</span>
          </template>
        </Column>

        <Column field="PPN" header="PPN" class="text-right" style="width:100px" sortable>
          <template #body="{ data }">{{ formatNumber(data.PPN) }}</template>
        </Column>

        <Column field="GROSS_DPP" header="Gross DPP" class="text-right" style="width:110px" sortable>
          <template #body="{ data }">{{ formatNumber(data.GROSS_DPP) }}</template>
        </Column>
        <Column field="HIT_GROSS_DPP" header="Hit Gross DPP" class="text-right" style="width:120px" sortable>
          <template #body="{ data }">
            <span :class="hasGrossDppMismatch(data) ? 'value-mismatch' : ''">
              {{ formatNumber(data.HIT_GROSS_DPP) }}
            </span>
          </template>
        </Column>
        <Column field="SEL_GROSS_DPP" header="Sel GROSS DPP" class="text-right" style="width:120px" sortable>
          <template #body="{ data }">
            <span :class="selisihClass(data.SEL_GROSS_DPP)">
              {{ formatNumber(data.SEL_GROSS_DPP) }}
            </span>
          </template>
        </Column>

        <Column header="PPN Rate" style="width:120px" sortable field="PPN_RATE">
          <template #body="{ data }">
            <div class="validation-cell">
              <span :class="ppnRateStatusClass(data)">{{ data.PPN_RATE ?? '-' }}</span>
              <i v-if="data.PPN_RATE_VALIDATION !== 'OK'"
                :class="['pi', ppnRateIconClass(data), 'validation-icon']"
                v-tooltip="ppnRateTooltip(data)"></i>
              <i v-else class="pi pi-check-circle validation-icon ok-icon"></i>
            </div>
          </template>
        </Column>
      </DataTable>
    </template>

    <template #footer>
      <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="localVisible = false" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import InputSwitch from 'primevue/inputswitch';
import { formatNumber, formatDecimal, getSelisihClass } from '../utils/formatters';

const props = defineProps({
  visible: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  shiftInfo: { type: Object, default: null },
});

const emit = defineEmits(['update:visible']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));

const globalSearch = ref('');
const showOnlySelisih = ref(true);

const dialogHeader = computed(() => {
  const info = props.shiftInfo;
  if (!info) return 'Live Check Mtran vs Closing Detail';
  return `Live Check: ${info.TANGGAL} / Station ${info.STATION} / Shift ${info.SHIFT}`;
});

const hasGrossDppMismatch = (data) => {
  return Math.abs(Number(data.GROSS_DPP || 0) - Number(data.HIT_GROSS_DPP || 0)) > 0.01;
};

const selisihClass = getSelisihClass;

const processedItems = computed(() => {
  return props.items.map(item => ({
    ...item,
    SEL_GROSS_DPP: Number(item.HIT_GROSS_DPP || 0) - Number(item.GROSS_DPP || 0),
  }));
});

const validationSummary = computed(() => {
  let totalBkpSelisih = 0;
  let totalPpnRateSelisih = 0;
  let totalGrossDppSelisih = 0;
  for (const item of processedItems.value) {
    if (item.BKP_VALIDATION === 'SELISIH') totalBkpSelisih++;
    if (item.PPN_RATE_VALIDATION !== 'OK') totalPpnRateSelisih++;
    if (hasGrossDppMismatch(item)) totalGrossDppSelisih++;
  }
  return { totalBkpSelisih, totalPpnRateSelisih, totalGrossDppSelisih };
});

const displayItems = computed(() => {
  const items = processedItems.value;
  if (!showOnlySelisih.value) return items;
  return items.filter(item => hasGrossDppMismatch(item));
});

const filteredItems = computed(() => {
  const q = globalSearch.value.toLowerCase().trim();
  if (!q) return displayItems.value;
  return displayItems.value.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(q)
    )
  );
});

const bkpStatusClass = (data) => {
  if (data.BKP_VALIDATION === 'SELISIH') return 'status-error';
  return data.BKP === 'Y' ? 'status-ok' : 'status-muted';
};

const ppnRateStatusClass = (data) => {
  if (data.PPN_RATE_VALIDATION !== 'OK') return 'status-error';
  return 'status-ok';
};

const ppnRateIconClass = (data) => {
  if (data.PPN_RATE_VALIDATION === 'SELISIH-PJR') return 'pi-exclamation-triangle warning-icon';
  return 'pi-exclamation-circle error-icon';
};

const ppnRateTooltip = (data) => {
  switch (data.PPN_RATE_VALIDATION) {
    case 'SELISIH-PJR': return `PJR item: PPN_RATE harus 10, saat ini ${data.PPN_RATE ?? '-'}`;
    case 'SELISIH-PPN': return `BKP='${data.BKP || 'N'}': PPN_RATE harus ${data.BKP === 'Y' ? '11' : '0'}, saat ini ${data.PPN_RATE ?? '-'}`;
    default: return '';
  }
};

const rowValidationClass = (data) => {
  if (data.BKP_VALIDATION === 'SELISIH' || data.PPN_RATE_VALIDATION !== 'OK') return 'row-has-issue';
  if (hasGrossDppMismatch(data)) return 'row-has-issue';
  return '';
};
</script>

<style scoped>
.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.loading-state i { font-size: 1.5rem; }

.summary-bar {
  display: flex;
  gap: 1.5rem;
  padding: 0.75rem 0;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-item .label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-item .value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
}

.summary-item.warning .value {
  color: var(--error-color, #e53935);
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 350px;
}

.search-input {
  width: 100%;
  padding-left: 2.25rem !important;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  font-size: 0.875rem;
}

.toggle-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.validation-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.validation-icon {
  font-size: 0.85rem;
}

.ok-icon { color: var(--success-color, #43a047); }
.error-icon { color: var(--error-color, #e53935); }
.warning-icon { color: var(--warning-color, #fb8c00); }

.status-ok { color: var(--success-color, #43a047); font-weight: 600; }
.status-error { color: var(--error-color, #e53935); font-weight: 600; }
.status-muted { color: var(--text-color-secondary); }

.value-mismatch {
  color: var(--error-color, #e53935);
  font-weight: 600;
}

.row-has-issue {
  background: rgba(229, 57, 53, 0.04) !important;
}

:deep(.text-right) { text-align: right !important; }
:deep(.p-datatable-thead > tr > th.text-right) { text-align: right !important; justify-content: flex-end; }
</style>
