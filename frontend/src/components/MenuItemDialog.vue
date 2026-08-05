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
                  <option v-for="category in availableCategories" :key="category.id" :value="category.id">
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

// Computed untuk memastikan categories selalu reactive
const availableCategories = computed(() => props.categories || []);

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
    } else if (availableCategories.value.length > 0) {
      formData.value.categoryId = availableCategories.value[0].id;
    }
  }
});

// Watch for categories changes to update form if needed
watch(() => availableCategories.value, (newCategories) => {
  if (newCategories.length > 0 && !formData.value.categoryId && !props.menuItem) {
    formData.value.categoryId = newCategories[0].id;
  }
}, { immediate: true });

// Methods
function resetForm() {
  formData.value = {
    categoryId: props.category?.id || (availableCategories.value.length > 0 ? availableCategories.value[0].id : null),
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

<style scoped src="./MenuItemDialog.style.css"></style>