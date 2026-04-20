import fs from 'fs/promises';
import path from 'path';

/**
 * Automatically generates a fallback Vue component if the folder/file doesn't exist.
 * This prevents routing errors dynamically after adding a new menu.
 */
export const generateVueComponentIfNeeded = async (menuPath) => {
  if (!menuPath || menuPath.startsWith('http')) return;

  // Resolve frontend views path relatively from backend root
  const frontendViewsDir = path.resolve(process.cwd(), '../frontend/src/views');

  const cleanPath = menuPath.startsWith("/") ? menuPath.substring(1) : menuPath;
  if (!cleanPath) return;

  const segments = cleanPath.split("/");

  // Convert kebab-case to camelCase
  const convertToCamelCase = (str) => {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
  };

  const folderPathStr = segments.map(convertToCamelCase).join("/");
  
  // Calculate fileName for the fallback Pattern (e.g. menu-manager -> MenuManagerView.vue)
  const lastSegment = segments[segments.length - 1];
  const words = lastSegment.split("-");
  const fileName = words.map((word, index) => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join("") + "View.vue";

  const targetFolder = path.join(frontendViewsDir, folderPathStr);
  const indexPath = path.join(targetFolder, 'index.vue');
  const fallbackPath = path.join(targetFolder, fileName);

  try {
    // Check if either file exists
    let exists = false;
    try {
      await fs.access(indexPath);
      exists = true;
    } catch (e) {
      // index.vue doesn't exist
    }

    if (!exists) {
      try {
        await fs.access(fallbackPath);
        exists = true;
      } catch (e) {
        // fallback doesn't exist
      }
    }

    if (exists) {
      console.log(`Vue component for path ${menuPath} already exists.`);
      return;
    }

    // Since neither exists, we'll create the folder and index.vue
    console.log(`Creating missing Vue component folder and index.vue for ${menuPath}`);
    await fs.mkdir(targetFolder, { recursive: true });

    const vueTemplate = `<template>
  <div class="empty-page-placeholder">
    <h1><i class="pi pi-exclamation-triangle warning-icon"></i> Halaman Sedang Dalam Pengembangan</h1>
    <p class="route-info">Menu Path: <code>{{ $route.path }}</code></p>
    <div class="dev-message">
      <p><strong>Halo Team Developer!</strong></p>
      <p>Folder dan file untuk menu ini baru saja di-generate secara otomatis karena sebelumnya tidak ditemukan.</p>
      <p>Silakan edit file berikut untuk menyesuaikan tampilan:</p>
      <code class="file-path">frontend/src/views/${folderPathStr}/index.vue</code>
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
`;

    await fs.writeFile(indexPath, vueTemplate, 'utf8');
    console.log(`Successfully created ${indexPath}`);

  } catch (error) {
    console.error(`Error while generating Vue component for ${menuPath}:`, error);
  }
};
