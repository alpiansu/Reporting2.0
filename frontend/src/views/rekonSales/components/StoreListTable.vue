<template>
  <div class="table-wrapper">
    <div class="table-header">
      <h3 class="table-title">Resume per Toko</h3>
      <div class="header-actions">
        <div class="shop-filter-toggle" v-tooltip.bottom="'Tampilkan hanya toko yang baris mtran-nya tercatat atas kode toko lain / kosong'">
          <Checkbox v-model="localShopIssueOnly" inputId="shopIssueOnlyToggle" :binary="true"
            @change="onShopIssueToggle" />
          <label for="shopIssueOnlyToggle" class="shop-filter-label">Hanya SHOP beda</label>
        </div>
        <div class="search-box">
          <i class="pi pi-search search-icon"></i>
          <InputText v-model="localSearch" placeholder="Cari KDTK/Nama/Note..." @input="onSearchInput"
            class="search-input" />
          <Button v-if="localSearch" icon="pi pi-times" text rounded severity="secondary" class="clear-btn"
            @click="clearSearch" />
        </div>
        <Button icon="pi pi-download" label="Export Excel" severity="success" @click="$emit('export')" />
      </div>
    </div>

    <div class="table-container">
      <DataTable :value="data" :loading="loading" dataKey="KDTK" :rows="pagination.limit" :paginator="true"
        :totalRecords="pagination.total" :lazy="true" :first="(pagination.page - 1) * pagination.limit" :showCurrentPageReport="true"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        @page="onPage" @sort="onSort"
        currentPageReportTemplate="Halaman {currentPage} dari {totalPages} · {first}–{last} dari {totalRecords} toko" scrollable
        :scrollHeight="'600px'" :rowClass="getRowClass" stripedRows>
        <template #loading>
          <div class="skeleton-loading">
            <div v-for="i in 5" :key="i" class="skeleton-row">
              <div v-for="j in 7" :key="j" class="skeleton-cell">
                <Skeleton width="80%" :height="'1rem'" />
              </div>
            </div>
          </div>
        </template>
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-inbox empty-icon"></i>
            <p class="empty-text" v-if="!loading">Belum ada data untuk periode ini. Jalankan screening terlebih dahulu.</p>
            <p class="empty-text" v-else>Memuat data...</p>
          </div>
        </template>
        <Column header="No" frozen :style="{ width: '80px', textAlign: 'center' }">
          <template #body="slotProps">
            <span class="row-number">{{ (pagination.page - 1) * pagination.limit + (slotProps.index + 1) }}</span>
          </template>
        </Column>

        <Column field="CABANG" header="Cabang" sortable :style="{ minWidth: '120px' }" />

        <Column field="KDTK" header="KDTK" sortable :style="{ minWidth: '120px' }">
          <template #body="slotProps">
            <a href="#" class="link-kdtk" :class="{ 'link-kdtk--busy': isRowBusy(slotProps.data) }"
              @click.prevent="onKdtkClick(slotProps.data)">
              {{ slotProps.data.KDTK }}
            </a>
          </template>
        </Column>

        <Column field="NAMA" header="Nama Toko" sortable :style="{ minWidth: '220px' }">
          <template #body="slotProps">
            <span class="store-name">{{ slotProps.data.NAMA }}</span>
          </template>
        </Column>

        <Column field="TOTAL_ISSUES" header="Jumlah Tanggal Selisih" sortable :style="{ minWidth: '130px', textAlign: 'center' }">
          <template #body="slotProps">
            <Tag :value="String((slotProps.data.TOTAL_DATES ?? slotProps.data.TOTAL_ISSUES) ?? 0)"
              :severity="((slotProps.data.TOTAL_DATES ?? slotProps.data.TOTAL_ISSUES) ?? 0) > 0 ? 'danger' : 'secondary'" rounded />
          </template>
        </Column>

        <Column field="TOTAL_SEL_NET" header="Total SEL NET (GL+CD)" sortable :style="{ minWidth: '180px', textAlign: 'right' }">
          <template #body="slotProps">
            <span :class="['amount-value', amountClass(slotProps.data.TOTAL_SEL_NET ?? 0)]">
              {{ formatNumber(slotProps.data.TOTAL_SEL_NET ?? 0) }}
            </span>
          </template>
        </Column>

        <Column field="TOTAL_SEL_PPN" header="Total SEL PPN (GL+CD)" sortable :style="{ minWidth: '180px', textAlign: 'right' }">
          <template #body="slotProps">
            <span :class="['amount-value', amountClass(slotProps.data.TOTAL_SEL_PPN ?? 0)]">
              {{ formatNumber(slotProps.data.TOTAL_SEL_PPN ?? 0) }}
            </span>
          </template>
        </Column>

        <Column field="UPDTIME_LATEST" header="Last Screened" sortable :style="{ minWidth: '180px' }">
          <template #body="slotProps">
            <span v-tooltip.top="formatDateTime(slotProps.data.UPDTIME_LATEST ?? '')" class="last-screened">
              {{ formatRelativeTime(slotProps.data.UPDTIME_LATEST ?? '') }}
            </span>
          </template>
        </Column>

        <Column header="Cek SHOP" :style="{ minWidth: '160px', textAlign: 'center' }">
          <template #header>
            <span v-tooltip.top="'Memastikan field SHOP di tabel mtran sesuai dengan kode toko (KDTK)'">
              Cek SHOP
            </span>
          </template>
          <template #body="slotProps">
            <div class="shop-check-cell">
              <template v-if="slotProps.data.SHOP_CHECK && slotProps.data.SHOP_CHECK.STATUS === 'B'">
                <Button
                  icon="pi pi-exclamation-triangle"
                  :label="`${formatNumber(slotProps.data.SHOP_CHECK.JUMLAH_TRX_BEDA)} SHOP Beda`"
                  size="small" severity="warning" outlined
                  class="shop-check-btn shop-check-btn--beda"
                  v-tooltip.top="isRowBusy(slotProps.data) ? 'Memuat...' : 'Klik untuk lihat detail SHOP asing'"
                  :disabled="isRowBusy(slotProps.data)"
                  @click="$emit('shop-check', slotProps.data)" />
              </template>
              <template v-else-if="slotProps.data.SHOP_CHECK && slotProps.data.SHOP_CHECK.STATUS === 'OK'">
                <Tag value="SHOP OK" icon="pi pi-check" severity="success" rounded class="shop-check-tag" />
              </template>
              <template v-else>
                <span class="shop-check-empty" v-tooltip.top="'Tidak ada baris mtran yang tercatat atas kode toko lain / kosong'">Tidak ada selisih</span>
              </template>
            </div>
          </template>
        </Column>

        <Column header="Actions" frozen alignFrozen="right" :style="{ width: '130px' }">
          <template #body="slotProps">
            <div class="action-buttons">
              <Button icon="pi pi-pencil" size="small" text
                :class="['action-btn', slotProps.data.note ? 'note-active' : 'note-empty']"
                v-tooltip.top="isRowBusy(slotProps.data) ? 'Memuat...' : 'Edit Note'"
                :disabled="isRowBusy(slotProps.data)"
                @mouseenter="showNotePopover($event, slotProps.data)"
                @mouseleave="startHideTimer"
                @click="$emit('edit-note', slotProps.data)" />
              <Button icon="pi pi-eye" size="small" outlined
                v-tooltip.top="isRowBusy(slotProps.data) ? 'Memuat...' : 'Detail'"
                :loading="isDetailLoading(slotProps.data)"
                :disabled="isRowBusy(slotProps.data)"
                @click="$emit('view-details', slotProps.data)" />
              <Button icon="pi pi-refresh" size="small" severity="secondary" outlined
                v-tooltip.top="isRowBusy(slotProps.data) ? 'Memuat...' : 'Re-screen'"
                :loading="isLoading(slotProps.data)"
                :disabled="isRowBusy(slotProps.data)"
                @click="$emit('re-screen', slotProps.data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Popover ref="notePopover" @mouseenter="cancelHideTimer" @mouseleave="hidePopover">
      <div class="note-popover-content">
        <template v-if="popoverNoteData?.note">
          <div v-if="popoverNoteData.note?.category" class="note-popover-category">
            {{ popoverNoteData.note.category.name || popoverNoteData.note.category }}
          </div>
          <div class="note-popover-text">{{ popoverNoteData.note?.noteText ?? popoverNoteData.note }}</div>
          <div class="note-popover-meta">
            <span class="note-popover-meta-item">
              <i class="pi pi-user" /> {{ popoverNoteData.note?.fullName || popoverNoteData.note?.pic || '-' }}
            </span>
            <span class="note-popover-meta-item">
              <i class="pi pi-clock" /> {{ formatDateTime(popoverNoteData.note?.updated_at || '') }}
            </span>
          </div>
        </template>
        <div v-else class="note-popover-empty">
          <i class="pi pi-pencil" /> Belum ada catatan
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import Popover from 'primevue/popover';
import Checkbox from 'primevue/checkbox';
import { formatNumber, formatDateTime, formatRelativeTime, getSelisihClass } from '../utils/formatters';

