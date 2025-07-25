<template>
  <div class="not-found">
    <div class="not-found-content">
      <h1 class="error-code">404</h1>
      <h2 class="error-title">Page Not Found</h2>
      <p class="error-message">The page you are looking for doesn't exist or has been moved.</p>
      <router-link to="/" class="back-button">
        <i class="pi pi-home"></i>
        Back to Home
      </router-link>
    </div>
  </div>
</template>

<script setup>
// Not Found page component
</script>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20px;
}

.not-found-content {
  text-align: center;
  max-width: 500px;
  padding: 40px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.error-code {
  font-size: 6rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-color-lighten));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
}

.error-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 16px 0;
  color: var(--text-color);
}

.error-message {
  font-size: 1rem;
  color: var(--text-color-secondary);
  margin-bottom: 32px;
}

.back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
}

.back-button:hover {
  background-color: var(--primary-color-darken);
}

.back-button i {
  font-size: 1.125rem;
}
</style>