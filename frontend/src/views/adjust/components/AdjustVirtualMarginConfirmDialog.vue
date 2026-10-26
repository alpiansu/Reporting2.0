<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    modal
    :closable="!isSubmitting"
    :draggable="false"
    :style="{ width: '92vw', maxWidth: '1200px' }"
    class="virtual-margin-confirm-dialog"
  >
    <template #header>
      <div class="dialog-header-custom">
        <div class="header-icon-badge">
          <i class="pi pi-check-square"></i>
        </div>
        <div class="header-text-group">
          <h3 class="header-title">Konfirmasi Hasil Penyesuaian Virtual Margin</h3>
          <p class="header-subtitle">
            File: <span class="filename-tag">{{ fileName || 'FILE_BC_KHUSUS.csv' }}</span> &middot;
            Asumsi awal semua item <strong>SUKSES</strong>. Tandai toko/item yang gagal sebelum menyimpan status ke database.
          </p>
        </div>
      </div>
    </template>

    <div class="dialog-body-container">
      <!-- Info Alert Box -->
      <div class="info-banner">
        <i class="pi pi-info-circle info-icon"></i>
        <div class="info-content">
          <span class="info-title">Aturan Penyesuaian RECID Database:</span>
          <p class="info-desc">
            Hanya item berstatus <strong>SUKSES</strong> yang akan diupdate <code>RECID = '1'</code> pada tabel virtual margin di database.
            Item berstatus <strong>GAGAL</strong> dibiarkan utuh dan akan tetap terlacak sebagai data belum ter-adjust pada rekonsiliasi berikutnya.
          </p>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="summary-stats-grid">
        <div class="stat-pill total">
          <i class="pi pi-list"></i>
          <div class="stat-meta">
            <span class="stat-number">{{ totalItemsCount }}</span>
            <span class="stat-name">Total Data</span>
          </div>
        </div>

        <div class="stat-pill success">
          <i class="pi pi-check-circle"></i>
          <div class="stat-meta">
            <span class="stat-number">{{ successItemsCount }}</span>
            <span class="stat-name">Status Sukses</span>
          </div>
        </div>

        <div class="stat-pill failed">
          <i class="pi pi-times-circle"></i>
          <div class="stat-meta">
            <span class="stat-number">{{ failedItemsCount }}</span>
            <span class="stat-name">Ditandai Gagal</span>
          </div>
        </div>

        <div class="stat-pill stores">
          <i class="pi pi-building"></i>
          <div class="stat-meta">
            <span class="stat-number">{{ uniqueStoresCount }}</span>
            <span class="stat-name">Toko Terkait</span>
          </div>
        </div>
      </div>

      <!-- Action Toolbar -->
      <div class="action-toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <i class="pi pi-search search-icon"></i>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Cari toko (KDTK) / nama / PRDCD..."
              class="search-input"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="clear-search-btn"
              @click="searchQuery = ''"
              title="Reset pencarian"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>

          <!-- Filter status dropdown / buttons -->
          <div class="status-filter-pills">
            <button
              type="button"
              class="filter-pill-btn"
              :class="{ active: filterStatus === 'ALL' }"
              @click="filterStatus = 'ALL'"
            >
              Semua ({{ localItems.length }})
            </button>
            <button
              type="button"
              class="filter-pill-btn success"
              :class="{ active: filterStatus === 'SUCCESS' }"
              @click="filterStatus = 'SUCCESS'"
            >
              Sukses ({{ successItemsCount }})
            </button>
            <button
              type="button"
              class="filter-pill-btn failed"
              :class="{ active: filterStatus === 'FAILED' }"
              @click="filterStatus = 'FAILED'"
            >
              Gagal ({{ failedItemsCount }})
            </button>
          </div>
        </div>

        <div class="toolbar-right">
          <button
            type="button"
            class="bulk-action-btn success"
            @click="markAll(true)"
            :disabled="isSubmitting"
            title="Tandai semua item sebagai SUKSES"
          >
            <i class="pi pi-check"></i>
            <span>Semua Sukses</span>
          </button>
          <button
            type="button"
            class="bulk-action-btn failed"
            @click="markAll(false)"
            :disabled="isSubmitting"
            title="Tandai semua item sebagai GAGAL"
          >
            <i class="pi pi-times"></i>
            <span>Semua Gagal</span>
          </button>
        </div>
      </div>

      <!-- Interactive Table -->
      <div class="table-container">
        <table class="confirm-datatable">
          <thead>
            <tr>
              <th class="th-num">No.</th>
              <th class="th-store">Toko (KDTK)</th>
              <th class="th-branch">Cabang</th>
              <th class="th-date">Tgl Selisih</th>
              <th class="th-prdcd">PRDCD / Nama Barang</th>
              <th class="th-qty text-right">Qty Adjust</th>
              <th class="th-sel text-right">Selisih Rekon</th>
              <th class="th-keter">Keterangan</th>
              <th class="th-status text-center">Status Eksekusi</th>
              <th class="th-action text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredItems.length === 0">
              <td colspan="10" class="td-empty text-center">
                <i class="pi pi-inbox empty-icon"></i>
                <p>Tidak ada baris data yang cocok dengan filter pencarian.</p>
              </td>
            </tr>
            <tr
              v-for="(item, index) in filteredItems"
              :key="`${item.kdtk}_${item.prdcd}_${item.tgl_selisih}_${index}`"
              class="data-row"
              :class="{ 'row-failed': item.status === 'FAILED', 'row-success': item.status === 'SUCCESS' }"
            >
              <td class="td-num">{{ index + 1 }}</td>
              <td class="td-store">
                <div class="store-cell">
                  <span class="store-code-pill">{{ item.kdtk }}</span>
                  <span class="store-name-text" :title="item.storeName">{{ item.storeName || '-' }}</span>
                </div>
              </td>
              <td class="td-branch">
                <span class="branch-tag">{{ item.cabang || '-' }}</span>
              </td>
              <td class="td-date">
                <span class="date-chip">{{ item.tgl_selisih || '-' }}</span>
              </td>
              <td class="td-prdcd">
                <div class="product-cell-compact">
                  <span class="prdcd-text">{{ item.prdcd }}</span>
                  <span v-if="item.singkatan" class="singkatan-subtext" :title="item.singkatan">{{ item.singkatan }}</span>
                </div>
              </td>
              <td class="td-qty text-right">
                <span class="qty-pill">{{ item.qty_adj }}</span>
              </td>
              <td class="td-sel text-right">
                <span
                  v-if="item.sel_virtual !== null && item.sel_virtual !== undefined"
                  class="sel-chip"
                  :class="item.sel_virtual < 0 ? 'sel-neg' : 'sel-pos'"
                >
                  {{ item.sel_virtual }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="td-keter">
                <span class="keter-text" :title="item.keter">{{ item.keter || '-' }}</span>
              </td>
              <td class="td-status text-center">
                <span
                  class="status-badge"
                  :class="item.status === 'SUCCESS' ? 'badge-success' : 'badge-failed'"
                >
                  <i :class="item.status === 'SUCCESS' ? 'pi pi-check' : 'pi pi-times'"></i>
                  {{ item.status === 'SUCCESS' ? 'SUKSES' : 'GAGAL' }}
                </span>
              </td>
              <td class="td-action text-center">
                <div class="action-cell">
                  <button
                    type="button"
                    class="toggle-status-btn"
                    :class="item.status === 'SUCCESS' ? 'btn-to-fail' : 'btn-to-success'"
                    @click="toggleItemStatus(item)"
                    :disabled="isSubmitting"
                    :title="item.status === 'SUCCESS' ? 'Klik untuk tandai GAGAL' : 'Klik untuk tandai SUKSES'"
                  >
                    <i :class="item.status === 'SUCCESS' ? 'pi pi-times-circle' : 'pi pi-check-circle'"></i>
                    <span>{{ item.status === 'SUCCESS' ? 'Tandai Gagal' : 'Tandai Sukses' }}</span>
                  </button>
                  <button
                    type="button"
                    class="store-toggle-btn"
                    @click="toggleStoreAll(item.kdtk)"
                    :disabled="isSubmitting"
                    :title="`Tandai semua item toko ${item.kdtk} kebalikan dari status saat ini`"
                  >
                    <i class="pi pi-building"></i>
                    <span>Toko Ini</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-custom">
        <div class="footer-summary">
          <span>
            Akan mengupdate <strong>{{ successItemsCount }}</strong> item sukses ke database
            <span v-if="failedItemsCount > 0" class="text-danger">({{ failedItemsCount }} item dibiarkan belum ter-adjust)</span>.
          </span>
        </div>
        <div class="footer-actions">
          <Button
            type="button"
            label="Batal / Nanti Saja"
            icon="pi pi-times"
            class="btn-footer-secondary"
            @click="handleClose"
            :disabled="isSubmitting"
          />
          <Button
            type="button"
            label="Simpan Status ke Database"
            icon="pi pi-save"
            class="btn-footer-primary"
            :loading="isSubmitting"
            @click="handleSubmit"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import adjustService from '@/services/adjust.service.js';
import { useToastService } from '@/utils/toast';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  items: {
    type: Array,
    default: () => [],
  },
  fileName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:visible', 'confirmed']);
const toast = useToastService();

// Local copy of items for reactive editing
const localItems = ref([]);
const searchQuery = ref('');
const filterStatus = ref('ALL'); // 'ALL' | 'SUCCESS' | 'FAILED'
const isSubmitting = ref(false);

// Initialize/Sync localItems whenever props.items change or dialog opens
watch(
  () => [props.items, props.visible],
  ([newItems, isVisible]) => {
    if (isVisible && Array.isArray(newItems)) {
      localItems.value = newItems.map(item => ({
        ...item,
        status: item.status || 'SUCCESS', // default sukses sesuai asumsi requirement
      }));
      searchQuery.value = '';
      filterStatus.value = 'ALL';
    }
  },
  { immediate: true }
);

// Computeds
const totalItemsCount = computed(() => localItems.value.length);
const successItemsCount = computed(() => localItems.value.filter(i => i.status === 'SUCCESS').length);
const failedItemsCount = computed(() => localItems.value.filter(i => i.status === 'FAILED').length);

const uniqueStoresCount = computed(() => {
  const storeSet = new Set(localItems.value.map(i => i.kdtk).filter(Boolean));
  return storeSet.size;
});

const filteredItems = computed(() => {
  let list = localItems.value;

  // Filter Status
  if (filterStatus.value === 'SUCCESS') {
    list = list.filter(i => i.status === 'SUCCESS');
  } else if (filterStatus.value === 'FAILED') {
    list = list.filter(i => i.status === 'FAILED');
  }

  // Search Filter
  if (searchQuery.value) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(i => {
      const kdtkMatch = (i.kdtk || '').toLowerCase().includes(q);
      const nameMatch = (i.storeName || '').toLowerCase().includes(q);
      const prdcdMatch = (i.prdcd || '').toLowerCase().includes(q);
      const singkatanMatch = (i.singkatan || '').toLowerCase().includes(q);
      const dateMatch = (i.tgl_selisih || '').toLowerCase().includes(q);
      return kdtkMatch || nameMatch || prdcdMatch || singkatanMatch || dateMatch;
    });
  }

  return list;
});

