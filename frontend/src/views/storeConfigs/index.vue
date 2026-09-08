<template>
  <div class="store-config-page">
    <!-- ===== HEADER ===== -->
    <div class="page-hero">
      <div class="hero-bg-pattern"></div>
      <div class="hero-content">
        <div class="hero-title-section">
          <div class="hero-icon-wrapper">
            <i class="pi pi-key hero-icon"></i>
          </div>
          <div class="hero-text">
            <h1 class="hero-title">Store Interfence Configs</h1>
            <p class="hero-subtitle">Kelola credentials koneksi database store interfence</p>
          </div>
        </div>
        <div class="hero-actions">
          <Button
            label="Tambah Config"
            icon="pi pi-plus"
            class="hero-btn"
            @click="openAddDialog"
          />
        </div>
      </div>
    </div>

    <!-- ===== STATS CARDS ===== -->
    <div class="stats-grid">
      <div class="stat-card stat-card--total">
        <div class="stat-icon-wrap">
          <i class="pi pi-key"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ configs.length }}</span>
          <span class="stat-label">Total Configs</span>
        </div>
      </div>

      <div class="stat-card stat-card--user">
        <div class="stat-icon-wrap">
          <i class="pi pi-user"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ kasirCount }}</span>
          <span class="stat-label">Kasir Users</span>
        </div>
      </div>

      <div class="stat-card stat-card--root">
        <div class="stat-icon-wrap">
          <i class="pi pi-shield"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ rootCount }}</span>
          <span class="stat-label">Root Users</span>
        </div>
      </div>
    </div>

    <!-- ===== TABLE CARD ===== -->
    <div class="table-card">
      <!-- Toolbar -->
      <div class="table-toolbar">
        <div class="toolbar-left">
          <IconField iconPosition="left">
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText
              v-model="searchQuery"
              placeholder="Cari user..."
              class="search-input"
            />
          </IconField>
          <Button
            v-if="searchQuery"
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-sm"
            @click="searchQuery = ''"
            v-tooltip.top="'Hapus pencarian'"
          />
        </div>
        <div class="toolbar-info" v-if="!loading">
          <span class="info-text">{{ filteredConfigs.length }} config{{ filteredConfigs.length !== 1 ? 's' : '' }} found</span>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" class="loading-section">
        <div class="skeleton-row" v-for="n in 3" :key="n">
          <div class="skeleton-cell" v-for="c in 4" :key="c"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="state-section state-error">
        <i class="pi pi-exclamation-triangle"></i>
        <h3>Gagal Memuat Data</h3>
        <p>{{ error }}</p>
        <Button label="Coba Lagi" icon="pi pi-refresh" @click="fetchConfigs" />
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredConfigs.length === 0" class="state-section state-empty">
        <div class="empty-illustration">
          <i class="pi pi-key"></i>
          <i class="pi pi-plus empty-plus"></i>
        </div>
        <h3>{{ searchQuery ? 'Tidak Ditemukan' : 'Belum Ada Config' }}</h3>
        <p>
          {{ searchQuery
            ? 'Tidak ada config yang cocok dengan pencarian Anda'
            : 'Belum ada store interfence config yang terdaftar'
          }}
        </p>
        <Button
          v-if="!searchQuery"
          label="Tambah Config Pertama"
          icon="pi pi-plus"
          @click="openAddDialog"
        />
        <Button
          v-else
          label="Hapus Pencarian"
          icon="pi pi-times"
          class="p-button-text"
          @click="searchQuery = ''"
        />
      </div>

      <!-- Data Table -->
      <div v-else class="table-wrapper">
        <DataTable
          :value="filteredConfigs"
          :paginator="true"
          :rows="rows"
          :rowsPerPageOptions="[5, 10, 25]"
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="{first}–{last} dari {totalRecords}"
          sortField="id"
          :sortOrder="1"
          stripedRows
          responsiveLayout="scroll"
          class="p-datatable-sm config-datatable"
        >
          <Column field="id" header="ID" sortable style="width: 60px">
            <template #body="{ data }">
              <span class="cell-id">#{{ data.id }}</span>
            </template>
          </Column>

          <Column field="user" header="Username" sortable>
            <template #body="{ data }">
              <div class="cell-username">
                <div class="user-avatar" :class="'avatar--' + data.user">
                  {{ data.user.charAt(0).toUpperCase() }}
                </div>
                <span class="username-text">{{ data.user }}</span>
              </div>
            </template>
          </Column>

          <Column field="password" header="Password" sortable>
            <template #body="{ data }">
              <div class="cell-password">
                <span v-if="visiblePasswords.includes(data.id)" class="password-visible">
                  {{ data.password }}
                </span>
                <span v-else class="password-masked">••••••••</span>
                <button
                  class="toggle-password-btn"
                  @click="togglePasswordVisibility(data.id)"
                  :title="visiblePasswords.includes(data.id) ? 'Sembunyikan' : 'Tampilkan'"
                >
                  <i :class="visiblePasswords.includes(data.id) ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
            </template>
          </Column>

          <Column field="user" header="Tipe" sortable>
            <template #body="{ data }">
              <span class="type-pill" :class="'type--' + data.user">
                {{ data.user === 'root' ? 'Root' : 'Kasir' }}
              </span>
            </template>
          </Column>

          <Column :exportable="false" header="" style="width: 150px">
            <template #body="{ data }">
              <div class="row-actions">
                <button class="row-action-btn" @click="openEditDialog(data)" title="Edit">
                  <i class="pi pi-pencil"></i>
                </button>
                <button class="row-action-btn delete-btn" @click="openDeleteDialog(data)" title="Hapus">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- ===== FORM DIALOG ===== -->
    <Dialog
      v-model:visible="formDialogVisible"
      :header="isEditing ? 'Edit Config' : 'Tambah Config Baru'"
      :modal="true"
      :closable="true"
      :draggable="false"
      :style="{ width: '480px' }"
      class="form-dialog"
    >
      <div class="form-grid">
        <div class="form-field">
          <label for="configUser">Username <span class="required">*</span></label>
          <InputText
            id="configUser"
            v-model="formData.user"
            placeholder="Contoh: kasir atau root"
            class="w-full"
            :class="{ 'p-invalid': formErrors.user }"
          />
          <small v-if="formErrors.user" class="p-error">{{ formErrors.user }}</small>
        </div>

        <div class="form-field">
          <label for="configPassword">Password <span class="required">*</span></label>
          <div class="password-field">
            <InputText
              id="configPassword"
              v-model="formData.password"
              :type="showFormPassword ? 'text' : 'password'"
              placeholder="Masukkan password"
              class="w-full"
              :class="{ 'p-invalid': formErrors.password }"
            />
            <button
              type="button"
              class="password-toggle"
              @click="showFormPassword = !showFormPassword"
            >
              <i :class="showFormPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
          <small v-if="formErrors.password" class="p-error">{{ formErrors.password }}</small>
        </div>
      </div>

      <template #footer>
        <div class="dialog-actions">
          <Button
            label="Batal"
            icon="pi pi-times"
            class="p-button-text"
            :disabled="formSaving"
            @click="formDialogVisible = false"
          />
          <Button
            :label="isEditing ? 'Simpan' : 'Tambah'"
            :icon="isEditing ? 'pi pi-check' : 'pi pi-plus'"
            :loading="formSaving"
            @click="handleSave"
          />
        </div>
      </template>
    </Dialog>

    <!-- ===== CONFIRM DELETE DIALOG ===== -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Hapus Config"
      :modal="true"
      :closable="true"
      :draggable="false"
      :style="{ width: '440px' }"
      class="confirm-dialog"
    >
      <div class="confirm-body">
        <div class="confirm-icon-wrap danger">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <p class="confirm-msg">
          Hapus config <strong>{{ configToDelete?.user }}</strong>?
        </p>
        <p class="confirm-sub">Config yang dihapus tidak bisa dikembalikan.</p>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <Button label="Batal" icon="pi pi-times" class="p-button-text" :disabled="submitLoading" @click="deleteDialogVisible = false" />
          <Button label="Hapus" icon="pi pi-trash" class="p-button-danger" :loading="submitLoading" @click="confirmDelete" />
        </div>
      </template>
    </Dialog>


  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import storeConfigService from '@/services/storeConfig.service.js';