const props = defineProps({
  data: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  pagination: { type: Object, required: true },
  sortColumn: { type: String, default: 'KDTK' },
  sortOrder: { type: String, default: 'ASC' },
  searchQuery: { type: String, default: '' },
  loadingStores: { type: Object, default: () => new Set() },
  highlightedItems: { type: Object, default: () => new Set() },
  detailLoadingStores: { type: Object, default: () => new Set() },
  shopIssueOnly: { type: Boolean, default: false }
});

const emit = defineEmits([
  'refresh',
  'page-change',
  'sort-change',
  'view-details',
  're-screen',
  'edit-note',
  'export',
  'search-change',
  'shop-check',
  'update:shopIssueOnly'
]);

const localSearch = ref(props.searchQuery);
const localShopIssueOnly = ref(props.shopIssueOnly);
let searchTimer = null;

watch(() => props.searchQuery, (newVal) => {
  localSearch.value = newVal;
});

watch(() => props.shopIssueOnly, (newVal) => {
  localShopIssueOnly.value = newVal;
});

const onShopIssueToggle = () => {
  emit('update:shopIssueOnly', localShopIssueOnly.value);
};

const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    emit('search-change', localSearch.value);
  }, 500);
};

const clearSearch = () => {
  localSearch.value = '';
  emit('search-change', '');
};

