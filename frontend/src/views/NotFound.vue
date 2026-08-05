<template>
  <div class="not-found">
    <div class="not-found-content">
      <h1 class="error-code">404</h1>
      <h2 class="error-title">Page Not Found</h2>
      <p class="error-message">The page you are looking for doesn't exist or has been moved.</p>
      <router-link to="/dashboard" class="back-button">
        <i class="pi pi-home"></i>
        Back to Home
      </router-link>
    </div>
  </div>
</template>

<script setup>
// Not Found page component
</script>

<style scoped src="./NotFound.style.css"></style>