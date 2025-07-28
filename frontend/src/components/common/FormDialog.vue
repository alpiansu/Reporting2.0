<template>
  <div v-if="modelValue" class="dialog-overlay" @click.self="closeDialog">
    <div class="dialog-content">
      <div class="dialog-header">
        <h2>{{ title }}</h2>
        <button class="close-button" @click="closeDialog">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <div class="dialog-body">
        <slot></slot>
      </div>
      <div class="dialog-footer" v-if="showFooter">
        <button class="cancel-button" @click="closeDialog">{{ cancelText }}</button>
        <button 
          type="button"
          class="submit-button" 
          @click="submit"
          :disabled="loading || disableSubmit"
        >
          <i v-if="loading" class="pi pi-spinner pi-spin"></i>
          <span>{{ submitText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: 'Form'
  },
  submitText: {
    type: String,
    default: 'Submit'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  showFooter: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  disableSubmit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'submit']);

const closeDialog = () => {
  emit('update:modelValue', false);
};

const submit = () => {
  console.log('FormDialog: submit button clicked');
  emit('submit');
};
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background-color: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dialog-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dialog-body {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.cancel-button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cancel-button:hover {
  border-color: var(--text-color);
}

.submit-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--primary-color-darken);
}

.submit-button:disabled {
  background-color: var(--primary-color-lighten);
  cursor: not-allowed;
}
</style>