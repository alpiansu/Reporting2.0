<template>
  <div class="prep-closing-table">
    <div class="table-header">
      <div class="table-title">
        <h4>Detail Hasil Screening</h4>
        <span class="table-subtitle">{{ filteredData.length }} dari {{ totalRecords }} toko</span>
      </div>
      
      <div class="table-actions">
        <!-- Filter Status -->
        <div class="filter-group">
          <label for="statusFilter">Status:</label>
          <Dropdown
            id="statusFilter"
            v-model="selectedStatus"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Semua Status"
            class="status-filter"
            @change="applyFilters"
          />
        </div>
        
        <!-- Search -->
        <div class="search-group">
          <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <InputText
              v-model="searchQuery"
              placeholder="Cari toko..."
              class="search-input"
              @input="applyFilters"
            />
          </span>
        </div>
        
        <!-- Export Button -->
        <Button
          icon="pi pi-download"
          label="Export"
          class="p-button-outlined"
          @click="exportData"
          v-tooltip.top="'Export ke Excel'"
        />
        
        <!-- Refresh Button -->
        <Button
          icon="pi pi-refresh"
          class="p-button-text p-button-plain"
          @click="$emit('refresh')"
          v-tooltip.top="'Refresh Data'"
        />
      </div>
    </div>
    
    <div class="table-container">
      <DataTable
        :value="paginatedData"
        :loading="loading"
        stripedRows
        responsiveLayout="scroll"
        :scrollable="true"
        scrollHeight="600px"
        class="prep-closing-datatable"
        :rowClass="getRowClass"
      >
        <!-- Store Code Column -->
        <Column field="storeCode" header="Kode Toko" :sortable="true" frozen>
          <template #body="{ data }">
            <div class="store-code-cell">
              <span class="store-code">{{ data.storeCode }}</span>
              <span class="store-name">{{ data.storeName }}</span>
            </div>
          </template>
        </Column>
        
        <!-- Status Column -->
        <Column field="status" header="Status" :sortable="true">
          <template #body="{ data }">
            <Tag
              :value="getStatusLabel(data.status)"
              :severity="getStatusSeverity(data.status)"
              :icon="getStatusIcon(data.status)"
            />
          </template>
        </Column>
        
        <!-- Last Closing Date -->
        <Column field="lastClosingDate" header="Tgl Closing Terakhir" :sortable="true">
          <template #body="{ data }">
            <span v-if="data.lastClosingDate">
              {{ formatDate(data.lastClosingDate) }}
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </Column>
        
        <!-- WRC Status -->
        <Column field="wrcStatus" header="Status WRC" :sortable="true">
          <template #body="{ data }">
            <div class="wrc-status">
              <i :class="getWrcIcon(data.wrcStatus)" :style="{ color: getWrcColor(data.wrcStatus) }"></i>
              <span>{{ getWrcLabel(data.wrcStatus) }}</span>
            </div>
          </template>
        </Column>
        
        <!-- Data Completeness -->
        <Column field="dataCompleteness" header="Kelengkapan Data" :sortable="true">
          <template #body="{ data }">
            <div class="completeness-cell">
              <div class="completeness-bar">
                <div 
                  class="completeness-fill" 
                  :style="{ 
                    width: data.dataCompleteness + '%',
                    backgroundColor: getCompletenessColor(data.dataCompleteness)
                  }"
                ></div>
              </div>
              <span class="completeness-text">{{ data.dataCompleteness }}%</span>
            </div>
          </template>
        </Column>
        
        <!-- Issues -->
        <Column field="issues" header="Masalah" :sortable="false">
          <template #body="{ data }">
            <div v-if="data.issues && data.issues.length > 0" class="issues-cell">
              <Tag
                v-for="issue in data.issues.slice(0, 2)"
                :key="issue"
                :value="getIssueLabel(issue)"
                severity="warning"
                class="issue-tag"
              />
              <span v-if="data.issues.length > 2" class="more-issues">
                +{{ data.issues.length - 2 }} lainnya
              </span>
            </div>
            <span v-else class="no-issues">Tidak ada masalah</span>
          </template>
        </Column>
        
        <!-- Last Check -->
        <Column field="lastCheck" header="Terakhir Dicek" :sortable="true">
          <template #body="{ data }">
            <span v-if="data.lastCheck">
              {{ formatDateTime(data.lastCheck) }}
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </Column>
        
        <!-- Actions -->
        <Column header="Aksi" :exportable="false" frozen alignFrozen="right">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-eye"
                class="p-button-text p-button-sm"
                @click="viewDetails(data)"
                v-tooltip.top="'Lihat Detail'"
              />
              <Button
                icon="pi pi-refresh"
                class="p-button-text p-button-sm"
                @click="recheckStore(data)"
                v-tooltip.top="'Cek Ulang'"
                :loading="data.rechecking"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
    
    <!-- Pagination -->
    <div class="table-footer">
      <div class="pagination-info">
        Menampilkan {{ startRecord }} - {{ endRecord }} dari {{ filteredData.length }} data
      </div>
      <Paginator
        :rows="rowsPerPage"
        :totalRecords="filteredData.length"
        :first="first"
        @page="onPageChange"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      />
    </div>
    
    <!-- Store Detail Dialog -->
    <Dialog
      v-model:visible="showDetailDialog"
      :header="`Detail Toko ${selectedStore?.storeCode}`"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '800px' }"
      class="store-detail-dialog"
    >
      <div v-if="selectedStore" class="store-detail-content">
        <!-- Store Info -->
        <div class="detail-section">
          <h5>Informasi Toko</h5>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Kode Toko:</label>
              <span>{{ selectedStore.storeCode }}</span>
            </div>
            <div class="detail-item">
              <label>Nama Toko:</label>
              <span>{{ selectedStore.storeName }}</span>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <Tag
                :value="getStatusLabel(selectedStore.status)"
                :severity="getStatusSeverity(selectedStore.status)"
              />
            </div>
            <div class="detail-item">
              <label>Kelengkapan Data:</label>
              <span>{{ selectedStore.dataCompleteness }}%</span>
            </div>
          </div>
        </div>
        
        <!-- Issues Detail -->
        <div v-if="selectedStore.issues && selectedStore.issues.length > 0" class="detail-section">
          <h5>Detail Masalah</h5>
          <div class="issues-detail">
            <div
              v-for="issue in selectedStore.issues"
              :key="issue"
              class="issue-detail-item"
            >
              <i :class="getIssueIcon(issue)"></i>
              <div class="issue-detail-info">
                <span class="issue-detail-label">{{ getIssueLabel(issue) }}</span>
                <span class="issue-detail-desc">{{ getIssueDescription(issue) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- WRC Detail -->
        <div class="detail-section">
          <h5>Status WRC</h5>
          <div class="wrc-detail">
            <div class="wrc-status-detail">
              <i :class="getWrcIcon(selectedStore.wrcStatus)"></i>
              <span>{{ getWrcLabel(selectedStore.wrcStatus) }}</span>
            </div>
            <div v-if="selectedStore.wrcLastUpdate" class="wrc-last-update">
              Terakhir diperbarui: {{ formatDateTime(selectedStore.wrcLastUpdate) }}
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <Button
          label="Tutup"
          icon="pi pi-times"
          class="p-button-text"
          @click="showDetailDialog = false"
        />
        <Button
          label="Cek Ulang"
          icon="pi pi-refresh"
          @click="recheckStore(selectedStore)"
          :loading="selectedStore?.rechecking"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';
import Dialog from 'primevue/dialog';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  totalRecords: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['refresh', 'recheck-store', 'export']);

// Reactive data
const searchQuery = ref('');
const selectedStatus = ref('');
const filteredData = ref([]);
const first = ref(0);
const rowsPerPage = ref(25);
const showDetailDialog = ref(false);
const selectedStore = ref(null);

// Status options for filter
const statusOptions = ref([
  { label: 'Semua Status', value: '' },
  { label: 'Siap Closing', value: 'ready' },
  { label: 'Belum Siap', value: 'not_ready' },
  { label: 'Error', value: 'error' },
  { label: 'Sedang Dicek', value: 'checking' }
]);

// Computed properties
const paginatedData = computed(() => {
  const start = first.value;
  const end = start + rowsPerPage.value;
  return filteredData.value.slice(start, end);
});

const startRecord = computed(() => {
  return filteredData.value.length > 0 ? first.value + 1 : 0;
});

const endRecord = computed(() => {
  const end = first.value + rowsPerPage.value;
  return Math.min(end, filteredData.value.length);
});

// Methods
const applyFilters = () => {
  let filtered = [...props.data];
  
  // Apply status filter
  if (selectedStatus.value) {
    filtered = filtered.filter(item => item.status === selectedStatus.value);
  }
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(item => 
      item.storeCode.toLowerCase().includes(query) ||
      item.storeName.toLowerCase().includes(query)
    );
  }
  
  filteredData.value = filtered;
  first.value = 0; // Reset to first page
};

