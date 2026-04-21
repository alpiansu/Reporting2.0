<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ isEditing ? 'Edit Department' : 'Create New Department' }}</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="submit">
          <div class="form-group">
            <label for="dep_kd">Department Code *</label>
            <input 
              type="text" 
              id="dep_kd" 
              v-model="localForm.dep_kd" 
              :class="{ 'invalid': errors.dep_kd }"
              :disabled="isEditing"
              required
            >
            <div v-if="errors.dep_kd" class="error-text">{{ errors.dep_kd }}</div>
          </div>
          
          <div class="form-group">
            <label for="dep_nm">Department Name *</label>
            <input 
              type="text" 
              id="dep_nm" 
              v-model="localForm.dep_nm" 
              :class="{ 'invalid': errors.dep_nm }"
              required
            >
            <div v-if="errors.dep_nm" class="error-text">{{ errors.dep_nm }}</div>
          </div>
          
          <div class="form-group">
            <label for="div_kd">Division Code</label>
            <input 
              type="text" 
              id="div_kd" 
              v-model="localForm.div_kd" 
              :class="{ 'invalid': errors.div_kd }"
            >
          </div>
          
          <div class="form-group">
            <label for="dep_mgr">Manager</label>
            <input 
              type="text" 
              id="dep_mgr" 
              v-model="localForm.dep_mgr" 
              :class="{ 'invalid': errors.dep_mgr }"
            >
          </div>
          
          <div class="form-actions">
            <button class="btn btn-secondary" type="button" @click="$emit('close')">Cancel</button>
            <button class="btn btn-primary" type="submit" :disabled="saving">
              <i v-if="saving" class="pi pi-spin pi-spinner"></i>
              {{ isEditing ? 'Update Department' : 'Create Department' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: null
  },
  saving: {
    type: Boolean,
    default: false
  },
  errors: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close', 'save']);

const localForm = ref({
  dep_kd: '',
  dep_nm: '',
  div_kd: '',
  dep_mgr: ''
});

const isEditing = computed(() => !!props.initialData);

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.initialData) {
      localForm.value = {
        dep_kd: props.initialData.dep_kd || '',
        dep_nm: props.initialData.dep_nm || '',
        div_kd: props.initialData.div_kd || '',
        dep_mgr: props.initialData.dep_mgr || ''
      };
    } else {
      localForm.value = {
        dep_kd: '',
        dep_nm: '',
        div_kd: '',
        dep_mgr: ''
      };
    }
  }
});

const submit = () => {
  emit('save', { ...localForm.value });
};
</script>

<style scoped>
@import './MasterDeptDialog.css';
</style>
