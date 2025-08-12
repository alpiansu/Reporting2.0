<template>
  <div class="page-header">
    <h1 class="page-title">{{ title }}</h1>
    <div class="page-subtitle" v-if="subtitle">
      {{ subtitle }}
    </div>
    <div class="page-description" v-if="description">
      {{ description }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.page-header {
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--primary-color);
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  font-size: 1rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.page-description {
  font-size: 0.875rem;
  color: #777;
  line-height: 1.5;
}
</style>