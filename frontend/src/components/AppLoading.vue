<template>
  <div class="app-loading">
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <h3>Loading Application...</h3>
      <p>Preparing your workspace</p>
    </div>
  </div>
</template>

<script setup>
// No props or logic needed for this simple loading component
</script>

<style scoped>
.app-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-container {
  text-align: center;
  color: white;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

h3 {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 600;
}

p {
  margin: 0;
  font-size: 16px;
  opacity: 0.8;
}
</style>