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
import { useAuthStore, useCabangStore } from './stores';
import Toast from 'primevue/toast';

// Import animations
import './assets/styles/animations.css';

const authStore = useAuthStore();
const cabangStore = useCabangStore();

onMounted(() => {
  // Initialize auth state
  authStore.initAuth();
  
  // Initialize cabang data
  cabangStore.fetchCabang();
});
</script>

<style>
:root {
  color-scheme: light;
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
  
  /* Global UI Variables */
  --card-bg: var(--surface-color);
  --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --input-bg: var(--surface-color);
  --input-border: var(--border-color);

  /* Semantic aliases (PrimeVue-compatible naming) mapped to app tokens */
  --surface-ground: var(--background-color);
  --surface-section: var(--background-color);
  --surface-card: var(--surface-color);
  --surface-overlay: var(--surface-color);
  --surface-border: var(--border-color);
  --surface-hover: rgba(0, 0, 0, 0.05);
  --surface-active: var(--border-color);
  --surface-mask: rgba(0, 0, 0, 0.5);
  --surface-highlight: rgba(var(--primary-color-rgb), 0.08);
  --surface-0: var(--p-surface-0);
  --surface-50: var(--p-surface-50);
  --surface-100: var(--p-surface-100);
  --surface-200: var(--p-surface-200);
  --surface-300: var(--p-surface-300);
  --surface-400: var(--p-surface-400);
  --surface-500: var(--p-surface-500);
  --surface-600: var(--p-surface-600);
  --surface-700: var(--p-surface-700);
  --surface-800: var(--p-surface-800);
  --surface-900: var(--p-surface-900);
  --surface-950: var(--p-surface-950);
  --primary-50: #eef2ff;
  --primary-100: #e0e7ff;
  --primary-200: #c7d2fe;
  --primary-300: #a5b4fc;
  --primary-400: #818cf8;
  --primary-500: #6366f1;
  --primary-600: #4f46e5;
  --primary-700: #4338ca;
  --primary-800: #3730a3;
  --primary-900: #312e81;
  --primary-950: #1e1b4b;
  --primary-contrast-color: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --background-color: #0f172a;
    --surface-color: #1e293b;
    --text-color: #f1f5f9;
    --text-color-secondary: #94a3b8;
    --border-color: #334155;
    --surface-hover: rgba(255, 255, 255, 0.08);
    --surface-highlight: rgba(var(--primary-color-rgb), 0.15);
    
    /* Overrides for common classes */
    --card-bg: #1e293b;
    --input-bg: #0f172a;
  }
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
