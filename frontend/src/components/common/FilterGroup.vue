<template>
  <div class="filter-group">
    <label :for="id">{{ label }}</label>
    <div class="filter-input-wrapper">
      <i :class="`pi ${icon} filter-icon`"></i>
      <slot></slot>
    </div>
    <small v-if="helpText" class="help-text">{{ helpText }}</small>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  id: {
    type: String,
    default: () => `filter-${Math.random().toString(36).substring(2, 9)}`
  },
  icon: {
    type: String,
    default: 'pi-filter'
  },
  helpText: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 200px;
  flex: 1;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #333;
}

.filter-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-icon {
  position: absolute;
  left: 0.75rem;
  color: #666;
  z-index: 1;
}

.help-text {
  font-size: 0.75rem;
  color: #666;
}

:deep(.filter-control) {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 0.875rem;
  transition: all 0.3s ease;
}

:deep(.filter-control:focus) {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
}

:deep(.filter-control:disabled) {
  background-color: #f5f5f5;
  cursor: not-allowed;
}
</style>