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

<style scoped src="./CategoryDialog.style.css"></style>