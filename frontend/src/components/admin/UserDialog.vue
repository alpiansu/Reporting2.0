<template>
  <!-- Modal for adding/editing user -->
  <div v-if="show" class="modal-backdrop"></div>
  <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ isEditing ? 'Edit Pengguna' : 'Tambah Pengguna Baru' }}</h5>
          <button type="button" class="modal-close" @click="closeModal">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveUser">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" class="form-input" v-model="form.username" required :disabled="isEditing">
            </div>
            
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" class="form-input" v-model="form.email" required>
            </div>
            
            <div class="form-group">
              <label for="fullName">Nama Lengkap</label>
              <input type="text" id="fullName" class="form-input" v-model="form.fullName">
            </div>
            
            <div class="form-group" v-if="!isEditing">
              <label for="password">Password</label>
              <input type="password" id="password" class="form-input" v-model="form.password" :required="!isEditing">
            </div>
            
            <div class="form-group">
              <label class="form-label">Peran</label>
              <div class="radio-group-compact">
                <div class="radio-item-compact">
                  <input type="radio" id="role-user" value="user" v-model="form.role" required>
                  <label for="role-user" class="radio-label-compact">
                    <span class="radio-indicator-compact"></span>
                    <i class="pi pi-user"></i>
                    User
                  </label>
                </div>
                <div class="radio-item-compact">
                  <input type="radio" id="role-admin" value="admin" v-model="form.role" required>
                  <label for="role-admin" class="radio-label-compact">
                    <span class="radio-indicator-compact"></span>
                    <i class="pi pi-shield"></i>
                    Admin
                  </label>
                </div>
                <div class="radio-item-compact">
                  <input type="radio" id="role-superadmin" value="superadmin" v-model="form.role" required>
                  <label for="role-superadmin" class="radio-label-compact">
                    <span class="radio-indicator-compact"></span>
                    <i class="pi pi-crown"></i>
                    Superadmin
                  </label>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <div class="checkbox-group">
                <div class="checkbox-item">
                  <input type="checkbox" id="isActive" v-model="form.isActive">
                  <label for="isActive">Aktif</label>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-cancel" @click="closeModal">
                <i class="pi pi-times"></i>
                Batal
              </button>
              <button type="submit" class="btn btn-submit">
                <i class="pi pi-check"></i>
                {{ isEditing ? 'Simpan Perubahan' : 'Tambah Pengguna' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  },
  isEditing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'save']);

const form = ref({
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'user',
  isActive: true
});

// Watch for user prop changes to populate form
watch(() => props.user, (newUser) => {
  if (newUser) {
    form.value = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName || '',
      role: newUser.role,
      isActive: newUser.isActive
    };
  } else {
    // Reset form for new user
    form.value = {
      username: '',
      email: '',
      fullName: '',
      password: '',
      role: 'user',
      isActive: true
    };
  }
}, { immediate: true });

function closeModal() {
  emit('close');
}

function saveUser() {
  emit('save', { ...form.value });
}
</script>

<style scoped>
/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1040;
  animation: fadeIn 0.3s ease-out;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease-out;
}

.modal.show {
  opacity: 1;
  visibility: visible;
}

.modal-dialog {
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  transform: scale(0.8) translateY(-50px);
  transition: transform 0.3s ease-out;
}

.modal.show .modal-dialog {
  transform: scale(1) translateY(0);
}

.modal-content {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
}

.modal-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.modal-footer {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
  margin-top: auto;
}

/* Form Styles */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  background: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

/* Radio Button Styles - Compact */
.radio-group-compact {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.radio-item-compact {
  position: relative;
}

.radio-item-compact input[type="radio"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.radio-label-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.85rem;
  font-weight: 500;
  color: #374151;
  min-width: 100px;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.radio-label-compact:hover {
  border-color: #667eea;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.radio-item-compact input[type="radio"]:checked + .radio-label-compact {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.radio-item-compact input[type="radio"]:checked + .radio-label-compact::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: shimmer 0.6s ease-out;
}

.radio-indicator-compact {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.radio-item-compact input[type="radio"]:checked + .radio-label-compact .radio-indicator-compact::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: radioCheck 0.2s ease-out forwards;
}

/* Checkbox Styles */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #667eea;
}

.checkbox-item label {
  margin: 0;
  cursor: pointer;
  font-weight: 500;
}

/* Button Styles */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.btn-submit {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
}

.btn-submit:active {
  transform: translateY(0);
}

.btn-cancel {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
}

.btn-cancel:active {
  transform: translateY(0);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

@keyframes radioCheck {
  0% { transform: translate(-50%, -50%) scale(0); }
  100% { transform: translate(-50%, -50%) scale(1); }
}

/* Responsive Design */
@media (max-width: 480px) {
  .modal-dialog {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .radio-group-compact {
    flex-direction: column;
  }
  
  .radio-label-compact {
    justify-content: flex-start;
    min-width: auto;
  }
}
</style>