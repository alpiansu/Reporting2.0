<template>
  <div class="main-layout">
    <!-- Mobile Overlay -->
    <div class="mobile-overlay" v-if="mobileOpen" @click="toggleMobileDrawer"></div>
    <!-- App Bar -->
    <header class="app-bar">
      <div class="app-bar-left">
        <button class="menu-button" @click="toggleMobileDrawer">
          <i class="pi pi-bars"></i>
        </button>
        <div class="logo">
          <img src="/favicon.ico" alt="Logo" class="logo-image" />
          <h1 class="app-title">Reporting 2.0</h1>
        </div>
      </div>
      <div class="app-bar-right">
        <button class="notification-button" @click="toggleNotifications">
          <i class="pi pi-bell"></i>
        </button>
        <div class="user-menu" @click="toggleUserMenu">
          <div class="avatar" v-if="user">
            <span v-if="!user.profileImage">{{ user.fullName?.charAt(0) || user.username?.charAt(0) || 'U' }}</span>
            <img v-else :src="getProfileImageUrl(user.profileImage)" alt="User avatar" />
          </div>
          <span class="username">{{ user?.fullName || user?.username || 'User' }}</span>
          <i class="pi pi-chevron-down"></i>
        </div>
        <!-- User Menu Dropdown -->
        <div v-if="userMenuOpen" class="dropdown user-dropdown">
          <div class="dropdown-item" @click="navigateTo('/profile')">
            <i class="pi pi-user"></i>
            <span>Profile</span>
          </div>
          <div class="dropdown-item" @click="openChangePasswordDialog">
            <i class="pi pi-key"></i>
            <span>Change Password</span>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" @click="confirmLogout">
            <i class="pi pi-sign-out"></i>
            <span>Logout</span>
          </div>
        </div>
        <!-- Notifications Dropdown -->
        <div v-if="notificationsOpen" class="dropdown notifications-dropdown">
          <div class="dropdown-header">
            <span>Notifications</span>
            <button class="clear-all">Clear All</button>
          </div>
          <div class="dropdown-divider"></div>
          <div class="empty-notifications">
            <i class="pi pi-bell-slash"></i>
            <span>No notifications</span>
          </div>
        </div>
      </div>
    </header>

    <div class="main-container">
      <!-- Sidebar -->
      <aside class="sidebar" :class="{ 'sidebar-open': drawerOpen, 'sidebar-mobile-open': mobileOpen }">
        <nav class="sidebar-nav">
          <div v-for="(category, categoryIndex) in menuCategories" :key="categoryIndex" class="menu-category">
            <div v-if="drawerOpen" class="category-header">
              <span class="category-name">{{ category.name }}</span>
            </div>
            <router-link 
              v-for="item in category.items" 
              :key="item.path" 
              :to="item.path"
              class="nav-item"
              :class="{ 'active': isActive(item.path) }"
              @click="mobileOpen = false"
            >
              <i :class="`pi ${item.icon}`"></i>
              <span v-if="drawerOpen" class="nav-text">{{ item.text }}</span>
            </router-link>
            <div v-if="categoryIndex < menuCategories.length - 1" class="category-divider"></div>
          </div>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-divider" v-if="drawerOpen"></div>
          <button class="toggle-button" @click="handleDrawerClose" :title="drawerOpen ? 'Minimize Sidebar' : 'Expand Sidebar'">
            <i :class="`pi ${drawerOpen ? 'pi-chevron-left' : 'pi-chevron-right'}`"></i>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <page-transition name="fade" mode="out-in">
          <router-view />
        </page-transition>
      </main>
    </div>
  </div>
  
  <!-- Logout Confirmation Dialog -->
  <confirm-dialog
    v-model="showLogoutConfirm"
    title="Logout Confirmation"
    message="Are you sure you want to logout?"
    confirm-text="Logout"
    @confirm="handleLogout"
  />
  
  <!-- Change Password Dialog -->
  <form-dialog
    v-model="showChangePasswordDialog"
    title="Change Password"
    submit-text="Update Password"
    :loading="passwordLoading"
    :disable-submit="formHasErrors"
    @submit="handleDialogSubmit"
  >
    <change-password-form 
      ref="passwordFormRef" 
      @submit="submitChangePassword" 
      @validation-error="handleValidationError" 
    />
  </form-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores';
import { useToastService } from '../utils/toast';
import ConfirmDialog from '../components/common/ConfirmDialog.vue';
import FormDialog from '../components/common/FormDialog.vue';
import ChangePasswordForm from '../components/auth/ChangePasswordForm.vue';
import api from '../services/api';

const toast = useToastService();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const mobileOpen = ref(false);
const drawerOpen = ref(true);
const userMenuOpen = ref(false);
const notificationsOpen = ref(false);

const menuCategories = [
  {
    name: 'Main',
    items: [
      { text: 'Dashboard', icon: 'pi-home', path: '/dashboard' },
    ]
  },
  {
    name: 'Data Management',
    items: [
      { text: 'Stores', icon: 'pi-shopping-bag', path: '/stores' },
      { text: 'Screenings', icon: 'pi-chart-bar', path: '/screenings' },
    ]
  },
  {
    name: 'Reports',
    items: [
      { text: 'Rekonsiliasi WT Harian', icon: 'pi-sync', path: '/rekon-wt-harian' },
      { text: 'Sales Report', icon: 'pi-chart-line', path: '/sales-report' },
      { text: 'Inventory Report', icon: 'pi-box', path: '/inventory-report' },
    ]
  },
  {
    name: 'Administration',
    items: [
      { text: 'User Management', icon: 'pi-users', path: '/users' },
      { text: 'Settings', icon: 'pi-cog', path: '/settings' },
    ]
  }
];

