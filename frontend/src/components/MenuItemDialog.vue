<template>
  <div>
    <!-- Modal Backdrop -->
    <div v-if="show" class="modal-backdrop" @click="$emit('close')"></div>
    
    <!-- Modal -->
    <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ isEditing ? 'Edit Menu Item' : 'Tambah Menu Item' }}
            </h5>
            <button type="button" class="modal-close" @click="$emit('close')">
              <i class="pi pi-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <form @submit.prevent="handleSubmit">
              <div class="form-group">
                <label for="menuCategory" class="form-label">Kategori</label>
                <select class="form-select" id="menuCategory" v-model="formData.categoryId" required>
                  <option value="" disabled>Pilih kategori</option>
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="menuText" class="form-label">Nama Menu</label>
                <input 
                  type="text" 
                  class="form-input" 
                  id="menuText" 
                  v-model="formData.text" 
                  required
                  placeholder="Masukkan nama menu"
                >
              </div>
              
              <div class="form-group">
                <label for="menuIcon" class="form-label">Icon (PrimeIcons)</label>
                <input 
                  type="text" 
                  class="form-input" 
                  id="menuIcon" 
                  v-model="formData.icon" 
                  placeholder="pi-home, pi-user, pi-cog, dll."
                >
                <small class="form-help">Gunakan nama icon dari PrimeIcons (tanpa prefix 'pi ')</small>
              </div>
              
              <div class="form-group">
                <label for="menuPath" class="form-label">Path</label>
                <input 
                  type="text" 
                  class="form-input" 
                  id="menuPath" 
                  v-model="formData.path" 
                  required
                  placeholder="/dashboard, /users, /settings"
                >
              </div>
              
              <div class="form-group">
                <label class="form-label">Peran yang Diizinkan</label>
                <div class="checkbox-group">
                  <div class="checkbox-item">
                    <input 
                      type="checkbox" 
                      id="roleAdmin" 
                      value="admin" 
                      v-model="formData.roles"
                    >
                    <label for="roleAdmin" class="checkbox-label">
                      <span class="checkbox-custom"></span>
                      Admin
                    </label>
                  </div>
                  <div class="checkbox-item">
                    <input 
                      type="checkbox" 
                      id="roleUser" 
                      value="user" 
                      v-model="formData.roles"
                    >
                    <label for="roleUser" class="checkbox-label">
                      <span class="checkbox-custom"></span>
                      User
                    </label>
                  </div>
                  <div class="checkbox-item">
                    <input 
                      type="checkbox" 
                      id="roleSuperAdmin" 
                      value="superadmin" 
                      v-model="formData.roles"
                    >
                    <label for="roleSuperAdmin" class="checkbox-label">
                      <span class="checkbox-custom"></span>
                      Super Admin
                    </label>
                  </div>
                </div>
              </div>
              
              <div class="form-group">
                <label for="menuKeywords" class="form-label">Keywords</label>
                <input 
                  type="text" 
                  class="form-input" 
                  id="menuKeywords" 
                  v-model="formData.keywordsInput" 
                  placeholder="dashboard, home, beranda (dipisahkan dengan koma)"
                >
                <small class="form-help">Keywords untuk pencarian menu (opsional)</small>
              </div>
            </form>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-cancel" @click="$emit('close')">
              <i class="pi pi-times"></i>
              Batal
            </button>
            <button type="button" class="btn btn-submit" @click="handleSubmit">
              <i class="pi pi-check"></i>
              {{ isEditing ? 'Perbarui' : 'Simpan' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  menuItem: {
    type: Object,
    default: null
  },
  category: {
    type: Object,
    default: null
  },
  categories: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['close', 'save']);

// Computed
const isEditing = computed(() => props.menuItem !== null);

// Form data
const formData = ref({
  categoryId: null,
  text: '',
  icon: '',
  path: '',
  roles: ['admin'],
  keywordsInput: ''
});

// Watch for menuItem changes
watch(() => props.menuItem, (newMenuItem) => {
  if (newMenuItem) {
    formData.value = {
      categoryId: props.category?.id || null,
      text: newMenuItem.text || '',
      icon: newMenuItem.icon || '',
      path: newMenuItem.path || '',
      roles: [...(newMenuItem.roles || ['admin'])],
      keywordsInput: (newMenuItem.keywords || []).join(', ')
    };
  } else {
    resetForm();
  }
}, { immediate: true });

// Watch for category changes (when adding to specific category)
watch(() => props.category, (newCategory) => {
  if (newCategory && !props.menuItem) {
    formData.value.categoryId = newCategory.id;
  }
}, { immediate: true });

// Watch for show changes
watch(() => props.show, (newShow) => {
  if (newShow && !props.menuItem) {
    resetForm();
    if (props.category) {
      formData.value.categoryId = props.category.id;
    } else if (props.categories.length > 0) {
      formData.value.categoryId = props.categories[0].id;
    }
  }
});

// Methods
function resetForm() {
  formData.value = {
    categoryId: props.category?.id || (props.categories.length > 0 ? props.categories[0].id : null),
    text: '',
    icon: '',
    path: '',
    roles: ['admin'],
    keywordsInput: ''
  };
}

function handleSubmit() {
  if (!formData.value.text.trim() || !formData.value.path.trim() || !formData.value.categoryId) {
    return;
  }
  
  const keywords = formData.value.keywordsInput
    .split(',')
    .map(keyword => keyword.trim())
    .filter(keyword => keyword !== '');
  
  const menuItemData = {
    categoryId: formData.value.categoryId,
    text: formData.value.text.trim(),
    icon: formData.value.icon.trim(),
    path: formData.value.path.trim(),
    roles: [...formData.value.roles],
    keywords: keywords
  };
  
  if (isEditing.value) {
    menuItemData.id = props.menuItem.id;
  }
  
  emit('save', menuItemData);
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
  opacity: 0;
  animation: fadeIn 0.3s ease forwards;
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
  transform: scale(0.9);
  transition: all 0.3s ease;
}

.modal.show {
  opacity: 1;
  transform: scale(1);
}

.modal-dialog {
  width: 100%;
  max-width: 600px;
  margin: 1rem;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.modal-body {
  padding: 2rem;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: #f8f9fa;
  flex-shrink: 0;
  margin-top: auto;
}

/* Form Styles */
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input::placeholder {
  color: #9ca3af;
}

.form-help {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
}

/* Checkbox Styles */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
}

.checkbox-item input[type="checkbox"] {
  display: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
  user-select: none;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  margin-right: 0.75rem;
  position: relative;
  transition: all 0.2s ease;
  background: white;
}

.checkbox-item input[type="checkbox"]:checked + .checkbox-label .checkbox-custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
}

.checkbox-item input[type="checkbox"]:checked + .checkbox-label .checkbox-custom::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 6px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label:hover .checkbox-custom {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Button Styles */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn:hover::before {
  left: 100%;
}

.btn-cancel {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
}

.btn-submit {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.btn:active {
  transform: translateY(0);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .checkbox-group {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .modal-dialog {
    margin: 0.5rem;
    max-width: calc(100% - 1rem);
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
  
  .checkbox-group {
    gap: 0.5rem;
  }
}
</style>