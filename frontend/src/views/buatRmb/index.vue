<template>
  <div class="empty-page-placeholder">
    <h1><i class="pi pi-exclamation-triangle warning-icon"></i> Halaman Sedang Dalam Pengembangan</h1>
    <p class="route-info">Menu Path: <code>{{ $route.path }}</code></p>
    <div class="dev-message">
      <p><strong>Halo Team Developer!</strong></p>
      <p>Folder dan file untuk menu ini baru saja di-generate secara otomatis karena sebelumnya tidak ditemukan.</p>
      <p>Silakan edit file berikut untuk menyesuaikan tampilan:</p>
      <code class="file-path">frontend/src/views/buatRmb/index.vue</code>
    </div>
  </div>
</template>

<script setup>
// Default Vue component created automatically by Menu Manager
</script>

<style scoped src="./index.css" />