const toggleMobileDrawer = () => {
  mobileOpen.value = !mobileOpen.value;
};

const handleDrawerClose = () => {
  drawerOpen.value = !drawerOpen.value; // Toggle sidebar state
};

const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value;
  if (userMenuOpen.value) {
    notificationsOpen.value = false;
  }
};

const toggleNotifications = () => {
  notificationsOpen.value = !notificationsOpen.value;
  if (notificationsOpen.value) {
    userMenuOpen.value = false;
  }
};

// Show logout confirmation dialog
const showLogoutConfirm = ref(false);
const confirmLogout = () => {
  userMenuOpen.value = false;
  showLogoutConfirm.value = true;
};

// Handle actual logout
const handleLogout = async () => {
  try {
    await authStore.logout();
    router.push('/login');
    toast.showSuccess('Success', 'Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect to login page even if there was an error
    router.push('/login');
  }
};

// Change password dialog
const showChangePasswordDialog = ref(false);
const passwordLoading = ref(false);
const passwordFormRef = ref(null);
const formHasErrors = ref(true); // Default to true to disable submit button initially

const openChangePasswordDialog = () => {
  userMenuOpen.value = false;
  showChangePasswordDialog.value = true;
  // Reset form when opening dialog
  if (passwordFormRef.value) {
    passwordFormRef.value.resetForm();
  }
  
  // Reset form errors state
  formHasErrors.value = true;
  
  // Wait for component to mount and then check errors
  setTimeout(() => {
    if (passwordFormRef.value) {
      formHasErrors.value = passwordFormRef.value.hasErrors();
    }
  }, 100);
};

// Handle form dialog submit button click
const handleDialogSubmit = () => {
  // Set loading state
  passwordLoading.value = true;
  
  // Manually trigger the form's submit event
  const formElement = passwordFormRef.value?.$el;
  if (formElement && formElement.tagName === 'FORM') {
    // Simulate form submission by creating and dispatching a submit event
    const submitEvent = new Event('submit', { cancelable: true });
    formElement.dispatchEvent(submitEvent);
  } else {
    // If form ref is not available, reset loading state
    passwordLoading.value = false;
    toast.showError('Error', 'Form not available');
  }
};

// Handle validation errors from the form
const handleValidationError = (errors) => {
  // Extract all error messages from the errors object
  const errorMessages = Object.values(errors).filter(msg => msg);
  
  // Update form errors state based on validation
  formHasErrors.value = errorMessages.length > 0;
  
  // If we're in loading state (form was submitted) and there are errors,
  // reset loading state without showing toast
  if (errorMessages.length > 0 && passwordLoading.value) {
    passwordLoading.value = false;
  }
};

const submitChangePassword = async (passwordData) => {
  try {
    passwordLoading.value = true;
    
    // Ensure we're sending the correct payload format
    const payload = {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    };
    
    // Call the authStore changePassword method
    await authStore.changePassword(payload);
    
    // Close the dialog and reset form
    showChangePasswordDialog.value = false;
    if (passwordFormRef.value) {
      passwordFormRef.value.resetForm();
    }
    
    // Reset form errors state
    formHasErrors.value = true; // Reset to true for next time dialog opens
    
    // Show success message with toast
    toast.showSuccess('Success', 'Password changed successfully');
  } catch (error) {
    // Handle error from backend
    console.error('Failed to change password:', error);
    
    // Check if we have field-specific validation errors from backend
    const backendErrors = error.response?.data?.errors;
    if (backendErrors && typeof backendErrors === 'object' && passwordFormRef.value) {
      // Map backend errors to form fields
      const formErrors = {};
      
      if (backendErrors.currentPassword) {
        formErrors.currentPassword = backendErrors.currentPassword;
      }
      
      if (backendErrors.newPassword) {
        formErrors.newPassword = backendErrors.newPassword;
      }
      
      // If we have field-specific errors, update the form
      if (Object.keys(formErrors).length > 0) {
        passwordFormRef.value.setErrors(formErrors);
      } else {
        // If no field-specific errors, show generic error with toast
        toast.showError('Error', error.response?.data?.message || 'Failed to change password');
      }
    } else {
      // If no structured error data, show generic error with toast
      toast.showError('Error', error.response?.data?.message || 'Failed to change password');
    }
  } finally {
    passwordLoading.value = false;
  }
};

const navigateTo = (path) => {
  router.push(path);
  userMenuOpen.value = false;
};

const isActive = (path) => {
  return route.path === path || route.path.startsWith(`${path}/`);
};

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If the image path is already a full URL, return it as is
  if (imagePath.startsWith('http')) return imagePath;
  // Get baseURL from api.js
  const baseURL = api.defaults.baseURL.replace('/api', '');
  // Otherwise, construct the URL based on your API's image serving endpoint
  return `${baseURL}${imagePath}`;
};
</script>

<style scoped>
@import './MainLayout.style.css';

/* Styles moved to MainLayout.style.css */
</style>