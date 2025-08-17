<template>
  <div v-if="isLoading" class="loading-overlay">
    <div class="loading-spinner">
      <div class="spinner"></div>
      <div class="loading-text">Loading...</div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(var(--primary-color-rgb, 25, 118, 210), 0.2);
  border-radius: 50%;
  border-top-color: var(--primary-color, #1976d2);
  animation: spin 1s ease-in-out infinite;
}

.loading-text {
  margin-top: 10px;
  color: var(--primary-color, #1976d2);
  font-weight: 600;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>