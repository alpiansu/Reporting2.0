import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '../services';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Getters
  const isAuthenticated = computed(() => !!user.value);

  // Actions
  async function initAuth() {
    try {
      loading.value = true;
      // Check if user is already logged in
      if (authService.isAuthenticated()) {
        // Get user from localStorage
        const userData = authService.getCurrentUser();
        user.value = userData;

        // Verify token validity by fetching profile
        try {
          const profileData = await authService.getProfile();
          // Backend mengembalikan data user langsung di response
          user.value = profileData;
        } catch {
          // If token is invalid, logout
          authService.logout();
          user.value = null;
        }
      }
    } catch (err) {
      error.value = err.message;
      authService.logout();
    } finally {
      loading.value = false;
    }
  }

  async function login(credentials) {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.login(credentials);
      // Backend mengembalikan user langsung di response.data, bukan di response.data.data.user
      user.value = response.user;
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function register(userData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.register(userData);
      // Backend mengembalikan user langsung di response.data, bukan di response.data.data.user
      user.value = response.user;
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    authService.logout();
    user.value = null;
  }

  async function updateProfile() {
    try {
      loading.value = true;
      const response = await authService.getProfile();
      // Backend mengembalikan data user langsung di response.data
      user.value = response;
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function changePassword(passwordData) {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.changePassword(passwordData);
      return response;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    initAuth,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  };
});