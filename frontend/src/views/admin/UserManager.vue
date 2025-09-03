<template>
  <div class="user-manager">
    <div class="page-header">
      <h1 class="page-title">
        <i class="pi pi-users"></i>
        Manajemen Pengguna
      </h1>
      <p class="page-description">Kelola pengguna sistem dan hak akses mereka</p>
    </div>

    <div class="content-wrapper">
      <div class="table-section">
        <div class="section-header">
          <h2 class="section-title">Daftar Pengguna</h2>
          <div class="section-actions">
            <button @click="addUser" class="btn btn-primary">
              <i class="pi pi-plus"></i>
              Tambah Pengguna
            </button>
          </div>
        </div>

        <UserDataTable
          :data="users"
          :loading="loading"
          :error="error"
          @refresh="fetchUsers"
          @export="exportUsers"
          @print="printUsers"
          @edit-user="editUser"
          @reset-password="confirmResetPassword"
          @delete-user="confirmDeleteUser"
        />
      </div>
    </div>

    <!-- User Dialog Component -->
    <UserDialog
      :show="showUserModal"
      :user="selectedUser"
      :is-editing="isEditingUser"
      @close="closeUserModal"
      @save="saveUser"
    />

    <!-- Confirm Dialog Component -->
    <ConfirmDialog
      :show="showConfirmModal"
      :message="confirmMessage"
      :type="confirmType"
      @close="closeConfirmModal"
      @confirm="confirmCallback"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api';
import UserDataTable from '../../components/admin/UserDataTable.vue';
import UserDialog from '../../components/admin/UserDialog.vue';
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue';

const toast = useToast();

// User state
const users = ref([]);
const loading = ref(false);
const error = ref(null);

// User form state
const showUserModal = ref(false);
const isEditingUser = ref(false);
const selectedUser = ref(null);

// Table configuration - removed as DataTable uses slot-based approach

// Sorting state - removed as not needed

// Computed properties
const hasUsers = computed(() => users.value.length > 0);

// Confirmation modal state
const showConfirmModal = ref(false);
const confirmMessage = ref('');
const confirmType = ref('warning');
const confirmCallback = ref(() => {});



// Fetch users from API
async function fetchUsers() {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await api.get('/users');
    users.value = response.data.data || [];
  } catch (err) {
    console.error('Failed to fetch users:', err);
    error.value = err.response?.data?.message || 'Gagal memuat data pengguna';
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.value,
      life: 3000
    });
  } finally {
    loading.value = false;
  }
}

// Fetch users on component mount
onMounted(async () => {
  await fetchUsers();
});

// User form methods
function addUser() {
  isEditingUser.value = false;
  selectedUser.value = null;
  showUserModal.value = true;
}

function editUser(user) {
  isEditingUser.value = true;
  selectedUser.value = user;
  showUserModal.value = true;
}



async function saveUser(userData) {
  try {
    if (isEditingUser.value) {
      await api.put(`/users/${userData.id}`, userData);
      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: 'Pengguna berhasil diperbarui',
        life: 3000
      });
    } else {
      await api.post('/users', userData);
      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: 'Pengguna baru berhasil dibuat',
        life: 3000
      });
    }
    closeUserModal();
    // Refresh user list after saving
    await fetchUsers();
  } catch (error) {
    console.error('Failed to save user:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Gagal menyimpan data pengguna',
      life: 3000
    });
  }
}

function closeUserModal() {
  showUserModal.value = false;
}

// Confirmation modal methods
function confirmDeleteUser(user) {
  confirmMessage.value = `Apakah Anda yakin ingin menghapus pengguna ${user.username}?`;
  confirmType.value = 'danger';
  confirmCallback.value = async () => {
    try {
      await api.delete(`/users/${user.id}`);
      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: 'Pengguna berhasil dihapus',
        life: 3000
      });
      closeConfirmModal();
      // Refresh user list after deletion
      await fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.message || 'Gagal menghapus pengguna',
        life: 3000
      });
    }
  };
  showConfirmModal.value = true;
}

function confirmResetPassword(user) {
  confirmMessage.value = `Apakah Anda yakin ingin mereset password untuk pengguna ${user.username}?`;
  confirmType.value = 'warning';
  confirmCallback.value = async () => {
    try {
      const response = await api.post(`/users/${user.id}/reset-password`);
      const newPassword = response.data.password;
      closeConfirmModal();
      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: `Password berhasil direset. Password baru: ${newPassword}`,
        life: 5000
      });
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.message || 'Gagal mereset password',
        life: 3000
      });
    }
  };
  showConfirmModal.value = true;
}

function closeConfirmModal() {
  showConfirmModal.value = false;
}

