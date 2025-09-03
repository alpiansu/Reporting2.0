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
  max-width: 400px;
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
}

.modal-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  padding: 2rem 1.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* Confirm Content Styles */
.confirm-content {
  text-align: center;
}

.confirm-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: pulse 2s infinite;
}

.confirm-message {
  font-size: 1rem;
  color: #374151;
  line-height: 1.6;
  margin: 0;
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

.btn-cancel {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
}

.btn-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
}

.btn-warning:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

.btn:active {
  transform: translateY(0);
}

/* Text Colors */
.text-red-500 {
  color: #ef4444;
}

.text-yellow-500 {
  color: #f59e0b;
}

.text-blue-500 {
  color: #3b82f6;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Responsive Design */
@media (max-width: 480px) {
  .modal-dialog {
    width: 95%;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .confirm-icon {
    font-size: 2.5rem;
  }
}
</style>