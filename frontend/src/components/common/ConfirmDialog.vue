<template>
  <transition name="fade-scale">
    <div v-if="modelValue" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog-content">
        <div class="dialog-header">
          <i class="pi pi-question-circle dialog-icon" />
          <h2 class="dialog-title">{{ title }}</h2>
          <button class="close-button" @click="closeDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="dialog-body">
          <p class="dialog-message">{{ message }}</p>
        </div>

        <div class="dialog-footer">
          <Button :label="cancelText" @click="closeDialog" severity="secondary" size="small"
            class="dialog-btn cancel-btn" icon="pi pi-times" raised />
          <Button :label="confirmText" @click="confirm" severity="info" size="small" class="dialog-btn confirm-btn"
            icon="pi pi-check" autofocus raised />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";
import Button from "primevue/button";

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: "Confirmation" },
  message: { type: String, default: "Are you sure you want to proceed?" },
  confirmText: { type: String, default: "Confirm" },
  cancelText: { type: String, default: "Cancel" },
});

const emit = defineEmits(["update:modelValue", "confirm"]);

const closeDialog = () => emit("update:modelValue", false);

const confirm = () => {
  emit("confirm");
  closeDialog();
};
</script>

<style scoped>
/* === Overlay Background === */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

/* === Dialog Container === */
.dialog-content {
  background: #fff;
  border-radius: 10px;
  min-width: 340px;
  max-width: 420px;
  padding: 1.25rem 1.5rem 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  animation: popIn 0.25s ease;
}

/* === Header === */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  position: relative;
}

.dialog-title {
  flex: 1;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin-left: 0.5rem;
}

.dialog-icon {
  font-size: 1.6rem;
  color: #2196f3;
}

.close-button {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #777;
  font-size: 1.1rem;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: #000;
}

/* === Body === */
.dialog-body {
  margin: 0.5rem 0 1rem;
  color: #555;
  line-height: 1.5;
  text-align: center;
}

.dialog-message {
  margin: 0;
  font-size: 0.95rem;
}

/* === Footer === */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.dialog-btn {
  transition: transform 0.15s ease;
}

.dialog-btn:hover {
  transform: scale(1.04);
}

/* === Animations === */
@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.25s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
