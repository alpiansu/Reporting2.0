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

<style scoped src="./LoadingOverlay.style.css"></style>