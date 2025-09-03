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
              {{ isEditing ? 'Edit Kategori Menu' : 'Tambah Kategori Menu' }}
            </h5>
            <button type="button" class="modal-close" @click="$emit('close')">
              <i class="pi pi-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <form @submit.prevent="handleSubmit">
              <div class="form-group">
                <label for="categoryName" class="form-label">Nama Kategori</label>
                <input 
                  type="text" 
                  class="form-input" 
                  id="categoryName" 
                  v-model="formData.name" 
                  required
                  placeholder="Masukkan nama kategori"
                >
              </div>
              
              <div class="form-group">
                <label for="categoryOrder" class="form-label">Urutan</label>
                <input 
                  type="number" 
                  class="form-input" 
                  id="categoryOrder" 
                  v-model="formData.order" 
                  required
                  min="0"
                  placeholder="Urutan tampilan kategori"
                >
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
  category: {
    type: Object,
    default: null
  },
  categoriesCount: {
    type: Number,
    default: 0
  }
});

// Emits
const emit = defineEmits(['close', 'save']);

// Computed
const isEditing = computed(() => props.category !== null);

// Form data
const formData = ref({
  name: '',
  order: 0
});

// Watch for category changes
watch(() => props.category, (newCategory) => {
  if (newCategory) {
    formData.value = {
      name: newCategory.name || '',
      order: newCategory.order || 0
    };
  } else {
    formData.value = {
      name: '',
      order: props.categoriesCount + 1
    };
  }
}, { immediate: true });

// Watch for show changes
watch(() => props.show, (newShow) => {
  if (newShow && !props.category) {
    formData.value = {
      name: '',
      order: props.categoriesCount + 1
    };
  }
});

// Methods
function handleSubmit() {
  if (!formData.value.name.trim()) {
    return;
  }
  
  const categoryData = {
    ...formData.value,
    name: formData.value.name.trim()
  };
  
  if (isEditing.value) {
    categoryData.id = props.category.id;
  }
  
  emit('save', categoryData);
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
  max-width: 500px;
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

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input::placeholder {
  color: #9ca3af;
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
}
</style>