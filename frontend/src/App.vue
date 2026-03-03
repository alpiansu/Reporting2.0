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
}

@media (prefers-color-scheme: dark) {
  :root {
    --background-color: #0f172a;
    --surface-color: #1e293b;
    --text-color: #f1f5f9;
    --text-color-secondary: #94a3b8;
    --border-color: #334155;
    
    /* Overrides for common classes */
    --card-bg: #1e293b;
    --input-bg: #0f172a;
  }
}

/* Global Dark Mode Helper Overrides */
@media (prefers-color-scheme: dark) {
  .card, 
  [class*="card"],
  .rekon-persediaan-table-container,
  .controls-section {
    background-color: var(--surface-color) !important;
    border-color: var(--border-color) !important;
    color: var(--text-color) !important;
  }

  .page-header h1,
  .page-title,
  .header-title-content h1,
  .stat-value,
  .dialog-title {
    color: var(--text-color) !important;
  }

  .page-header p,
  .stat-label,
  .detail-label,
  .update-text {
    color: var(--text-color-secondary) !important;
  }

  input, select, textarea, .form-input, .p-inputtext {
    background-color: var(--background-color) !important;
    color: var(--text-color) !important;
    border-color: var(--border-color) !important;
  }

  /* Specific fix for transparency/glassmorphism patterns */
  [style*="background: rgba(255, 255, 255"],
  [style*="background-color: rgba(255, 255, 255"] {
    background-color: rgba(30, 41, 59, 0.7) !important;
    backdrop-filter: blur(10px);
  }

  /* Specific Layout Overrides */
  .app-bar, .dropdown, .user-dropdown, .notifications-dropdown {
    background-color: var(--surface-color) !important;
    border-color: var(--border-color) !important;
    color: var(--text-color) !important;
  }

  .username, .dropdown-item span, .dropdown-header span {
    color: var(--text-color) !important;
  }

  .menu-button:hover, 
  .notification-button:hover, 
  .user-menu:hover,
  .dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.05) !important;
    color: var(--primary-color) !important;
  }

  .dropdown-divider {
    background-color: var(--border-color) !important;
  }

  /* Force sidebar to match dark theme if needed */
  .sidebar {
    background-color: #0f172a !important; /* Slightly darker than surface */
    border-right: 1px solid var(--border-color) !important;
  }

  /* PrimeVue specific global fixes */
  .p-dialog, .p-confirm-dialog, .p-toast, .dialog-content {
    background-color: var(--surface-color) !important;
    color: var(--text-color) !important;
    border-color: var(--border-color) !important;
  }

  /* Profile & Specialized Card Patterns */
  .profile-card, .security-card, .activity-card, .detail-item, .activity-item, .two-factor-toggle, .backup-codes {
    background-color: var(--surface-color) !important;
    color: var(--text-color) !important;
    border-color: var(--border-color) !important;
  }

  .profile-details {
    background-color: var(--background-color) !important;
  }

  .profile-avatar {
    border-color: var(--surface-color) !important;
  }

  .dialog-header, .profile-header, .card-title {
    border-bottom: 1px solid var(--border-color) !important;
  }

  .setup-button, .upload-button, .remove-button, .cancel-button, .download-codes-button, .code-item {
    background-color: var(--surface-color) !important;
    border-color: var(--border-color) !important;
    color: var(--text-color) !important;
  }

  .slider {
    background-color: #334155 !important;
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
