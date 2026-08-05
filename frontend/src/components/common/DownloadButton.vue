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

<style scoped src="./DownloadButton.style.css"></style>