import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore, useCabangStore, useMenuStore } from "../stores";
import { dynamicRoutes, loadDynamicRoutes, isLoaded } from "./dynamicRoutes";

// Layouts
import AuthLayout from "../layouts/AuthLayout.vue";
import MainLayout from "../layouts/MainLayout.vue";

// Auth Views
import Login from "../views/auth/Login.vue";

// Dashboard Views
import Dashboard from "../views/dashboard/Dashboard.vue";

// Rute statis yang selalu ada, terlepas dari konfigurasi menu
// Hanya menyimpan rute yang tidak ada di menus.json seperti login, register, dan halaman error

const staticRoutes = [
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
      // Rute detail yang tidak ada di menus.json
      {
        path: "stores/:id",
        name: "StoreDetails",
        component: () => import("../views/stores/StoreDetails.vue"),
        meta: { requiresAuth: true, title: "Store Details" },
      },
      {
        path: "screenings/:id",
        name: "ScreeningDetails",
        component: () => import("../views/screenings/ScreeningDetails.vue"),
        meta: { requiresAuth: true, title: "Screening Details" },
      },
      {
        path: "profile",
        name: "Profile",
        component: () => import("../views/profile/Profile.vue"),
        meta: { requiresAuth: true, title: "Profile" },
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

// Gabungkan rute statis dengan rute dinamis
const routes = [...staticRoutes];

// Buat router dengan rute statis awal
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

// Fungsi untuk menambahkan rute dinamis ke router
const addDynamicRoutes = async () => {
  // Hanya muat rute dinamis jika belum dimuat
  if (!isLoaded.value) {
    try {
      // Muat rute dinamis dari backend
      const dynamicRoutesArray = await loadDynamicRoutes();
      
      // Tambahkan rute dinamis ke router
      dynamicRoutesArray.forEach(route => {
        if (!router.hasRoute(route.name)) {
          router.addRoute(route);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to load dynamic routes:', error);
      return false;
    }
  }
  
  return true;
};

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const cabangStore = useCabangStore();
  const menuStore = useMenuStore();
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
  
  // Check if the route has roles restriction from menus.json
  if (to.meta.roles && Array.isArray(to.meta.roles) && to.meta.roles.length > 0) {
    const userRole = authStore.user?.role;
    // If user doesn't have a role or their role is not in the allowed roles list
    if (!userRole || !to.meta.roles.includes(userRole)) {
      next({ name: "Dashboard" });
      return;
    }
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
  
  // Jika user terautentikasi, pastikan rute dinamis sudah dimuat
  if (isAuthenticated && !isLoaded.value) {
    try {
      // Muat menu dari store jika belum ada
      if (!menuStore.hasMenus) {
        await menuStore.fetchMenus();
      }
      
      // Tambahkan rute dinamis ke router
      await addDynamicRoutes();
      
      // Jika rute yang diminta tidak ditemukan setelah menambahkan rute dinamis,
      // coba navigasi ulang ke rute yang sama
      if (!router.hasRoute(to.name) && to.name !== 'NotFound') {
        next({ path: to.fullPath, replace: true });
        return;
      }
    } catch (error) {
      console.error("Failed to load dynamic routes:", error);
      // Lanjutkan navigasi meskipun gagal memuat rute dinamis
    }
  }
  
  next();
});

export default router;
