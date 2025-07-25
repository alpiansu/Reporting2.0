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
            {{ user.fullName?.charAt(0) || user.username?.charAt(0) || 'U' }}
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
        <div class="sidebar-header">
          <button class="toggle-button" @click="handleDrawerClose">
            <i :class="`pi ${drawerOpen ? 'pi-chevron-left' : 'pi-chevron-right'}`"></i>
          </button>
        </div>
        <div class="sidebar-divider" v-if="drawerOpen"></div>
        <nav class="sidebar-nav">
          <router-link 
            v-for="item in menuItems" 
            :key="item.path" 
            :to="item.path"
            class="nav-item"
            :class="{ 'active': isActive(item.path) }"
            @click="mobileOpen = false"
          >
            <i :class="`pi ${item.icon}`"></i>
            <span v-if="drawerOpen">{{ item.text }}</span>
          </router-link>
        </nav>
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
    @submit="submitChangePassword"
  >
    <change-password-form ref="passwordFormRef" @submit="submitChangePassword" />
  </form-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores';
import ConfirmDialog from '../components/common/ConfirmDialog.vue';
import FormDialog from '../components/common/FormDialog.vue';
import ChangePasswordForm from '../components/auth/ChangePasswordForm.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const mobileOpen = ref(false);
const drawerOpen = ref(true);
const userMenuOpen = ref(false);
const notificationsOpen = ref(false);

const menuItems = [
  { text: 'Dashboard', icon: 'pi-home', path: '/dashboard' },
  { text: 'Stores', icon: 'pi-shopping-bag', path: '/stores' },
  { text: 'Screenings', icon: 'pi-chart-bar', path: '/screenings' },
];

const toggleMobileDrawer = () => {
  mobileOpen.value = !mobileOpen.value;
};

const handleDrawerClose = () => {
  drawerOpen.value = !drawerOpen.value; // Toggle instead of just closing
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
const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

// Change password dialog
const showChangePasswordDialog = ref(false);
const passwordLoading = ref(false);
const passwordFormRef = ref(null);

const openChangePasswordDialog = () => {
  userMenuOpen.value = false;
  showChangePasswordDialog.value = true;
  // Reset form when opening dialog
  if (passwordFormRef.value) {
    passwordFormRef.value.resetForm();
  }
};

const submitChangePassword = async (passwordData) => {
  try {
    passwordLoading.value = true;
    await authStore.changePassword(passwordData);
    showChangePasswordDialog.value = false;
    // Show success message or notification here
    alert('Password changed successfully');
  } catch (error) {
    // Handle error
    console.error('Failed to change password:', error);
    alert(error.response?.data?.message || 'Failed to change password');
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
</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: 0 16px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 10;
}

.app-bar-left, .app-bar-right {
  display: flex;
  align-items: center;
}

.menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  margin-right: 16px;
}

.menu-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.logo {
  display: flex;
  align-items: center;
}

.logo-image {
  height: 32px;
  margin-right: 12px;
}

.app-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-color-lighten));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.notification-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  margin-right: 16px;
}

.notification-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.user-menu {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 24px;
}

.user-menu:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-right: 8px;
}

.username {
  margin-right: 8px;
  font-weight: 500;
}

.dropdown {
  position: absolute;
  top: 64px;
  right: 16px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
}

.dropdown-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dropdown-item i {
  margin-right: 12px;
  color: var(--text-color-secondary);
}

.dropdown-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.08);
  margin: 8px 0;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
}

.clear-all {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.875rem;
}

.empty-notifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  color: var(--text-color-secondary);
}

.empty-notifications i {
  font-size: 24px;
  margin-bottom: 8px;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background-color: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 5;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px;
  height: 64px;
}

.toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.toggle-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.sidebar-user {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  margin: 0 16px;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 600;
  line-height: 1.2;
}

.user-role {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.sidebar-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.08);
  margin: 16px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 4px;
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  position: relative;
}

.nav-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.nav-item.active {
  background-color: rgba(var(--primary-color-rgb), 0.08);
  color: var(--primary-color);
}

.nav-item.active:hover {
  background-color: rgba(var(--primary-color-rgb), 0.12);
}

.nav-item i {
  margin-right: 16px;
  font-size: 1.25rem;
  min-width: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.nav-item span {
  transition: opacity 0.3s ease, transform 0.3s ease;
  display: inline-block;
}

.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background-color: #f5f5f5;
}

/* Mobile Overlay */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 4;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 64px;
    left: 0;
    height: calc(100vh - 64px);
    transform: translateX(-100%);
    width: 260px !important;
    z-index: 10;
  }

  .sidebar-mobile-open {
    transform: translateX(0);
  }
  
  .app-bar {
    padding: 0 8px;
    z-index: 5;
  }
  
  .main-content {
    padding: 16px;
  }
}

/* Small screens */
@media (max-width: 480px) {
  .app-title {
    font-size: 1rem;
  }
  
  .logo-image {
    height: 24px;
  }
  
  .username {
    display: none;
  }
  
  .main-content {
    padding: 12px;
  }
  
  .sidebar {
    width: 240px !important;
  }
  
  .nav-item {
    padding: 10px 12px;
  }
  
  .nav-item i {
    font-size: 1.1rem;
  }
}

/* Desktop Responsive */
@media (min-width: 769px) {
  .menu-button {
    display: none;
  }

  .sidebar {
    position: relative;
    transform: none !important;
    transition: width 0.3s ease;
  }

  .sidebar.sidebar-open {
    width: 260px;
  }
  
  .sidebar:not(.sidebar-open) {
    width: 64px;
  }

  .sidebar:not(.sidebar-open) .nav-item {
    justify-content: center;
    padding: 12px;
  }

  .sidebar:not(.sidebar-open) .nav-item i {
    margin-right: 0;
    font-size: 1.5rem;
    transform: scale(1.1);
  }
  
  .sidebar:not(.sidebar-open) .toggle-button {
    transform: rotate(180deg);
  }
  
  .sidebar:not(.sidebar-open) .nav-item span {
    opacity: 0;
    transform: translateX(-10px);
  }
}
</style>