import { useToastService } from '@/utils/toast.js';

const toast = useToastService();

// ── State ──────────────────────────────────────────────────────────────
const configs = ref([]);
const loading = ref(false);
const error = ref(null);
const searchQuery = ref('');
const rows = ref(10);
const visiblePasswords = ref([]);

// Form dialog
const formDialogVisible = ref(false);
const isEditing = ref(false);
const selectedConfig = ref(null);
const formSaving = ref(false);
const showFormPassword = ref(false);
const formData = ref({ user: '', password: '' });
const formErrors = ref({});

// Delete
const deleteDialogVisible = ref(false);
const configToDelete = ref(null);

const submitLoading = ref(false);

// ── Computed ───────────────────────────────────────────────────────────
const kasirCount = computed(() => configs.value.filter(c => c.user === 'kasir').length);
const rootCount = computed(() => configs.value.filter(c => c.user === 'root').length);

const filteredConfigs = computed(() => {
  if (!searchQuery.value) return configs.value;
  const q = searchQuery.value.toLowerCase().trim();
  return configs.value.filter(c =>
    c.user && c.user.toLowerCase().includes(q)
  );
});

// ── API ────────────────────────────────────────────────────────────────
async function fetchConfigs() {
  loading.value = true;
  error.value = null;
  try {
    const res = await storeConfigService.getAllConfigs();
    configs.value = res.data || [];
  } catch (err) {
    console.error('Gagal memuat store configs:', err);
    error.value = err.message || 'Gagal memuat data config';
    configs.value = [];
  } finally {
    loading.value = false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────
function togglePasswordVisibility(id) {
  const index = visiblePasswords.value.indexOf(id);
  if (index === -1) {
    visiblePasswords.value.push(id);
  } else {
    visiblePasswords.value.splice(index, 1);
  }
}

function validateForm() {
  formErrors.value = {};
  if (!formData.value.user?.trim()) {
    formErrors.value.user = 'Username wajib diisi';
  }
  if (!formData.value.password) {
    formErrors.value.password = 'Password wajib diisi';
  }
  return Object.keys(formErrors.value).length === 0;
}

// ── Dialogs ────────────────────────────────────────────────────────────
function openAddDialog() {
  isEditing.value = false;
  selectedConfig.value = null;
  formData.value = { user: '', password: '' };
  formErrors.value = {};
  showFormPassword.value = false;
  formDialogVisible.value = true;
}

function openEditDialog(config) {
  isEditing.value = true;
  selectedConfig.value = config;
  formData.value = { user: config.user, password: '' };
  formErrors.value = {};
  showFormPassword.value = false;
  formDialogVisible.value = true;
}

async function handleSave() {
  if (!validateForm()) return;

  formSaving.value = true;
  try {
    const payload = { user: formData.value.user.trim() };
    if (formData.value.password) {
      payload.password = formData.value.password;
    }

    if (isEditing.value) {
      await storeConfigService.updateConfig(selectedConfig.value.id, payload);
      toast.showSuccess('Berhasil', 'Config berhasil diperbarui');
    } else {
      await storeConfigService.createConfig(payload);
      toast.showSuccess('Berhasil', 'Config baru berhasil ditambahkan');
    }
    formDialogVisible.value = false;
    await fetchConfigs();
  } catch (err) {
    toast.showError('Gagal', err.message || 'Gagal menyimpan config');
  } finally {
    formSaving.value = false;
  }
}

function openDeleteDialog(config) {
  configToDelete.value = config;
  deleteDialogVisible.value = true;
}

async function confirmDelete() {
  if (!configToDelete.value) return;
  submitLoading.value = true;
  try {
    await storeConfigService.deleteConfig(configToDelete.value.id);
    toast.showSuccess('Berhasil', `Config ${configToDelete.value.user} berhasil dihapus`);
    deleteDialogVisible.value = false;
    configToDelete.value = null;
    await fetchConfigs();
  } catch (err) {
    toast.showError('Gagal', err.message || 'Gagal menghapus config');
  } finally {
    submitLoading.value = false;
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(() => {
  fetchConfigs();
});
</script>

<style scoped src="./index.style.css"></style>
