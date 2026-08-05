<template>
  <div class="user-manager-page">
    <!-- ===== PREMIUM HEADER ===== -->
    <div class="page-hero">
      <div class="hero-bg-pattern"></div>
      <div class="hero-content">
        <div class="hero-title-section">
          <div class="hero-icon-wrapper">
            <i class="pi pi-users hero-icon"></i>
          </div>
          <div class="hero-text">
            <h1 class="hero-title">Manage User</h1>
            <p class="hero-subtitle">Kelola seluruh akun pengguna sistem, hak akses, dan keamanan</p>
          </div>
        </div>
        <div class="hero-actions">
          <Button
            label="Tambah User"
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
          <i class="pi pi-users"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">Total Users</span>
        </div>
        <div class="stat-trend">
          <i class="pi pi-arrow-up"></i>
          <span>{{ stats.active }} aktif</span>
        </div>
      </div>

      <div class="stat-card stat-card--active">
        <div class="stat-icon-wrap">
          <i class="pi pi-check-circle"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.active }}</span>
          <span class="stat-label">Aktif</span>
        </div>
      </div>

      <div class="stat-card stat-card--inactive">
        <div class="stat-icon-wrap">
          <i class="pi pi-ban"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.inactive }}</span>
          <span class="stat-label">Nonaktif</span>
        </div>
      </div>

      <div class="stat-card stat-card--admin">
        <div class="stat-icon-wrap">
          <i class="pi pi-shield"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.superadmin }}</span>
          <span class="stat-label">Superadmin</span>
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
              placeholder="Cari username, nama, email..."
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
          <span class="info-text">{{ filteredUsers.length }} user{{ filteredUsers.length !== 1 ? 's' : '' }} found</span>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" class="loading-section">
        <div class="skeleton-header">
          <div class="skeleton-row skeleton-row--h"></div>
        </div>
        <div v-for="n in 5" :key="n" class="skeleton-row">
          <div class="skeleton-cell" v-for="c in 6" :key="c"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="state-section state-error">
        <i class="pi pi-exclamation-triangle"></i>
        <h3>Gagal Memuat Data</h3>
        <p>{{ error }}</p>
        <Button label="Coba Lagi" icon="pi pi-refresh" @click="fetchUsers" />
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredUsers.length === 0" class="state-section state-empty">
        <div class="empty-illustration">
          <i class="pi pi-users"></i>
          <i class="pi pi-plus empty-plus"></i>
        </div>
        <h3>{{ searchQuery ? 'Tidak Ditemukan' : 'Belum Ada User' }}</h3>
        <p>
          {{ searchQuery
            ? 'Tidak ada user yang cocok dengan pencarian Anda'
            : 'Belum ada pengguna yang terdaftar dalam sistem'
          }}
        </p>
        <Button
          v-if="!searchQuery"
          label="Tambah User Pertama"
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
          :value="filteredUsers"
          :paginator="true"
          :rows="rows"
          :rowsPerPageOptions="[5, 10, 25, 50]"
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="{first}–{last} dari {totalRecords}"
          sortField="username"
          :sortOrder="1"
          stripedRows
          responsiveLayout="scroll"
          class="p-datatable-sm user-datatable"
        >
          <Column field="username" header="Username" sortable>
            <template #body="{ data }">
              <div class="cell-username">
                <div class="user-avatar">{{ data.username.charAt(0).toUpperCase() }}</div>
                <span class="username-text">{{ data.username }}</span>
              </div>
            </template>
          </Column>

          <Column field="fullName" header="Nama Lengkap" sortable>
            <template #body="{ data }">
              <span class="cell-name">{{ data.fullName || '—' }}</span>
            </template>
          </Column>

          <Column field="email" header="Email" sortable>
            <template #body="{ data }">
              <span class="cell-email">{{ data.email }}</span>
            </template>
          </Column>

          <Column field="role" header="Role" sortable>
            <template #body="{ data }">
              <span class="role-pill" :class="'role--' + data.role">
                <i :class="roleIcon(data.role)"></i>
                <span>{{ data.role }}</span>
              </span>
            </template>
          </Column>

          <Column field="isActive" header="Status" sortable>
            <template #body="{ data }">
              <span class="status-dot" :class="data.isActive ? 'dot-active' : 'dot-inactive'">
                <span class="dot"></span>
                {{ data.isActive ? 'Aktif' : 'Nonaktif' }}
              </span>
            </template>
          </Column>

          <Column field="lastLogin" header="Terakhir Login" sortable>
            <template #body="{ data }">
              <span class="cell-login">{{ formatDate(data.lastLogin) }}</span>
            </template>
          </Column>

          <Column :exportable="false" header="" style="width: 120px">
            <template #body="{ data }">
              <div class="row-actions">
                <button class="row-action-btn edit-tooltip" @click="openEditDialog(data)" title="Edit">
                  <i class="pi pi-pencil"></i>
                </button>
                <button class="row-action-btn reset-tooltip" @click="openResetPasswordDialog(data)" title="Reset Password">
                  <i class="pi pi-key"></i>
                </button>
                <button class="row-action-btn delete-tooltip" @click="openDeleteDialog(data)" title="Hapus">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- ===== FORM DIALOG ===== -->
    <UserFormDialog
      :visible="formDialogVisible"
      :user="selectedUser"
      :isEditing="isEditing"
      :saving="formSaving"
      @close="closeFormDialog"
      @save="handleSaveUser"
    />

    <!-- ===== CONFIRM DELETE DIALOG ===== -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Hapus User"
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
          Hapus user <strong>{{ userToDelete?.username }}</strong>?
        </p>
        <p class="confirm-sub">User yang dihapus tidak bisa dikembalikan lagi.</p>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <Button label="Batal" icon="pi pi-times" class="p-button-text" :disabled="submitLoading" @click="deleteDialogVisible = false" />
          <Button label="Hapus" icon="pi pi-trash" class="p-button-danger" :loading="submitLoading" @click="confirmDelete" />
        </div>
      </template>
    </Dialog>

    <!-- ===== CONFIRM RESET PASSWORD DIALOG ===== -->
    <Dialog
      v-model:visible="resetDialogVisible"
      header="Reset Password"
      :modal="true"
      :closable="true"
      :draggable="false"
      :style="{ width: '440px' }"
      class="confirm-dialog"
    >
      <div class="confirm-body">
        <div class="confirm-icon-wrap warning">
          <i class="pi pi-key"></i>
        </div>
        <p class="confirm-msg">
          Reset password <strong>{{ userToReset?.username }}</strong>?
        </p>
        <p class="confirm-sub">Password baru akan ditampilkan setelah proses selesai.</p>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <Button label="Batal" icon="pi pi-times" class="p-button-text" :disabled="submitLoading" @click="resetDialogVisible = false" />
          <Button label="Reset" icon="pi pi-key" class="p-button-warning" :loading="submitLoading" @click="confirmResetPassword" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import userService from '@/services/user.service.js';
