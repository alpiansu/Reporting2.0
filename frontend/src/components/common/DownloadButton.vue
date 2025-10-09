<template>
  <button 
    :class="buttonClasses"
    @click="handleDownload"
    :disabled="isDownloading"
    :title="tooltip"
  >
    <i :class="iconClasses"></i>
    <span class="button-text">{{ displayText }}</span>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue';

// Props
const props = defineProps({
  variant: {
    type: String,
    default: 'secondary',
    validator: value => ['primary', 'secondary', 'outline', 'success', 'info'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: value => ['small', 'medium', 'large'].includes(value)
  },
  text: {
    type: String,
    default: 'Download'
  },
  loadingText: {
    type: String,
    default: 'Downloading...'
  },
  icon: {
    type: String,
    default: 'pi-download'
  },
  loadingIcon: {
    type: String,
    default: 'pi-spin pi-spinner'
  },
  tooltip: {
    type: String,
    default: 'Download file'
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['download']);

// State
const isDownloading = ref(false);

// Computed
const buttonClasses = computed(() => [
  'download-button',
  `download-button--${props.variant}`,
  `download-button--${props.size}`,
  {
    'download-button--loading': isDownloading.value,
    'download-button--disabled': props.disabled || isDownloading.value
  }
]);

const iconClasses = computed(() => [
  'pi',
  isDownloading.value ? props.loadingIcon : props.icon,
  'download-button__icon'
]);

const displayText = computed(() => 
  isDownloading.value ? props.loadingText : props.text
);

// Methods
const handleDownload = async () => {
  if (props.disabled || isDownloading.value) return;
  
  try {
    isDownloading.value = true;
    await emit('download');
  } catch (error) {
    console.error('Download error:', error);
  } finally {
    isDownloading.value = false;
  }
};
</script>

<style scoped>
.download-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  border-radius: 0.5rem;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  border: none;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.download-button:hover:not(.download-button--disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.download-button:active:not(.download-button--disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.download-button--disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* Size variants */
.download-button--small {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.download-button--medium {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  line-height: 1.5;
}

.download-button--large {
  padding: 0.75rem 1.5rem;
  font-size: 1.125rem;
  line-height: 1.6;
}

/* Color variants */
.download-button--primary {
  color: #fff;
  background-color: var(--primary-color, #0ea5e9);
  box-shadow: 0 2px 4px rgba(14, 165, 233, 0.3);
}

.download-button--primary:hover:not(.download-button--disabled) {
  background-color: var(--primary-color-darken, #0284c7);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
}

.download-button--secondary {
  color: #fff;
  background-color: #6c757d;
  box-shadow: 0 2px 4px rgba(108, 117, 125, 0.3);
}

.download-button--secondary:hover:not(.download-button--disabled) {
  background-color: #5a6268;
}

.download-button--outline {
  color: var(--primary-color, #0ea5e9);
  background-color: transparent;
  border: 1px solid var(--primary-color, #0ea5e9);
  box-shadow: none;
}

.download-button--outline:hover:not(.download-button--disabled) {
  color: #fff;
  background-color: var(--primary-color, #0ea5e9);
}

.download-button--success {
  color: #fff;
  background-color: #28a745;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.download-button--success:hover:not(.download-button--disabled) {
  background-color: #218838;
}

.download-button--info {
  color: #fff;
  background-color: #17a2b8;
  box-shadow: 0 2px 4px rgba(23, 162, 184, 0.3);
}

.download-button--info:hover:not(.download-button--disabled) {
  background-color: #138496;
}

.download-button__icon {
  font-size: 1em;
}

.button-text {
  white-space: nowrap;
}

/* Loading state animation */
.download-button--loading .download-button__icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Focus styles for accessibility */
.download-button:focus {
  outline: 2px solid var(--primary-color, #0ea5e9);
  outline-offset: 2px;
}

.download-button:focus:not(:focus-visible) {
  outline: none;
}
</style>