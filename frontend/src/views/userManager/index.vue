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

<style scoped>
/* ===== PAGE LAYOUT ===== */
.user-manager-page {
  padding: 1.5rem 2rem;
}

/* ===== HERO HEADER ===== */
.page-hero {
  position: relative;
  margin-bottom: 1.5rem;
  padding: 2rem 2.5rem;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #3730a3 70%, #4338ca 100%);
  border-radius: 20px;
  overflow: hidden;
  isolation: isolate;
}

.hero-bg-pattern {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 0% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 100%),
    radial-gradient(ellipse 60% 40% at 100% 80%, rgba(129, 140, 248, 0.1) 0%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.hero-title-section {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.hero-icon-wrapper {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.hero-icon {
  font-size: 1.75rem;
  color: #c7d2fe;
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 0.35rem 0;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  margin: 0;
  color: rgba(199, 210, 254, 0.85);
  font-size: 0.95rem;
  font-weight: 400;
}

.hero-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #fff !important;
  padding: 0.75rem 1.5rem !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
  transition: all 0.25s ease !important;
  white-space: nowrap;
}

.hero-btn:hover {
  background: rgba(255, 255, 255, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  transform: translateY(-1px);
}

/* ===== STATS CARDS ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.stat-card--total::before { background: linear-gradient(90deg, #6366f1, #818cf8); }
.stat-card--active::before { background: linear-gradient(90deg, #22c55e, #4ade80); }
.stat-card--inactive::before { background: linear-gradient(90deg, #ef4444, #f87171); }
.stat-card--admin::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.stat-card--total .stat-icon-wrap { background: #eef2ff; color: #6366f1; }
.stat-card--active .stat-icon-wrap { background: #f0fdf4; color: #22c55e; }
.stat-card--inactive .stat-icon-wrap { background: #fef2f2; color: #ef4444; }
.stat-card--admin .stat-icon-wrap { background: #fffbeb; color: #f59e0b; }

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-trend {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #22c55e;
  background: #f0fdf4;
  padding: 0.3rem 0.6rem;
  border-radius: 20px;
  white-space: nowrap;
}

/* ===== TABLE CARD ===== */
.table-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

/* Toolbar */
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  max-width: 380px;
}

.search-input {
  width: 100%;
}

.toolbar-info .info-text {
  font-size: 0.85rem;
  color: #9ca3af;
  font-weight: 500;
}

/* ===== USERNAME CELL ===== */
.cell-username {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: 8px;
  flex-shrink: 0;
}

.username-text {
  font-weight: 600;
  color: #111827;
}

/* ===== ROLE PILL ===== */
.role-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.role-pill i {
  font-size: 0.7rem;
}

.role--superadmin {
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
}

.role--admin {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.role--user {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

/* ===== STATUS DOT ===== */
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot-active {
  color: #15803d;
}
.dot-active .dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.dot-inactive {
  color: #dc2626;
}
.dot-inactive .dot {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

/* ===== CELLS ===== */
.cell-name {
  color: #374151;
}

.cell-email {
  color: #6b7280;
  font-size: 0.875rem;
}

.cell-login {
  color: #9ca3af;
  font-size: 0.85rem;
}

/* ===== ROW ACTIONS ===== */
.row-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

tr:hover .row-actions {
  opacity: 1;
}

.row-action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
  background: transparent;
  color: #9ca3af;
}

.row-action-btn:hover {
  transform: scale(1.1);
}

.edit-tooltip:hover { background: #eef2ff; color: #6366f1; }
.reset-tooltip:hover { background: #fffbeb; color: #f59e0b; }
.delete-tooltip:hover { background: #fef2f2; color: #ef4444; }

/* ===== TABLE STYLING OVERRIDES ===== */
:deep(.p-datatable.user-datatable .p-datatable-thead > tr > th) {
  background: #f9fafb;
  color: #374151;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.85rem 1rem;
  border-bottom: 2px solid #e5e7eb;
}

:deep(.p-datatable.user-datatable .p-datatable-tbody > tr > td) {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}

:deep(.p-datatable.user-datatable .p-datatable-tbody > tr:hover) {
  background: #fafbff;
}

:deep(.p-datatable.user-datatable .p-paginator) {
  padding: 0.75rem 1rem;
  border-top: 1px solid #f3f4f6;
  background: #fafbfc;
}

/* ===== LOADING / SKELETON ===== */
.loading-section {
  padding: 1.5rem;
}

.skeleton-header {
  padding: 0 0 1rem 0;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 0.5rem;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.8fr 0.8fr 0.8fr 1fr;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid #f9fafb;
}

.skeleton-row--h {
  display: block;
  padding: 0.75rem 0;
}

.skeleton-cell,
.skeleton-row--h {
  height: 16px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== STATE SECTIONS ===== */
.state-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.state-section h3 {
  font-size: 1.15rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.state-section p {
  color: #9ca3af;
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
  max-width: 360px;
}

.state-error i {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

/* Empty */
.empty-illustration {
  position: relative;
  margin-bottom: 1.5rem;
}

.empty-illustration > i:first-child {
  font-size: 4rem;
  color: #d1d5db;
}

.empty-plus {
  position: absolute;
  bottom: 0;
  right: 0;
  transform: translate(30%, 30%);
  font-size: 1.2rem !important;
  color: #9ca3af;
  background: #fff;
  border-radius: 50%;
  padding: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* ===== CONFIRM DIALOGS ===== */
.confirm-body {
  text-align: center;
  padding: 0.5rem 0;
}

.confirm-icon-wrap {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
}

.confirm-icon-wrap.danger {
  background: #fef2f2;
  color: #ef4444;
}

.confirm-icon-wrap.warning {
  background: #fffbeb;
  color: #f59e0b;
}

.confirm-msg {
  font-size: 1.05rem;
  color: #374151;
  margin: 0 0 0.5rem 0;
  line-height: 1.5;
}

.confirm-sub {
  font-size: 0.85rem;
  color: #9ca3af;
  margin: 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .user-manager-page {
    padding: 1rem;
  }

  .page-hero {
    padding: 1.5rem;
  }

  .hero-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-btn {
    width: 100%;
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .toolbar-left {
    max-width: 100%;
  }

  .toolbar-info {
    text-align: right;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .hero-title-section {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
