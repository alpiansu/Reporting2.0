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

<style scoped src="./ConfirmDialog.style.css"></style>
