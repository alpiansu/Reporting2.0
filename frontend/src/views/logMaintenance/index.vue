<template>
  <div class="log-maintenance-page">
    <div class="page-hero">
      <div class="hero-bg-pattern"></div>
      <div class="hero-content">
        <div class="hero-title-section">
          <div class="hero-icon-wrapper">
            <i class="pi pi-file-edit hero-icon"></i>
          </div>
          <div class="hero-text">
            <h1 class="hero-title">Log Maintenance</h1>
            <p class="hero-subtitle">
              Lihat dan kelola file log aplikasi. Hanya dapat diakses superadmin.
            </p>
          </div>
        </div>
        <div class="hero-actions">
          <Button
            v-if="selectedNames.length"
            :label="`Hapus Terpilih (${selectedNames.length})`"
            icon="pi pi-trash"
            class="hero-btn hero-btn--danger"
            @click="openDeleteDialog(selectedFiles)"
          />
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            class="hero-btn"
            :loading="loading"
            @click="fetchFiles"
          />
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card--files">
        <div class="stat-icon-wrap">
          <i class="pi pi-folder-open"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ summary.totalFiles }}</span>
          <span class="stat-label">Total File</span>
        </div>
      </div>

      <div class="stat-card stat-card--size">
        <div class="stat-icon-wrap">
          <i class="pi pi-database"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatBytes(summary.totalSize) }}</span>
          <span class="stat-label">Total Ukuran</span>
        </div>
      </div>

      <div class="stat-card stat-card--app">
        <div class="stat-icon-wrap">
          <i class="pi pi-file"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ summary.app.count }}</span>
          <span class="stat-label">App Logs ({{ formatBytes(summary.app.size) }})</span>
        </div>
      </div>

      <div class="stat-card stat-card--error">
        <div class="stat-icon-wrap">
          <i class="pi pi-exclamation-circle"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ summary.error.count }}</span>
          <span class="stat-label">Error Logs ({{ formatBytes(summary.error.size) }})</span>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <IconField iconPosition="left">
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText
              v-model="searchQuery"
              placeholder="Cari nama file..."
              class="search-input"
            />
          </IconField>
          <Button
            v-if="searchQuery"
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-sm"
            v-tooltip.top="'Hapus pencarian'"
            @click="searchQuery = ''"
          />
        </div>
        <div class="toolbar-info">
          <span>{{ filteredFiles.length }} file</span>
          <span v-if="selectedNames.length"> &middot; {{ selectedNames.length }} dipilih</span>
        </div>
      </div>

      <div v-if="loading" class="loading-section">
        <div v-for="n in 5" :key="n" class="skeleton-row">
          <div v-for="c in 6" :key="c" class="skeleton-cell"></div>
        </div>
      </div>

      <div v-else-if="error" class="state-section state-error">
        <i class="pi pi-exclamation-triangle"></i>
        <h3>Gagal Memuat Data</h3>
        <p>{{ error }}</p>
        <Button label="Coba Lagi" icon="pi pi-refresh" @click="fetchFiles" />
      </div>

      <div v-else-if="filteredFiles.length === 0" class="state-section state-empty">
        <i class="pi pi-inbox"></i>
        <h3>{{ searchQuery ? 'Tidak Ditemukan' : 'Belum Ada File Log' }}</h3>
        <p>
          {{ searchQuery
            ? 'Tidak ada file log yang cocok dengan pencarian Anda'
            : 'Belum ada file log yang tersedia di server'
          }}
        </p>
      </div>

      <div v-else class="table-wrapper">
        <DataTable
          :value="filteredFiles"
          :paginator="true"
          :rows="rows"
          :rowsPerPageOptions="[10, 25, 50]"
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="{first}-{last} dari {totalRecords}"
          sortField="modifiedAt"
          :sortOrder="-1"
          dataKey="name"
          stripedRows
          responsiveLayout="scroll"
          class="p-datatable-sm log-datatable"
        >
          <Column header="" style="width: 44px">
            <template #header>
              <input
                type="checkbox"
                class="log-checkbox"
                :checked="allDeletableSelected"
                :indeterminate.prop="someDeletableSelected"
                :disabled="deletableFiles.length === 0"
                @change="toggleSelectAll"
              />
            </template>
            <template #body="{ data }">
              <input
                type="checkbox"
                class="log-checkbox"
                :checked="selectedNames.includes(data.name)"
                :disabled="!data.deletable"
                @change="toggleSelection(data)"
              />
            </template>
          </Column>

          <Column field="name" header="Nama File" sortable>
            <template #body="{ data }">
              <div class="file-cell">
                <i class="pi file-icon" :class="data.compressed ? 'pi-box' : 'pi-file'"></i>
                <div class="file-name-wrap">
                  <span class="file-name">{{ data.name }}</span>
                  <div class="file-badges">
                    <span class="mini-pill" :class="`mini-pill--${data.type}`">
                      {{ data.type === 'app' ? 'Application' : 'Error' }}
                    </span>
                    <span v-if="data.compressed" class="mini-pill mini-pill--compressed">
                      Compressed
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <Column field="size" header="Ukuran" sortable style="width: 110px">
            <template #body="{ data }">
              <span class="size-text">{{ formatBytes(data.size) }}</span>
            </template>
          </Column>

          <Column field="modifiedAt" header="Terakhir Diubah" sortable style="width: 190px">
            <template #body="{ data }">
              <span class="date-text">{{ formatDateTime(data.modifiedAt) }}</span>
            </template>
          </Column>

          <Column field="active" header="Status" style="width: 130px">
            <template #body="{ data }">
              <span class="status-pill" :class="data.active ? 'status-pill--active' : 'status-pill--archived'">
                {{ data.active ? 'Active' : 'Archived' }}
              </span>
            </template>
          </Column>

          <Column header="Aksi" style="width: 150px">
            <template #body="{ data }">
              <div class="row-actions">
                <button
                  class="row-action-btn"
                  v-tooltip.top="data.compressed ? 'File terkompresi, download untuk melihat' : 'Lihat log'"
                  @click="openViewer(data)"
                >
                  <i class="pi pi-eye"></i>
                </button>
                <button
                  class="row-action-btn"
                  :disabled="downloadLoading === data.name"
                  v-tooltip.top="'Download file'"
                  @click="download(data)"
                >
                  <i
                    class="pi"
                    :class="downloadLoading === data.name ? 'pi-spin pi-spinner' : 'pi-download'"
                  ></i>
                </button>
                <button
                  class="row-action-btn delete-btn"
                  :disabled="!data.deletable"
                  v-tooltip.top="data.deletable ? 'Hapus file' : 'File aktif tidak dapat dihapus'"
                  @click="openDeleteDialog([data])"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <LogViewerDialog v-model:visible="viewerVisible" :file="viewerFile" />

    <Dialog
      v-model:visible="compressedInfoVisible"
      header="File Terkompresi"
      :modal="true"
      :closable="true"
      :draggable="false"
      :style="{ width: '440px' }"
    >
      <div class="info-body">
        <div class="info-icon-wrap">
          <i class="pi pi-box"></i>
        </div>
        <p>
          File <strong>{{ compressedInfoFile?.name }}</strong> sudah dikompres (.gz).
        </p>
        <p class="confirm-sub">
          Preview tidak tersedia di aplikasi. Silakan download file untuk melihat isinya.
        </p>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <Button
            label="Tutup"
            icon="pi pi-times"
            class="p-button-text"
            @click="compressedInfoVisible = false"
          />
          <Button
            label="Download"
            icon="pi pi-download"
            :loading="downloadLoading === compressedInfoFile?.name"
            @click="downloadCompressed"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Hapus File Log"
      :modal="true"
      :closable="true"
      :draggable="false"
      :style="{ width: '460px' }"
    >
      <div class="confirm-body">
        <div class="confirm-icon-wrap danger">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <p v-if="deleteTargets.length === 1" class="confirm-msg">
          Hapus file <strong>{{ deleteTargets[0]?.name }}</strong>?
        </p>
        <p v-else class="confirm-msg">
          Hapus <strong>{{ deleteTargets.length }}</strong> file log terpilih?
        </p>
        <p class="confirm-sub">File yang dihapus tidak bisa dikembalikan.</p>
        <ul v-if="deleteTargets.length > 1" class="delete-list">
          <li v-for="file in deleteTargets.slice(0, 5)" :key="file.name">{{ file.name }}</li>
          <li v-if="deleteTargets.length > 5">+{{ deleteTargets.length - 5 }} file lainnya</li>
        </ul>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <Button
            label="Batal"
            icon="pi pi-times"
            class="p-button-text"
            :disabled="deleteLoading"
            @click="deleteDialogVisible = false"
          />
          <Button
            label="Hapus"
            icon="pi pi-trash"
            class="p-button-danger"
            :loading="deleteLoading"
            @click="confirmDelete"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import logMaintenanceService from '@/services/logMaintenance.service.js';