const onPage = (ev) => emit('page-change', { page: ev.page + 1 });

const onSort = (ev) => emit('sort-change', {
  sortColumn: ev.sortField || 'KDTK',
  sortOrder: ev.sortOrder === 1 ? 'ASC' : 'DESC'
});

const isLoading = (row) => props.loadingStores.has(`${row.CABANG || row.CAB || 'Unknown'}_${row.KDTK || 'Unknown'}`);

const isDetailLoading = (row) => props.detailLoadingStores.has(`${row.CABANG || row.CAB || 'Unknown'}_${row.KDTK || 'Unknown'}`);

// Baris dianggap busy jika ada operasi async yang sedang berjalan (re-screen / load detail)
const isRowBusy = (row) => isLoading(row) || isDetailLoading(row);

const onKdtkClick = (row) => {
  if (isRowBusy(row)) return;
  emit('view-details', row);
};

const amountClass = getSelisihClass;

const notePopover = ref(null);
const popoverNoteData = ref(null);
let hideTimer = null;

const showNotePopover = (event, row) => {
  if (isRowBusy(row)) return;
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  popoverNoteData.value = row;
  notePopover.value?.show(event);
};

const startHideTimer = () => {
  hideTimer = setTimeout(() => { notePopover.value?.hide(); }, 200);
};

const cancelHideTimer = () => {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
};

const hidePopover = () => {
  hideTimer = setTimeout(() => { notePopover.value?.hide(); }, 150);
};

const getRowClass = (row) => {
  const key = `${row.CABANG || row.CAB || 'Unknown'}_${row.KDTK || 'Unknown'}`;
  if (props.highlightedItems.has(key)) return 'row-highlighted';
  if (row.SHOP_CHECK && row.SHOP_CHECK.STATUS === 'B') return 'row-shop-beda';
  return '';
};
</script>

<style scoped src="./StoreListTable.style.css"></style>

<style src="./StoreListTable.global.style.css"></style>
