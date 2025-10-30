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
      <AppSidebar 
        :menu-categories="menuCategories" 
        v-model:mobile-open="mobileOpen" 
        v-model:drawer-open="drawerOpen" 
      />

      <!-- Main Content -->
      <main class="main-content">
        <!-- Loading overlay for page navigation -->
        <loading-overlay :is-loading="isNavigating" />
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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore, useMenuStore } from '../stores';
import { useToastService } from '../utils/toast';
import ConfirmDialog from '../components/common/ConfirmDialog.vue';
import FormDialog from '../components/common/FormDialog.vue';
import ChangePasswordForm from '../components/auth/ChangePasswordForm.vue';
import AppSidebar from '../components/sidebar/AppSidebar.vue';
import LoadingOverlay from '../components/common/LoadingOverlay.vue';
import api from '../services/api';

const toast = useToastService();

const router = useRouter();
// const route = useRoute();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const mobileOpen = ref(false);
const drawerOpen = ref(true);
const userMenuOpen = ref(false);
const notificationsOpen = ref(false);

// Navigation loading state
const isNavigating = ref(false);

// Menu store
const menuStore = useMenuStore();
const menuCategories = computed(() => menuStore.menuCategories);
// const menuLoading = computed(() => menuStore.loading);

// Setup navigation loading indicator
router.beforeEach((to, from, next) => {
  isNavigating.value = true;
  next();
});

router.afterEach(() => {
  // Add a small delay to make the loading animation visible
  setTimeout(() => {
    isNavigating.value = false;
  }, 300);
});

// Fetch menus when user changes
watch(
  () => authStore.user,
  async (newUser) => {
    if (newUser) {
      try {
        await menuStore.fetchMenus();
      } catch (error) {
        console.error('Failed to fetch menus:', error);
        toast.showError('Error', 'Failed to load navigation menu');
      }
    }
  },
  { immediate: true }
);

// Menu categories are now loaded from the API via menuStore

const toggleMobileDrawer = () => {
  mobileOpen.value = !mobileOpen.value;
};

const toggleUserMenu = (event) => {
  event.stopPropagation();
  userMenuOpen.value = !userMenuOpen.value;
  if (userMenuOpen.value) {
    notificationsOpen.value = false;
  }
};

const toggleNotifications = (event) => {
  event.stopPropagation();
  notificationsOpen.value = !notificationsOpen.value;
  if (notificationsOpen.value) {
    userMenuOpen.value = false;
  }
};

// Close dropdowns when clicking outside
const handleClickOutside = (event) => {
  // Check if click is outside user menu and its dropdown
  const userMenuEl = document.querySelector('.user-menu');
  const userDropdownEl = document.querySelector('.user-dropdown');
  const notificationButtonEl = document.querySelector('.notification-button');
  const notificationsDropdownEl = document.querySelector('.notifications-dropdown');
  
  // Close user menu if click is outside
  if (userMenuOpen.value && 
      userMenuEl && 
      userDropdownEl && 
      !userMenuEl.contains(event.target) && 
      !userDropdownEl.contains(event.target)) {
    userMenuOpen.value = false;
  }
  
  // Close notifications if click is outside
  if (notificationsOpen.value && 
      notificationButtonEl && 
      notificationsDropdownEl && 
      !notificationButtonEl.contains(event.target) && 
      !notificationsDropdownEl.contains(event.target)) {
    notificationsOpen.value = false;
  }
};

// Add and remove click event listener
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

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

// isActive function moved to AppSidebar component

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