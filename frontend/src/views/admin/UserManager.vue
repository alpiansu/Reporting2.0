<template>
  <div class="user-manager">
    <div class="page-header">
      <h1>User Manager</h1>
      <p>Kelola pengguna aplikasi dan atur hak akses</p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Daftar Pengguna</h2>
        <button class="add-button" @click="showAddUserModal = true">
          <i class="pi pi-plus"></i> Tambah Pengguna Baru
        </button>
      </div>

      <div class="card-body">
        <div v-if="userStore.loading" class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <p>Memuat data pengguna...</p>
        </div>

        <div v-else-if="userStore.error" class="error-state">
          <i class="pi pi-exclamation-triangle"></i> {{ userStore.error }}
        </div>

        <div v-else-if="!userStore.hasUsers" class="empty-state">
          <i class="pi pi-info-circle"></i>
          <p>Belum ada pengguna yang tersedia</p>
          <button class="add-button" @click="showAddUserModal = true">
            <i class="pi pi-plus"></i> Tambah Pengguna Baru
          </button>
        </div>

        <div v-else>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Nama Lengkap</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Login Terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in userStore.users" :key="user.id">
                  <td>{{ user.username }}</td>
                  <td>{{ user.fullName || '-' }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span class="role-badge" :class="getRoleBadgeClass(user.role)">
                      {{ user.role }}
                    </span>
                  </td>
                  <td>
                    <span class="status-badge" :class="{ 'active': user.isActive, 'inactive': !user.isActive }">
                      {{ user.isActive ? 'Aktif' : 'Nonaktif' }}
                    </span>
                  </td>
                  <td>{{ formatDate(user.lastLogin) }}</td>
                  <td>
                    <div class="action-buttons">
                      <button class="edit-button" @click="editUser(user)" title="Edit Pengguna">
                        <i class="pi pi-pencil"></i>
                      </button>
                      <button class="reset-button" @click="confirmResetPassword(user)" title="Reset Password">
                        <i class="pi pi-key"></i>
                      </button>
                      <button class="delete-button" @click="confirmDeleteUser(user)" title="Hapus Pengguna">
                        <i class="pi pi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for adding/editing user -->
    <div v-if="showUserModal" class="modal-backdrop"></div>
    <div class="modal" :class="{ 'show': showUserModal }" tabindex="-1" role="dialog" v-if="showUserModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru' }}</h5>
            <button type="button" class="modal-close" @click="closeUserModal">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveUser">
              <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" class="form-input" v-model="userForm.username" required :disabled="isEditingUser">
              </div>
              
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" class="form-input" v-model="userForm.email" required>
              </div>
              
              <div class="form-group">
                <label for="fullName">Nama Lengkap</label>
                <input type="text" id="fullName" class="form-input" v-model="userForm.fullName">
              </div>
              
              <div class="form-group" v-if="!isEditingUser">
                <label for="password">Password</label>
                <input type="password" id="password" class="form-input" v-model="userForm.password" :required="!isEditingUser">
              </div>
              
              <div class="form-group">
                <label for="role">Peran</label>
                <select id="role" class="form-select" v-model="userForm.role" required>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              
              <div class="form-group">
                <div class="checkbox-group">
                  <div class="checkbox-item">
                    <input type="checkbox" id="isActive" v-model="userForm.isActive">
                    <label for="isActive">Aktif</label>
                  </div>
                </div>
              </div>
              
              <div class="modal-footer">
                <button type="button" class="cancel-button" @click="closeUserModal">Batal</button>
                <button type="submit" class="submit-button">{{ isEditingUser ? 'Simpan' : 'Tambah' }}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="modal-backdrop"></div>
    <div class="modal" :class="{ 'show': showConfirmModal }" tabindex="-1" role="dialog" v-if="showConfirmModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Konfirmasi</h5>
            <button type="button" class="modal-close" @click="closeConfirmModal">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <p>{{ confirmMessage }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="cancel-button" @click="closeConfirmModal">Batal</button>
            <button type="button" class="delete-button" @click="confirmCallback()">Konfirmasi</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../../stores';

const userStore = useUserStore();

// User form state
const showUserModal = ref(false);
const isEditingUser = ref(false);
const userForm = ref({
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'user',
  isActive: true
});

// Confirmation modal state
const showConfirmModal = ref(false);
const confirmMessage = ref('');
const confirmCallback = ref(() => {});

// Fetch users on component mount
onMounted(async () => {
  try {
    await userStore.fetchUsers();
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
});

// User form methods
function addUser() {
  isEditingUser.value = false;
  userForm.value = {
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'user',
    isActive: true
  };
  showUserModal.value = true;
}

function editUser(user) {
  isEditingUser.value = true;
  userForm.value = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName || '',
    role: user.role,
    isActive: user.isActive
  };
  showUserModal.value = true;
}

async function saveUser() {
  try {
    if (isEditingUser.value) {
      await userStore.updateUser(userForm.value.id, userForm.value);
    } else {
      await userStore.createUser(userForm.value);
    }
    closeUserModal();
  } catch (error) {
    console.error('Failed to save user:', error);
  }
}

function closeUserModal() {
  showUserModal.value = false;
}

// Confirmation modal methods
function confirmDeleteUser(user) {
  confirmMessage.value = `Apakah Anda yakin ingin menghapus pengguna ${user.username}?`;
  confirmCallback.value = async () => {
    try {
      await userStore.deleteUser(user.id);
      closeConfirmModal();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };
  showConfirmModal.value = true;
}

function confirmResetPassword(user) {
  confirmMessage.value = `Apakah Anda yakin ingin mereset password untuk pengguna ${user.username}?`;
  confirmCallback.value = async () => {
    try {
      await userStore.resetPassword(user.id);
      closeConfirmModal();
    } catch (error) {
      console.error('Failed to reset password:', error);
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
</script>

<style scoped>
.user-manager {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.page-header p {
  color: #666;
  margin: 0;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
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

.role-badge.superadmin {
  background-color: #9b59b6;
  color: white;
}

.role-badge.admin {
  background-color: #3498db;
  color: white;
}

.role-badge.user {
  background-color: #7f8c8d;
  color: white;
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
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-button:hover {
  background-color: #27ae60;
}

.edit-button,
.reset-button,
.delete-button {
  background-color: transparent;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.edit-button {
  color: #3498db;
}

.reset-button {
  color: #f39c12;
}

.delete-button {
  color: #e74c3c;
}

.edit-button:hover {
  background-color: rgba(52, 152, 219, 0.1);
}

.reset-button:hover {
  background-color: rgba(243, 156, 18, 0.1);
}

.delete-button:hover {
  background-color: rgba(231, 76, 60, 0.1);
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
}

.modal.show {
  opacity: 1;
  visibility: visible;
}

.modal-dialog {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-content {
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.modal-close:hover {
  background-color: #f5f5f5;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

/* Form styles */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.form-input:focus,
.form-select:focus {
  border-color: #3498db;
  outline: none;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.checkbox-group {
  margin-top: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.checkbox-item input[type="checkbox"] {
  margin-right: 8px;
}

.checkbox-item label {
  margin-bottom: 0;
  cursor: pointer;
}

.submit-button {
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
}

.submit-button:hover {
  background-color: #2980b9;
}

.cancel-button {
  background-color: #f5f5f5;
  color: #333;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}

@media (max-width: 768px) {
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
</style>