// Item Toggling Methods
const toggleItemStatus = (item) => {
  item.status = item.status === 'SUCCESS' ? 'FAILED' : 'SUCCESS';
};

const toggleStoreAll = (storeCode) => {
  if (!storeCode) return;
  const storeItems = localItems.value.filter(i => i.kdtk === storeCode);
  if (!storeItems.length) return;

  // If any is success, make all failed; otherwise make all success
  const hasSuccess = storeItems.some(i => i.status === 'SUCCESS');
  const targetStatus = hasSuccess ? 'FAILED' : 'SUCCESS';
  storeItems.forEach(i => {
    i.status = targetStatus;
  });
};

const markAll = (asSuccess) => {
  const targetStatus = asSuccess ? 'SUCCESS' : 'FAILED';
  localItems.value.forEach(i => {
    i.status = targetStatus;
  });
};

const handleClose = () => {
  if (isSubmitting.value) return;
  emit('update:visible', false);
};

const handleSubmit = async () => {
  if (localItems.value.length === 0 || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    const response = await adjustService.confirmVirtualMargin(localItems.value);
    const resultData = response?.data || response;

    toast.showSuccess(
      'Konfirmasi Berhasil',
      response?.message || `Status penyesuaian berhasil disimpan ke database. (${resultData?.updatedCount || successItemsCount.value} sukses, ${resultData?.failedCount || failedItemsCount.value} gagal)`
    );

    emit('confirmed', {
      items: localItems.value,
      result: resultData,
    });

    emit('update:visible', false);
  } catch (error) {
    console.error('Error saving virtual margin confirmation:', error);
    toast.showError(
      'Gagal Menyimpan Status',
      error?.response?.data?.message || error.message || 'Terjadi kesalahan saat menyimpan status penyesuaian.'
    );
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.virtual-margin-confirm-dialog :deep(.p-dialog-header) {
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.virtual-margin-confirm-dialog :deep(.p-dialog-content) {
  padding: 1.25rem 1.5rem;
  background: #ffffff;
}

.virtual-margin-confirm-dialog :deep(.p-dialog-footer) {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

/* Header */
.dialog-header-custom {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #e0f2fe;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.header-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
}

.header-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  color: #64748b;
}

.filename-tag {
  font-family: monospace;
  font-weight: 600;
  color: #0369a1;
  background: #f1f5f9;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

/* Info Banner */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.info-icon {
  font-size: 1.2rem;
  color: #2563eb;
  margin-top: 0.1rem;
}

.info-title {
  display: block;
  font-size: 0.825rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 0.2rem;
}

.info-desc {
  margin: 0;
  font-size: 0.785rem;
  line-height: 1.45;
  color: #1e3a8a;
}

.info-desc code {
  background: #dbeafe;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
}

/* Summary Stats Grid */
.summary-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.stat-pill i {
  font-size: 1.35rem;
}

.stat-pill.total {
  border-color: #cbd5e1;
  color: #475569;
}
.stat-pill.total i { color: #64748b; }

.stat-pill.success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}
.stat-pill.success i { color: #16a34a; }

.stat-pill.failed {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}
.stat-pill.failed i { color: #dc2626; }

.stat-pill.stores {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #334155;
}
.stat-pill.stores i { color: #0284c7; }

.stat-meta {
  display: flex;
  flex-direction: column;
}

.stat-number {
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.1;
}

.stat-name {
  font-size: 0.725rem;
  font-weight: 500;
  opacity: 0.85;
}

/* Action Toolbar */
.action-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box .search-icon {
  position: absolute;
  left: 0.65rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.search-input {
  padding: 0.35rem 1.8rem 0.35rem 2rem;
  font-size: 0.785rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  width: 250px;
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: #0284c7;
}

.clear-search-btn {
  position: absolute;
  right: 0.4rem;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.7rem;
}

.clear-search-btn:hover {
  color: #ef4444;
}

.status-filter-pills {
  display: inline-flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #e2e8f0;
}

.filter-pill-btn {
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.15s ease;
}

.filter-pill-btn.active {
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.filter-pill-btn.success.active {
  color: #16a34a;
}

.filter-pill-btn.failed.active {
  color: #dc2626;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bulk-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.bulk-action-btn.success {
  background: #dcfce7;
  color: #15803d;
  border-color: #bbf7d0;
}
.bulk-action-btn.success:hover {
  background: #bbf7d0;
}

.bulk-action-btn.failed {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fecaca;
}
.bulk-action-btn.failed:hover {
  background: #fecaca;
}

/* Table */
.table-container {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.confirm-datatable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  text-align: left;
}

.confirm-datatable thead th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  font-size: 0.725rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 2;
  white-space: nowrap;
}

.confirm-datatable tbody tr {
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.confirm-datatable tbody tr:hover {
  background-color: #f8fafc;
}

.confirm-datatable tbody tr.row-failed {
  background-color: #fffbfb;
}
.confirm-datatable tbody tr.row-failed:hover {
  background-color: #fef2f2;
}

.confirm-datatable td {
  padding: 0.5rem 0.75rem;
  vertical-align: middle;
}

.td-num {
  width: 35px;
  color: #94a3b8;
  font-size: 0.75rem;
}

.store-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.store-code-pill {
  font-family: monospace;
  font-weight: 700;
  color: #0369a1;
  background: #e0f2fe;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.store-name-text {
  font-weight: 600;
  color: #1e293b;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.branch-tag {
  font-size: 0.725rem;
  font-weight: 600;
  color: #0f766e;
  background: #ccfbf1;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.date-chip {
  font-size: 0.75rem;
  font-family: monospace;
  color: #475569;
}

.prdcd-text {
  font-family: monospace;
  font-weight: 600;
  color: #334155;
}

.product-cell-compact {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.singkatan-subtext {
  font-size: 0.7rem;
  color: #64748b;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty-pill {
  font-weight: 700;
  color: #0f172a;
}

.sel-chip {
  display: inline-block;
  font-family: monospace;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.sel-chip.sel-neg {
  color: #dc2626;
  background: #fef2f2;
}

.sel-chip.sel-pos {
  color: #16a34a;
  background: #f0fdf4;
}

.text-muted {
  color: #94a3b8;
  font-size: 0.75rem;
}

.keter-text {
  color: #64748b;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  font-size: 0.75rem;
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.badge-success {
  background: #dcfce7;
  color: #15803d;
}

.badge-failed {
  background: #fee2e2;
  color: #b91c1c;
}

/* Action Cell Buttons */
.action-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.toggle-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.725rem;
  font-weight: 600;
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-status-btn.btn-to-fail {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}
.toggle-status-btn.btn-to-fail:hover {
  background: #fee2e2;
}

.toggle-status-btn.btn-to-success {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}
.toggle-status-btn.btn-to-success:hover {
  background: #dcfce7;
}

.store-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  cursor: pointer;
}
.store-toggle-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.td-empty {
  padding: 3rem 1rem;
  color: #94a3b8;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  display: block;
}

/* Footer */
.dialog-footer-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  width: 100%;
}

.footer-summary {
  font-size: 0.8rem;
  color: #475569;
}

.text-danger {
  color: #dc2626;
  font-weight: 600;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-footer-secondary {
  background: #ffffff !important;
  border-color: #cbd5e1 !important;
  color: #475569 !important;
}

.btn-footer-secondary:hover {
  background: #f1f5f9 !important;
}

.btn-footer-primary {
  background: #0284c7 !important;
  border-color: #0284c7 !important;
  color: #ffffff !important;
  font-weight: 600;
}

.btn-footer-primary:hover {
  background: #0369a1 !important;
}
</style>
