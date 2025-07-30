<template>
  <div class="app">
    <!-- Global page title component -->
    <page-title />
    
    <page-transition name="zoom-fade" mode="out-in" :duration="700">
      <router-view />
    </page-transition>
    
    <!-- Global Toast component -->
    <Toast position="bottom-right" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores';
import Toast from 'primevue/toast';

// Import animations
import './assets/styles/animations.css';

const authStore = useAuthStore();

onMounted(() => {
  // Initialize auth state
  authStore.initAuth();
});
</script>

<style>
:root {
  --primary-color: #4f46e5;
  --primary-color-rgb: 79, 70, 229;
  --primary-color-darken: #3730a3;
  --primary-color-lighten: #818cf8;
  --primary-light: #818cf8;
  --primary-dark: #3730a3;
  --secondary-color: #10b981;
  --secondary-light: #34d399;
  --secondary-dark: #059669;
  --background-color: #f9fafb;
  --surface-color: #ffffff;
  --text-color: #1f2937;
  --text-color-secondary: #6b7280;
  --border-color: #e5e7eb;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  --info-color: #3b82f6;
  --success-color: #10b981;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  font-size: 16px;
  color: var(--text-color);
  background-color: var(--background-color);
  height: 100%;
  width: 100%;
}

.app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* Utility Classes */
.text-center {
  text-align: center;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-center {
  justify-content: center;
}

.w-full {
  width: 100%;
}

.m-0 {
  margin: 0;
}

.p-0 {
  padding: 0;
}

.mt-4 {
  margin-top: 1rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.my-4 {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.zoom-fade-enter-active, .zoom-fade-leave-active {
  transition: opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
.zoom-fade-enter-from {
  opacity: 0;
  transform: scale(0.92);
}
.zoom-fade-enter-to {
  opacity: 1;
  transform: scale(1);
}
.zoom-fade-leave-from {
  opacity: 1;
  transform: scale(1);
}
.zoom-fade-leave-to {
  opacity: 0;
  transform: scale(1.08);
}
</style>