import { useToastService } from '@/utils/toast.js';
import UserFormDialog from './components/UserFormDialog.vue';

const toast = useToastService();

// ── State ──────────────────────────────────────────────────────────────
const users = ref([]);
const loading = ref(false);
const error = ref(null);
const searchQuery = ref('');
const rows = ref(10);

// Form dialog
const formDialogVisible = ref(false);
const isEditing = ref(false);
const selectedUser = ref(null);
const formSaving = ref(false);

// Delete
const deleteDialogVisible = ref(false);
const userToDelete = ref(null);

// Reset password
const resetDialogVisible = ref(false);
const userToReset = ref(null);

const submitLoading = ref(false);

// ── Computed ───────────────────────────────────────────────────────────
const stats = computed(() => {
  const list = users.value;
  return {
    total: list.length,
    active: list.filter((u) => u.isActive).length,
    inactive: list.filter((u) => !u.isActive).length,
    superadmin: list.filter((u) => u.role === 'superadmin').length,
  };
});

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value;
  const q = searchQuery.value.toLowerCase().trim();
  return users.value.filter(
    (u) =>
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
  );
});

// ── Helpers ────────────────────────────────────────────────────────────
function roleIcon(role) {
  switch (role) {
    case 'superadmin':
      return 'pi pi-crown';
    case 'admin':
      return 'pi pi-shield';
    default:
      return 'pi pi-user';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ── API ────────────────────────────────────────────────────────────────
async function fetchUsers() {
  loading.value = true;
  error.value = null;
  try {
    const res = await userService.getAllUsers();
    users.value = res.data || [];
  } catch (err) {
    console.error('Gagal memuat pengguna:', err);
    error.value = err.response?.data?.message || 'Gagal memuat data pengguna';
    users.value = [];
  } finally {
    loading.value = false;
  }
}

// ── Dialogs ────────────────────────────────────────────────────────────
function openAddDialog() {
  isEditing.value = false;
  selectedUser.value = null;
  formDialogVisible.value = true;
}

function openEditDialog(user) {
  isEditing.value = true;
  selectedUser.value = { ...user };
  formDialogVisible.value = true;
}

function closeFormDialog() {
  formDialogVisible.value = false;
  selectedUser.value = null;
}

async function handleSaveUser(formData) {
  formSaving.value = true;
  try {
    if (isEditing.value) {
      await userService.updateUser(formData.id, formData);
      toast.showSuccess('Berhasil', 'User berhasil diperbarui');
    } else {
      await userService.createUser(formData);
      toast.showSuccess('Berhasil', 'User baru berhasil dibuat');
    }
    closeFormDialog();
    await fetchUsers();
  } catch (err) {
    toast.showError('Gagal', err.response?.data?.message || 'Gagal menyimpan user');
  } finally {
    formSaving.value = false;
  }
}

function openDeleteDialog(user) {
  userToDelete.value = user;
  deleteDialogVisible.value = true;
}

async function confirmDelete() {
  if (!userToDelete.value) return;
  submitLoading.value = true;
  try {
    await userService.deleteUser(userToDelete.value.id);
    toast.showSuccess('Berhasil', `User ${userToDelete.value.username} berhasil dihapus`);
    deleteDialogVisible.value = false;
    userToDelete.value = null;
    await fetchUsers();
  } catch (err) {
    toast.showError('Gagal', err.response?.data?.message || 'Gagal menghapus user');
  } finally {
    submitLoading.value = false;
  }
}

function openResetPasswordDialog(user) {
  userToReset.value = user;
  resetDialogVisible.value = true;
}

async function confirmResetPassword() {
  if (!userToReset.value) return;
  submitLoading.value = true;
  try {
    const res = await userService.resetPassword(userToReset.value.id);
    const newPassword = res.data?.newPassword || '(tidak diketahui)';
    toast.showSuccess('Password Direset', `Password baru untuk ${userToReset.value.username}: ${newPassword}`, 10000);
    resetDialogVisible.value = false;
    userToReset.value = null;
    await fetchUsers();
  } catch (err) {
    toast.showError('Gagal', err.response?.data?.message || 'Gagal mereset password');
  } finally {
    submitLoading.value = false;
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(() => {
  fetchUsers();
});
</script>

<style scoped src="./index.style.css"></style>
