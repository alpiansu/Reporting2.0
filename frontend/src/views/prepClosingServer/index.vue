<template>
  <div class="empty-page-placeholder">
    <h1><i class="pi pi-exclamation-triangle warning-icon"></i> Halaman Sedang Dalam Pengembangan</h1>
    <p class="route-info">Menu Path: <code>{{ $route.path }}</code></p>
    <div class="dev-message">
      <p><strong>Halo Team Developer!</strong></p>
      <p>Folder dan file untuk menu ini baru saja di-generate secara otomatis karena sebelumnya tidak ditemukan.</p>
      <p>Silakan edit file berikut untuk menyesuaikan tampilan:</p>
      <code class="file-path">frontend/src/views/prepClosingServer/index.vue</code>
    </div>
  </div>
</template>

<script setup>
// Default Vue component created automatically by Menu Manager
</script>

<style scoped>
.empty-page-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  background-color: #f8f9fa;
  border-radius: 12px;
  border: 2px dashed #ced4da;
  padding: 3rem 2rem;
  margin: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.empty-page-placeholder h1 {
  font-size: 1.75rem;
  color: #495057;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.warning-icon {
  color: #f59f00;
  font-size: 2rem;
}

.route-info {
  font-size: 1.1rem;
  color: #6c757d;
  margin-bottom: 2rem;
}

.route-info code {
  background-color: #e9ecef;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: #d63384;
}

.dev-message {
  background-color: #e7f5ff;
  border-left: 4px solid #339af0;
  padding: 1.5rem;
  border-radius: 4px;
  text-align: left;
  max-width: 600px;
}

.dev-message p {
  margin-bottom: 0.5rem;
  color: #1c7ed6;
}

.file-path {
  display: block;
  background-color: #343a40;
  color: #69db7c;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-top: 1rem;
  font-family: monospace;
}
</style>