import { useToastService } from '@/utils/toast.js';
import LogViewerDialog from './components/LogViewerDialog.vue';
import { formatBytes, formatDateTime } from './utils.js';

const toast = useToastService();

const files = ref([]);
const summary = ref({
  totalFiles: 0,
  totalSize: 0,
  app: { count: 0, size: 0 },
  error: { count: 0, size: 0 },
});
const loading = ref(false);
const error = ref(null);
const searchQuery = ref('');
const selectedNames = ref([]);
const rows = ref(10);

const viewerVisible = ref(false);
const viewerFile = ref(null);

const compressedInfoVisible = ref(false);
const compressedInfoFile = ref(null);

const deleteDialogVisible = ref(false);
const deleteTargets = ref([]);
const deleteLoading = ref(false);
const downloadLoading = ref(null);

const filteredFiles = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return files.value;

  return files.value.filter(file => {
    const status = file.active ? 'active' : 'archived';
    const compressed = file.compressed ? 'compressed' : 'plain';
    return [file.name, file.type, status, compressed].some(value =>
      value.toLowerCase().includes(query),
    );
  });
});

const deletableFiles = computed(() => files.value.filter(file => file.deletable));

const selectedFiles = computed(() =>
  files.value.filter(file => selectedNames.value.includes(file.name)),
);

