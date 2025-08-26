import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore, useCabangStore } from "../stores";

// Layouts
import AuthLayout from "../layouts/AuthLayout.vue";
import MainLayout from "../layouts/MainLayout.vue";

// Auth Views
import Login from "../views/auth/Login.vue";

// Dashboard Views
import Dashboard from "../views/dashboard/Dashboard.vue";

const routes = [
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/",
    component: AuthLayout,
    children: [
      {
        path: "login",
        name: "Login",
        component: Login,
        meta: { requiresGuest: true, title: "Login" },
      },
      // Add other auth routes like forgot-password, reset-password, etc.
    ],
  },
  {
    path: "/",
    component: MainLayout,
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: Dashboard,
        meta: { requiresAuth: true, title: "Dashboard" },
      },
      {
        path: "stores",
        name: "Stores",
        component: () => import("../views/stores/StoreList.vue"),
        meta: { requiresAuth: true, title: "Stores" },
      },
      {
        path: "stores/:id",
        name: "StoreDetails",
        component: () => import("../views/stores/StoreDetails.vue"),
        meta: { requiresAuth: true, title: "Store Details" },
      },
      {
        path: "screenings",
        name: "Screenings",
        component: () => import("../views/screenings/ScreeningList.vue"),
        meta: { requiresAuth: true, title: "Screenings" },
      },
      {
        path: "screenings/:id",
        name: "ScreeningDetails",
        component: () => import("../views/screenings/ScreeningDetails.vue"),
        meta: { requiresAuth: true, title: "Screening Details" },
      },
      {
        path: "rekon-wt-harian",
        name: "RekonWtHarian",
        component: () => import("../views/rekonWtHarian/RekonWtHarianView.vue"),
        meta: { requiresAuth: true, title: "Rekonsiliasi WT Harian" },
      },
      {
        path: "profile",
        name: "Profile",
        component: () => import("../views/profile/Profile.vue"),
        meta: { requiresAuth: true, title: "Profile" },
      },
      {
        path: "admin/menu-manager",
        name: "MenuManager",
        component: () => import("../views/admin/MenuManager.vue"),
        meta: { requiresAuth: true, requiresAdmin: true, title: "Menu Manager" },
      },
      {
        path: "admin/user-manager",
        name: "UserManager",
        component: () => import("../views/admin/UserManager.vue"),
        meta: { requiresAuth: true, requiresAdmin: true, title: "User Manager" },
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("../views/NotFound.vue"),
    meta: { title: "Page Not Found" },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const cabangStore = useCabangStore();
  const isAuthenticated = authStore.isAuthenticated;

  // Check if the route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: "Login", query: { redirect: to.fullPath } });
    return;
  }
  // Check if the route requires guest access (like login page)
  else if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: "Dashboard" });
    return;
  }
  
  // Check if the route requires admin role
  if (to.meta.requiresAdmin && (!authStore.user || authStore.user.role !== 'admin')) {
    next({ name: "Dashboard" });
    return;
  }
  
  // Jika user terautentikasi, pastikan data cabang sudah dimuat
  if (isAuthenticated && !cabangStore.isInitialized) {
    try {
      // Tunggu sampai data cabang dimuat
      await cabangStore.fetchCabang();
    } catch (error) {
      console.error("Failed to load cabang data:", error);
      // Lanjutkan navigasi meskipun gagal memuat data cabang
    }
  }
  
  next();
});

export default router;
