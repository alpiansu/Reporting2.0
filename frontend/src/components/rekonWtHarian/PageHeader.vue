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
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  border-radius: 16px;
  color: var(--text-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-bottom: 2rem;
  border: 1px solid rgba(79, 70, 229, 0.1);
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0 0 0.75rem 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.page-subtitle {
  font-size: 1.125rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.page-description {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
  line-height: 1.6;
  max-width: 800px;
  opacity: 0.9;
}
</style>