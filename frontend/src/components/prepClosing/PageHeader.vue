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

<style scoped src="./PageHeader.style.css"></style>