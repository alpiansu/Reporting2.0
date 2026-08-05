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

<style scoped src="./FormDialog.style.css"></style>