// Watch for data changes
watch(() => props.data, () => {
  applyFilters();
}, { immediate: true });

const onPageChange = (event) => {
  first.value = event.first;
  rowsPerPage.value = event.rows;
};

const getRowClass = (data) => {
  return {
    'row-ready': data.status === 'ready',
    'row-not-ready': data.status === 'not_ready',
    'row-error': data.status === 'error',
    'row-checking': data.status === 'checking'
  };
};

const getStatusLabel = (status) => {
  const labels = {
    'ready': 'Siap Closing',
    'not_ready': 'Belum Siap',
    'error': 'Error',
    'checking': 'Sedang Dicek'
  };
  return labels[status] || status;
};

const getStatusSeverity = (status) => {
  const severities = {
    'ready': 'success',
    'not_ready': 'warning',
    'error': 'danger',
    'checking': 'info'
  };
  return severities[status] || 'secondary';
};

const getStatusIcon = (status) => {
  const icons = {
    'ready': 'pi pi-check-circle',
    'not_ready': 'pi pi-exclamation-triangle',
    'error': 'pi pi-times-circle',
    'checking': 'pi pi-spin pi-spinner'
  };
  return icons[status] || 'pi pi-question-circle';
};

const getWrcIcon = (status) => {
  const icons = {
    'available': 'pi pi-check-circle',
    'missing': 'pi pi-times-circle',
    'partial': 'pi pi-exclamation-triangle',
    'unknown': 'pi pi-question-circle'
  };
  return icons[status] || 'pi pi-question-circle';
};

