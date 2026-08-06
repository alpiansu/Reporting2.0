<template>
  <aside class="sidebar" :class="{ 'sidebar-open': drawerOpen, 'sidebar-mobile-open': mobileOpen }">
    <!-- Search Bar -->
    <div class="sidebar-search" v-if="drawerOpen">
      <div class="search-input-container">
        <i class="pi pi-search search-icon"></i>
        <input type="text" v-model="searchQuery" placeholder="Search menu..." class="search-input" />
        <i v-if="searchQuery" @click="clearSearch" class="pi pi-times clear-icon"></i>
      </div>
    </div>

    <nav class="sidebar-nav">
      <template v-if="filteredMenuItems.length > 0">
        <div v-for="(category, categoryIndex) in filteredMenuItems" :key="categoryIndex" class="menu-category">
          <div v-if="drawerOpen && category.items.length > 0" class="category-header">
            <span class="category-name">{{ category.name }}</span>
          </div>
          <router-link
            v-for="item in category.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @click="closeMobileDrawer"
          >
            <i :class="`pi ${item.icon}`"></i>
            <span v-if="drawerOpen" class="nav-text">{{ item.text }}</span>
          </router-link>
          <div
            v-if="categoryIndex < filteredMenuItems.length - 1 && category.items.length > 0"
            class="category-divider"
          ></div>
        </div>
      </template>
      <div v-else class="no-results">
        <i class="pi pi-search"></i>
        <span v-if="drawerOpen">No menu items found</span>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-divider" v-if="drawerOpen"></div>
      <button
        class="version-badge"
        :class="{ 'version-warning': isVersionMismatch }"
        :title="versionBadgeTitle"
        @click="aboutOpen = true"
      >
        <i class="pi pi-info-circle version-badge-icon"></i>
        <span v-if="drawerOpen" class="version-badge-text">v{{ frontendVersion }}</span>
        <i v-if="isVersionMismatch && drawerOpen" class="pi pi-exclamation-triangle version-warning-icon"></i>
      </button>
      <button class="toggle-button" @click="toggleDrawer" :title="drawerOpen ? 'Minimize Sidebar' : 'Expand Sidebar'">
        <i :class="`pi ${drawerOpen ? 'pi-chevron-left' : 'pi-chevron-right'}`"></i>
      </button>
    </div>
  </aside>

  <!-- Tentang Aplikasi -->
  <base-modal-detail
    :show="aboutOpen"
    title="Tentang Aplikasi"
    icon="pi pi-info-circle"
    size="sm"
    :show-default-footer="true"
    close-button-text="Tutup"
    @close="aboutOpen = false"
  >
    <template #content>
      <div class="about-content">
        <div class="about-item" v-for="(item, idx) in aboutItems" :key="idx">
          <span class="about-label">{{ item.label }}</span>
          <span class="about-value" :class="item.valueClass">{{ item.value }}</span>
        </div>
        <div v-if="isVersionMismatch" class="about-mismatch">
          <i class="pi pi-exclamation-triangle"></i>
          <span>Backend belum diperbarui (v{{ backendVersion || "?" }} ≠ v{{ frontendVersion }}).</span>
        </div>
      </div>
    </template>
  </base-modal-detail>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import BaseModalDetail from "../common/BaseModalDetail.vue";
import { healthService } from "../../services";

// Versi frontend di-inject saat build oleh vite.config.ts (dari package.json)
const frontendVersion = healthService.normalizeVersion(import.meta.env.VITE_APP_VERSION) || "dev";

// Props
const props = defineProps({
  menuCategories: {
    type: Array,
    required: true,
  },
  mobileOpen: {
    type: Boolean,
    required: true,
  },
  drawerOpen: {
    type: Boolean,
    required: true,
  },
});

// ─── Versi aplikasi & health check ────────────────────────────────
const aboutOpen = ref(false);
const backendVersion = ref(null);
const dbConnected = ref(null);
const uptime = ref(null);
const healthError = ref(false);

const isVersionMismatch = computed(() => {
  return backendVersion.value && backendVersion.value !== frontendVersion;
});

const versionBadgeTitle = computed(() => {
  if (isVersionMismatch.value) {
    return `Backend belum diperbarui (v${backendVersion.value} ≠ v${frontendVersion}) — klik untuk detail`;
  }
  return `Reporting 2.0 — v${frontendVersion} — klik untuk detail`;
});

const formatUptime = seconds => {
  if (seconds === null || seconds === undefined) return "—";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60); // <--- Tambahan perhitungan detik

  if (h > 0) return `${h}j ${m}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
};

const aboutItems = computed(() => {
  return [
    { label: "Frontend version", value: `v${frontendVersion}` },
    {
      label: "Backend version",
      value: backendVersion.value ? `v${backendVersion.value}` : healthError.value ? "Tidak diketahui" : "Memuat...",
    },
    {
      label: "Status database",
      value: dbConnected.value === null ? "—" : dbConnected.value ? "Terkoneksi" : "Terputus",
      valueClass: dbConnected.value === false ? "about-value-error" : "about-value-success",
    },
    { label: "Uptime server", value: formatUptime(uptime.value) },
  ];
});

const loadHealth = async () => {
  const data = await healthService.getHealth();
  if (data) {
    healthError.value = false;
    backendVersion.value = healthService.normalizeVersion(data.version);
    dbConnected.value = data.db?.connected ?? null;
    uptime.value = data.uptime ?? null;
  } else {
    healthError.value = true;
  }
};

onMounted(loadHealth);

// Re-fetch saat dialog dibuka — memungkinkan pemulihan data health
// tanpa perlu reload halaman (misal backend sempat tidak terjangkau saat mount).
watch(aboutOpen, open => {
  if (open) loadHealth();
});

// Emits
const emit = defineEmits(["update:mobileOpen", "update:drawerOpen"]);

// Router
const router = useRouter();
const route = useRoute();

// Search functionality
const searchQuery = ref("");

// Filter menu items based on search query
const filteredMenuItems = computed(() => {
  if (!searchQuery.value) {
    return props.menuCategories;
  }

  const query = searchQuery.value.toLowerCase();

  return props.menuCategories.map(category => {
    // Filter items in each category
    const filteredItems = category.items.filter(
      item =>
        item.text.toLowerCase().includes(query) ||
        (item.keywords && item.keywords.some(keyword => keyword.toLowerCase().includes(query))),
    );

    // Return a new category object with filtered items
    return {
      ...category,
      items: filteredItems,
    };
  });
});

// Clear search
const clearSearch = () => {
  searchQuery.value = "";
};

// Check if route is active
const isActive = path => {
  return route.path === path || route.path.startsWith(`${path}/`);
};

// Toggle drawer
const toggleDrawer = () => {
  emit("update:drawerOpen", !props.drawerOpen);
};

// Close mobile drawer
const closeMobileDrawer = () => {
  emit("update:mobileOpen", false);
};
</script>

<style scoped>
@import "./AppSidebar.style.css";
</style>
