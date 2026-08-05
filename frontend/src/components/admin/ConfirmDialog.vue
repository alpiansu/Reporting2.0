<template>
  <!-- Confirmation Modal -->
  <div v-if="show" class="modal-backdrop"></div>
  <div class="modal" :class="{ 'show': show }" tabindex="-1" role="dialog" v-if="show">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button type="button" class="modal-close" @click="closeModal">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="confirm-content">
            <div class="confirm-icon">
              <i :class="iconClass"></i>
            </div>
            <p class="confirm-message">{{ message }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-cancel" @click="closeModal">
            <i class="pi pi-times"></i>
            {{ cancelText }}
          </button>
          <button type="button" :class="confirmButtonClass" @click="confirm">
            <i class="pi pi-check"></i>
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Konfirmasi'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: 'Konfirmasi'
  },
  cancelText: {
    type: String,
    default: 'Batal'
  },
  type: {
    type: String,
    default: 'warning', // warning, danger, info
    validator: (value) => ['warning', 'danger', 'info'].includes(value)
  }
});

const emit = defineEmits(['close', 'confirm']);

const iconClass = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'pi pi-exclamation-triangle text-red-500';
    case 'info':
      return 'pi pi-info-circle text-blue-500';
    default:
      return 'pi pi-exclamation-triangle text-yellow-500';
  }
});

const confirmButtonClass = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'btn btn-danger';
    case 'info':
      return 'btn btn-primary';
    default:
      return 'btn btn-warning';
  }
});

function closeModal() {
  emit('close');
}

function confirm() {
  emit('confirm');
}
</script>

<style scoped src="./ConfirmDialog.style.css"></style>