const getWrcColor = (status) => {
  const colors = {
    'available': '#10b981',
    'missing': '#ef4444',
    'partial': '#f59e0b',
    'unknown': '#6b7280'
  };
  return colors[status] || '#6b7280';
};

const getWrcLabel = (status) => {
  const labels = {
    'available': 'Tersedia',
    'missing': 'Tidak Ada',
    'partial': 'Sebagian',
    'unknown': 'Tidak Diketahui'
  };
  return labels[status] || status;
};

const getCompletenessColor = (percentage) => {
  if (percentage >= 90) return '#10b981';
  if (percentage >= 70) return '#f59e0b';
  return '#ef4444';
};

const getIssueLabel = (issue) => {
  const labels = {
    'wrc_missing': 'WRC Tidak Ada',
    'data_incomplete': 'Data Tidak Lengkap',
    'connection_error': 'Koneksi Error',
    'validation_error': 'Validasi Error',
    'timeout': 'Timeout',
    'permission_error': 'Permission Error'
  };
  return labels[issue] || issue;
};

const getIssueIcon = (issue) => {
  const icons = {
    'wrc_missing': 'pi pi-database',
    'data_incomplete': 'pi pi-exclamation-circle',
    'connection_error': 'pi pi-wifi',
    'validation_error': 'pi pi-times-circle',
    'timeout': 'pi pi-clock',
    'permission_error': 'pi pi-lock'
  };
  return icons[issue] || 'pi pi-question-circle';
};

const getIssueDescription = (issue) => {
  const descriptions = {
    'wrc_missing': 'Data WRC tidak ditemukan untuk toko ini',
    'data_incomplete': 'Beberapa data transaksi tidak lengkap',
    'connection_error': 'Tidak dapat terhubung ke database toko',
    'validation_error': 'Data tidak memenuhi kriteria validasi',
    'timeout': 'Proses pengecekan melebihi batas waktu',
    'permission_error': 'Tidak memiliki akses ke data toko'
  };
  return descriptions[issue] || 'Deskripsi tidak tersedia';
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const viewDetails = (store) => {
  selectedStore.value = store;
  showDetailDialog.value = true;
};

const recheckStore = async (store) => {
  store.rechecking = true;
  try {
    await emit('recheck-store', store.storeCode);
  } finally {
    store.rechecking = false;
  }
};

const exportData = () => {
  emit('export', filteredData.value);
};

// Initialize
onMounted(() => {
  applyFilters();
});
</script>

<style scoped>
.prep-closing-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.table-title h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.table-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.filter-group,
.search-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.status-filter {
  min-width: 150px;
}

.search-input {
  min-width: 200px;
}

.table-container {
  overflow: hidden;
}

.prep-closing-datatable {
  border: none;
}

.store-code-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.store-code {
  font-weight: 600;
  color: #111827;
}

.store-name {
  font-size: 0.75rem;
  color: #6b7280;
}

.wrc-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.completeness-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.completeness-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.completeness-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.completeness-text {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 35px;
}

.issues-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.issue-tag {
  font-size: 0.625rem;
}

.more-issues {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
}

.no-issues {
  font-size: 0.75rem;
  color: #10b981;
  font-style: italic;
}

.no-data {
  color: #9ca3af;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Row styling */
:deep(.row-ready) {
  background-color: rgba(16, 185, 129, 0.05) !important;
}

:deep(.row-not-ready) {
  background-color: rgba(245, 158, 11, 0.05) !important;
}

:deep(.row-error) {
  background-color: rgba(239, 68, 68, 0.05) !important;
}

:deep(.row-checking) {
  background-color: rgba(59, 130, 246, 0.05) !important;
}

/* Store Detail Dialog */
.store-detail-content {
  max-height: 60vh;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h5 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-item span {
  font-size: 0.875rem;
  color: #111827;
}

.issues-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.issue-detail-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #fef3c7;
  border-radius: 6px;
  border-left: 4px solid #f59e0b;
}

.issue-detail-item i {
  color: #f59e0b;
  margin-top: 0.125rem;
}

.issue-detail-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.issue-detail-label {
  font-weight: 600;
  color: #92400e;
}

.issue-detail-desc {
  font-size: 0.875rem;
  color: #a16207;
}

.wrc-detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wrc-status-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.wrc-last-update {
  font-size: 0.875rem;
  color: #6b7280;
}

@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .table-actions {
    flex-wrap: wrap;
    width: 100%;
  }
  
  .search-input {
    min-width: 150px;
  }
  
  .table-footer {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>