// Helper functions
function formatDate(dateString) {
  if (!dateString) return 'Belum pernah';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'superadmin':
      return 'superadmin';
    case 'admin':
      return 'admin';
    default:
      return 'user';
  }
}

// Export and Print functions
function exportUsers() {
  // Implementasi export ke Excel
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Username,Nama Lengkap,Email,Peran,Status,Login Terakhir\n"
    + users.value.map(user => 
        `${user.username},${user.fullName},${user.email},${user.role},${user.isActive ? 'Aktif' : 'Nonaktif'},${formatDate(user.lastLogin)}`
      ).join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "daftar_pengguna.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.add({
    severity: 'success',
    summary: 'Berhasil',
    detail: 'Data pengguna berhasil diekspor',
    life: 3000
  });
}

function printUsers() {
  // Implementasi print
  const printContent = `
    <html>
      <head>
        <title>Daftar Pengguna</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1 { text-align: center; }
        </style>
      </head>
      <body>
        <h1>Daftar Pengguna</h1>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Nama Lengkap</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Status</th>
              <th>Login Terakhir</th>
            </tr>
          </thead>
          <tbody>
            ${users.value.map(user => `
              <tr>
                <td>${user.username}</td>
                <td>${user.fullName}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.isActive ? 'Aktif' : 'Nonaktif'}</td>
                <td>${formatDate(user.lastLogin)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
}
</script>

<style scoped>
.user-manager {
  padding: 20px;
}

.page-header {
  margin-bottom: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.page-title {
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-title i {
  font-size: 2rem;
}

.page-description {
  margin: 0;
  opacity: 0.9;
  font-size: 1.1rem;
  font-weight: 400;
}

.content-wrapper {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.table-section {
  padding: 0;
}

.section-header {
  padding: 2rem 2rem 1.5rem 2rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-bottom: 2px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.header-content h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.header-content p {
  margin: 0;
  opacity: 0.9;
  font-size: 1rem;
}

.card {
  background-color: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.card-header h2 {
  font-size: 18px;
  margin: 0;
}

.card-body {
  padding: 20px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.loading-state i,
.error-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #ccc;
}

.error-state i {
  color: #e74c3c;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background-color: #f9f9f9;
  font-weight: 600;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.sortable-header:hover {
  background-color: #e9ecef;
}

.sortable-header i {
  margin-left: 5px;
  font-size: 0.8em;
  opacity: 0.6;
}

.sortable-header:hover i {
  opacity: 1;
}

.data-table tr:hover {
  background-color: #f5f5f5;
}

.role-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.role-badge.role-superadmin {
  background: #fff3e0;
  color: #f57c00;
}

.role-badge.role-admin {
  background: #e3f2fd;
  color: #1976d2;
}

.role-badge.role-user {
  background: #f3e5f5;
  color: #7b1fa2;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background-color: #2ecc71;
  color: white;
}

.status-badge.inactive {
  background-color: #e74c3c;
  color: white;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.add-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  backdrop-filter: blur(10px);
}

.add-button:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
}

.btn {
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-sm {
  width: 32px;
  height: 32px;
  padding: 0.25rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0.875rem 1.75rem;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn-primary:hover::before {
  left: 100%;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.btn-primary i {
  font-size: 1rem;
  transition: transform 0.3s ease;
}

.btn-primary:hover i {
  transform: scale(1.1);
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover {
  background: #e0a800;
  transform: scale(1.1);
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
  transform: scale(1.1);
}

/* Modal, form, and dialog styles removed - moved to separate components */

/* Button styles moved to dialog components */

@media (max-width: 768px) {
  .page-header {
    padding: 1.5rem;
  }
  
  .page-title {
    font-size: 1.8rem;
  }
  
  .page-description {
    font-size: 1rem;
  }
  
  .section-header {
    padding: 1.5rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .section-title {
    font-size: 1.3rem;
  }
  
  .section-actions {
    width: 100%;
    justify-content: flex-start;
  }
  
  .btn-primary {
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    width: auto;
    min-width: 160px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .add-button {
    width: 100%;
    justify-content: center;
  }
  
  .action-buttons {
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .user-manager {
    padding: 1rem;
  }
  
  .page-header {
    padding: 1.25rem;
  }
  
  .section-header {
    padding: 1.25rem;
  }
  
  .btn-primary {
    width: 100%;
    justify-content: center;
  }
  
  .modal-dialog {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .modal-footer {
    padding: 1rem 1.5rem 1.5rem 1.5rem;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .radio-group-compact {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .radio-item-compact {
    flex: none;
  }
  
  .radio-label-compact {
    padding: 0.875rem 1rem;
    font-size: 0.9rem;
  }
}
</style>