const allDeletableSelected = computed(
  () =>
    deletableFiles.value.length > 0 &&
    deletableFiles.value.every(file => selectedNames.value.includes(file.name)),
);

const someDeletableSelected = computed(
  () => selectedNames.value.length > 0 && !allDeletableSelected.value,
);

async function fetchFiles() {
  loading.value = true;
  error.value = null;

  try {
    const response = await logMaintenanceService.getFiles();
    files.value = response.data?.files || [];
    summary.value = response.data?.summary || summary.value;

    const deletableNames = new Set(
      files.value.filter(file => file.deletable).map(file => file.name),
    );
    selectedNames.value = selectedNames.value.filter(name => deletableNames.has(name));
  } catch (err) {
    error.value = err.message || 'Gagal memuat daftar file log';
    files.value = [];
  } finally {
    loading.value = false;
  }
}

function toggleSelection(file) {
  if (!file.deletable) return;

  const index = selectedNames.value.indexOf(file.name);
  if (index === -1) {
    selectedNames.value = [...selectedNames.value, file.name];
  } else {
    selectedNames.value = selectedNames.value.filter(name => name !== file.name);
  }
}

function toggleSelectAll(event) {
  if (event.target.checked) {
    selectedNames.value = deletableFiles.value.map(file => file.name);
  } else {
    selectedNames.value = [];
  }
}

function openViewer(file) {
  if (file.compressed) {
    compressedInfoFile.value = file;
    compressedInfoVisible.value = true;
    return;
  }

  viewerFile.value = file;
  viewerVisible.value = true;
}

async function download(file) {
  if (!file?.name || downloadLoading.value) return;

  downloadLoading.value = file.name;

  try {
    const response = await logMaintenanceService.createDownloadTicket(file.name);
    const downloadUrl = response.data?.downloadUrl;

    if (!downloadUrl) {
      throw new Error('URL download tidak tersedia');
    }

    window.location.assign(downloadUrl);
  } catch (err) {
    toast.showError('Gagal', err.message || 'Gagal menyiapkan download');
  } finally {
    downloadLoading.value = null;
  }
}

function downloadCompressed() {
  const file = compressedInfoFile.value;
  compressedInfoVisible.value = false;

  if (file) {
    download(file);
  }
}

function openDeleteDialog(targets) {
  const deletableTargets = (targets || []).filter(file => file.deletable);

  if (deletableTargets.length === 0) {
    toast.showWarning('Tidak Bisa Dihapus', 'File log aktif hari ini tidak dapat dihapus');
    return;
  }

  deleteTargets.value = deletableTargets;
  deleteDialogVisible.value = true;
}

async function confirmDelete() {
  if (deleteTargets.value.length === 0) return;

  const targets = [...deleteTargets.value];
  deleteLoading.value = true;

  try {
    if (targets.length === 1) {
      await logMaintenanceService.deleteFile(targets[0].name);
      toast.showSuccess('Berhasil', `${targets[0].name} berhasil dihapus`);
    } else {
      const response = await logMaintenanceService.bulkDelete(
        targets.map(file => file.name),
      );
      const result = response.data || {};
      const deleted = result.deleted?.length || 0;
      const skipped = result.skipped?.length || 0;
      const failed = result.failed?.length || 0;

      if (deleted > 0) {
        toast.showSuccess('Berhasil', `${deleted} file log berhasil dihapus`);
      }
      if (skipped > 0) {
        toast.showWarning('Sebagian Dilewati', `${skipped} file log dilewati`);
      }
      if (failed > 0) {
        toast.showError('Gagal', `${failed} file log gagal dihapus`);
      }
    }

    deleteDialogVisible.value = false;
    deleteTargets.value = [];
    selectedNames.value = [];
    await fetchFiles();
  } catch (err) {
    toast.showError('Gagal', err.message || 'Gagal menghapus file log');
  } finally {
    deleteLoading.value = false;
  }
}

onMounted(() => {
  fetchFiles();
});
</script>

<style scoped src="./index.style.css"></style>
