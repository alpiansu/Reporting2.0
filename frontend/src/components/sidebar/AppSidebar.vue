<template>
  <aside class="sidebar" :class="{ 'sidebar-open': drawerOpen, 'sidebar-mobile-open': mobileOpen }">
    <!-- Search Bar -->
    <div class="sidebar-search" v-if="drawerOpen">
      <div class="search-input-container">
        <i class="pi pi-search search-icon"></i>
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search menu..."
          class="search-input"
        />
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
            :class="{ 'active': isActive(item.path) }"
            @click="closeMobileDrawer"
          >
            <i :class="`pi ${item.icon}`"></i>
            <span v-if="drawerOpen" class="nav-text">{{ item.text }}</span>
          </router-link>
          <div v-if="categoryIndex < filteredMenuItems.length - 1 && category.items.length > 0" class="category-divider"></div>
        </div>
      </template>
      <div v-else class="no-results">
        <i class="pi pi-search"></i>
        <span v-if="drawerOpen">No menu items found</span>
      </div>
    </nav>
    
    <div class="sidebar-footer">
      <div class="sidebar-divider" v-if="drawerOpen"></div>
      <button class="toggle-button" @click="toggleDrawer" :title="drawerOpen ? 'Minimize Sidebar' : 'Expand Sidebar'">
        <i :class="`pi ${drawerOpen ? 'pi-chevron-left' : 'pi-chevron-right'}`"></i>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

// Props
const props = defineProps({
  menuCategories: {
    type: Array,
    required: true
  },
  mobileOpen: {
    type: Boolean,
    required: true
  },
  drawerOpen: {
    type: Boolean,
    required: true
  }
});

// Emits
const emit = defineEmits(['update:mobileOpen', 'update:drawerOpen']);

// Router
const router = useRouter();
const route = useRoute();

// Search functionality
const searchQuery = ref('');

// Filter menu items based on search query
const filteredMenuItems = computed(() => {
  if (!searchQuery.value) {
    return props.menuCategories;
  }
  
  const query = searchQuery.value.toLowerCase();
  
  return props.menuCategories.map(category => {
    // Filter items in each category
    const filteredItems = category.items.filter(item => 
      item.text.toLowerCase().includes(query) ||
      (item.keywords && item.keywords.some(keyword => 
        keyword.toLowerCase().includes(query)
      ))
    );
    
    // Return a new category object with filtered items
    return {
      ...category,
      items: filteredItems
    };
  });
});

// Clear search
const clearSearch = () => {
  searchQuery.value = '';
};

// Check if route is active
const isActive = (path) => {
  return route.path === path || route.path.startsWith(`${path}/`);
};

// Toggle drawer
const toggleDrawer = () => {
  emit('update:drawerOpen', !props.drawerOpen);
};

// Close mobile drawer
const closeMobileDrawer = () => {
  emit('update:mobileOpen', false);
};
</script>

<style scoped>
@import './AppSidebar.style.css';
</style>