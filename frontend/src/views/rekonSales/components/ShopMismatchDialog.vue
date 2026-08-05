<template>
  <Dialog v-model:visible="localVisible" :header="dialogHeader" :modal="true"
    :style="{ width: '900px' }" :maximizable="true">
    <div v-if="!summary" class="empty-state">
      <i class="pi pi-check-circle"></i>
      <span>Tidak ada selisih SHOP tercatat untuk toko ini.</span>
    </div>

    <template v-else>
      <div class="info-banner">
        <i class="pi pi-info-circle"></i>
        <span>
          <strong>Cek SHOP:</strong> field <code>SHOP</code> pada tabel <code>mtran</code> harus sama dengan kode
          toko (<code>{{ kdtk }}</code>). Baris di bawah tercatat atas kode toko lain atau kosong. Pengecekan ini
          <strong>tidak mengubah</strong> hasil perhitungan rekonsiliasi.
        </span>
      </div>

      <div class="summary-bar">
        <div class="summary-item">
          <span class="label">Status</span>
          <span class="value">
            <Tag v-if="summary.STATUS === 'B'" value="Ada SHOP Beda" severity="warning" icon="pi pi-exclamation-triangle" rounded />
            <Tag v-else-if="summary.STATUS === 'OK'" value="SHOP OK" severity="success" icon="pi pi-check" rounded />
            <Tag v-else value="Belum dicek" severity="secondary" rounded />
          </span>
        </div>
        <div class="summary-item">
          <span class="label">Transaksi Beda</span>
          <span class="value">{{ formatNumber(summary.JUMLAH_TRX_BEDA || 0) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Kode SHOP Asing</span>
          <span class="value">{{ formatNumber(summary.JUMLAH_SHOP_ASING || 0) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Terakhir Dicek</span>
          <span class="value value--small">{{ formatDateTime(summary.UPDTIME) }}</span>
        </div>
      </div>

      <h4 class="section-title">Kode SHOP Asing per Kode</h4>
      <DataTable :value="listShopData" size="small" stripedRows :rows="10" :paginator="listShopData.length > 10"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        :rowsPerPageOptions="[10, 25, 50]">
        <template #empty>
          <div class="empty-tab"><i class="pi pi-check-circle mr-2"></i>Tidak ada SHOP asing</div>
        </template>
        <Column field="SHOP" header="SHOP Asing" style="min-width:110px">
          <template #body="{ data }">
            <Tag :value="data.SHOP" :severity="data.SHOP === '(KOSONG)' ? 'secondary' : 'warning'" rounded />
          </template>
        </Column>
        <Column field="JUMLAH_TRX" header="Jumlah Transaksi" class="text-right" style="width:140px">
          <template #body="{ data }">{{ formatNumber(data.JUMLAH_TRX) }}</template>
        </Column>
        <Column field="JUMLAH_TGL" header="Jumlah Tanggal" class="text-right" style="width:130px">
          <template #body="{ data }">{{ formatNumber(data.JUMLAH_TGL) }}</template>
        </Column>
        <Column field="TGL_AWAL" header="Dari Tanggal" style="min-width:110px" />
        <Column field="TGL_AKHIR" header="Sampai Tanggal" style="min-width:110px" />
      </DataTable>

      <div class="items-toolbar">
        <Button
          :label="hasItems ? 'Muat Ulang Item' : 'Lihat Item Transaksi'"
          icon="pi pi-search"
          size="small"
          :loading="loading"
          :disabled="loading"
          @click="emitViewItems" />
        <small class="items-hint">Ambil contoh baris transaksi (max 50) langsung dari DB toko.</small>
      </div>

      <template v-if="loading">
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Mengambil data item dari toko...</span>
        </div>
      </template>

      <template v-else-if="error">
        <div class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error }}</span>
        </div>
      </template>

      <template v-else-if="hasItems">
        <h4 class="section-title">Contoh Item Transaksi dengan SHOP Beda</h4>
        <DataTable :value="items" size="small" stripedRows scrollable scrollHeight="300px" :rows="25"
          :paginator="items.length > 25" paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink">
          <template #empty>
            <div class="empty-tab"><i class="pi pi-check-circle mr-2"></i>Tidak ada item</div>
          </template>
          <Column field="SHOP_MTRAN" header="SHOP" style="width:90px">
            <template #body="{ data }">
              <Tag :value="data.SHOP_MTRAN" :severity="data.SHOP_MTRAN === '(KOSONG)' ? 'secondary' : 'warning'" rounded />
            </template>
          </Column>
          <Column field="TANGGAL" header="Tanggal" style="min-width:100px" />
          <Column field="DOCNO" header="DOCNO" style="min-width:110px" />
          <Column field="STATION" header="St" style="width:60px" />
          <Column field="SHIFT" header="Sft" style="width:60px" />
          <Column field="PLU" header="PLU" style="min-width:90px" />
          <Column field="QTY" header="Qty" class="text-right" style="width:80px">
            <template #body="{ data }">{{ formatDecimal(data.QTY) }}</template>
          </Column>
          <Column field="GROSS" header="Gross" class="text-right" style="width:110px">
            <template #body="{ data }">{{ formatNumber(data.GROSS) }}</template>
          </Column>
          <Column field="PPN" header="PPN" class="text-right" style="width:100px">
            <template #body="{ data }">{{ formatNumber(data.PPN) }}</template>
          </Column>
        </DataTable>
      </template>
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
import Tag from 'primevue/tag';
import { formatNumber, formatDecimal, formatDateTime } from '../utils/formatters';

const props = defineProps({
  visible: { type: Boolean, default: false },
  data: { type: Object, default: null }, // { KDTK, NAMA, SHOP_CHECK }
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:visible', 'view-items']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));

const kdtk = computed(() => props.data?.KDTK || '');
const summary = computed(() => props.data?.SHOP_CHECK || null);
const listShopData = computed(() => (summary.value?.LIST_SHOP || []));
const hasItems = computed(() => Array.isArray(props.items) && props.items.length > 0);

const dialogHeader = computed(() => {
  const nama = props.data?.NAMA || '';
  return `Cek SHOP: ${kdtk.value}${nama ? ' — ' + nama : ''}`;
});

const emitViewItems = () => {
  emit('view-items', { kdtk: kdtk.value });
};
</script>

<style scoped src="./ShopMismatchDialog.style.css"></style>
