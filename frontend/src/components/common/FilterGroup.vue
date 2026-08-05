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

<style scoped src="./FilterGroup.style.css"></style>