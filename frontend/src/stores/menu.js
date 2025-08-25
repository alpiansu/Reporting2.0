import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { menuService } from '../services';

export const useMenuStore = defineStore('menu', () => {
  // State
  const menuCategories = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Getters
  const hasMenus = computed(() => menuCategories.value.length > 0);

  // Actions
  async function fetchMenus() {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.getMenusForCurrentUser();
      menuCategories.value = response.data || [];
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      console.error('Error fetching menus:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Admin actions
  async function fetchAllMenus() {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.getAllMenus();
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createMenu(menuData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.createMenu(menuData);
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateMenu(id, menuData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.updateMenu(id, menuData);
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteMenu(id) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.deleteMenu(id);
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    menuCategories,
    loading,
    error,
    hasMenus,
    fetchMenus,
    fetchAllMenus,
    createMenu,
    updateMenu,
    deleteMenu,
  };
});