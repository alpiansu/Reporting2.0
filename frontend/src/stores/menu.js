import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { menuService } from "../services";
// import { loadDynamicRoutes } from "../router/dynamicRoutes";

export const useMenuStore = defineStore("menu", () => {
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

      // Setelah mendapatkan menu, muat rute dinamis
      // await loadDynamicRoutes();

      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      console.error("Error fetching menus:", err);
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
      menuCategories.value = response.data || [];
      return response;
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
      // Refresh menu categories after creating
      await fetchAllMenus();
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateMenu(menuData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.updateMenu(menuData.id, menuData);
      // Refresh menu categories after updating
      await fetchAllMenus();
      return response;
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
      // Refresh menu categories after deleting
      await fetchAllMenus();
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ===== CATEGORY OPERATIONS =====

  async function createCategory(categoryData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.createCategory(categoryData);
      await fetchAllMenus(); // Refresh the list
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateCategory(categoryId, categoryData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.updateCategory(categoryId, categoryData);
      await fetchAllMenus(); // Refresh the list
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteCategory(categoryId) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.deleteCategory(categoryId);
      await fetchAllMenus(); // Refresh the list
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ===== MENU ITEM OPERATIONS =====

  async function addMenuItem(categoryId, itemData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.addMenuItem(categoryId, itemData);
      await fetchAllMenus(); // Refresh the list
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateMenuItem(categoryId, itemId, itemData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.updateMenuItem(categoryId, itemId, itemData);
      await fetchAllMenus(); // Refresh the list
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteMenuItem(categoryId, itemId) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.deleteMenuItem(categoryId, itemId);
      await fetchAllMenus(); // Refresh the list
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function moveMenuItem(fromCategoryId, toCategoryId, itemId) {
    try {
      loading.value = true;
      error.value = null;
      const response = await menuService.moveMenuItem(fromCategoryId, toCategoryId, itemId);
      await fetchAllMenus(); // Refresh the list
      return response;
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
    createCategory,
    updateCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    moveMenuItem,
  };
});
