import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore, useCabangStore } from "../stores";
import { ref } from "vue";
import api from "../services/api";

// Flag untuk tracking apakah routes dinamis sudah dimuat
const isLoaded = ref(false);

// Layouts
import AuthLayout from "../layouts/AuthLayout.vue";
import MainLayout from "../layouts/MainLayout.vue";
import AppLoading from "../components/AppLoading.vue";

// Auth Views
import Login from "../views/auth/Login.vue";

// Dashboard Views
import Dashboard from "../views/dashboard/Dashboard.vue";

// Rute statis yang selalu ada, terlepas dari konfigurasi menu
// Hanya menyimpan rute yang tidak ada di menus.json seperti login, register, dan halaman error

const staticRoutes = [
  {
    path: "/",
    redirect: "/loading",
  },
  {
    path: "/loading",
    name: "AppLoading",
    component: AppLoading,
    meta: { requiresAuth: true, title: "Loading" },
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
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("../views/NotFound.vue"),
    meta: { title: "Page Not Found" },
  },
];

// MainLayout route akan ditambahkan secara dinamis setelah routes dimuat
let mainLayoutRoute = null;

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

// Fungsi untuk memuat dan menambahkan rute dinamis
const addDynamicRoutes = async () => {
  if (isLoaded.value) return true;

  try {
    console.log("Loading dynamic routes from backend...");

    // Ambil data menu dari backend
    const response = await api.get("/menu-manager/user/current");
    const menuData = response.data?.data || [];

    console.log("Menu data received:", menuData);

    // Extract semua items dari menu groups
    const allMenuItems = [];
    menuData.forEach(group => {
      if (Array.isArray(group.items)) {
        allMenuItems.push(...group.items);
      }
    });

    // console.log("All menu items:", allMenuItems);

    // Buat children routes untuk MainLayout
    const mainLayoutChildren = [
      // Dashboard route yang harus ada secara statis
      {
        path: "dashboard",
        name: "Dashboard",
        component: Dashboard,
        meta: {
          requiresAuth: true,
          title: "Dashboard",
          layout: "main",
          roles: ["admin", "manager", "user", "superadmin"],
        },
      },
      // Rute detail yang tidak ada di menus.json
      {
        path: "profile",
        name: "Profile",
        component: () => import("../views/profile/Profile.vue"),
        meta: {
          requiresAuth: true,
          title: "Profile",
          layout: "main",
          roles: ["admin", "manager", "user", "superadmin"],
        },
      },
    ];

    // Tambahkan routes untuk setiap menu item
    allMenuItems.forEach(item => {
      if (item.path && item.path !== "/dashboard") {
        // Skip dashboard karena sudah ada
        const routeName = item.text.replace(/\s+/g, "");
        const component = getComponent(item.path);

        const route = {
          path: item.path.replace(/^\/|\/$/, ""), // strip leading & trailing slash
          name: routeName,
          component: component,
          meta: {
            requiresAuth: true,
            title: item.text,
            layout: "main",
            roles: item.roles || ["admin", "user", "superadmin"],
          },
        };

        console.log("Adding route:", route);
        mainLayoutChildren.push(route);
      }
    });

    // Buat MainLayout route dengan semua children
    mainLayoutRoute = {
      path: "/",
      component: MainLayout,
      children: mainLayoutChildren,
    };

    // Tambahkan MainLayout route ke router
    router.addRoute(mainLayoutRoute);

    // Update redirect dari root ke dashboard
    router.removeRoute("AppLoading"); // Remove loading route
    router.addRoute({
      path: "/",
      redirect: "/dashboard",
    });

    isLoaded.value = true;
    console.log("Dynamic routes loaded successfully");
    return true;
  } catch (error) {
    console.error("Failed to load dynamic routes:", error);
    return false;
  }
};

/**
 * Helper function to dynamically load components based on path
 * Convention: /path-name -> views/pathName/index.vue
 * Falls back to views/pathName/PathNameView.vue if index.vue doesn't exist
 *
 * Examples:
 * - /stores -> views/stores/index.vue
 * - /adjust -> views/adjust/index.vue
 * - /prep-closing -> views/prepClosing/index.vue
 * - /admin/menu-manager -> views/admin/menuManager/index.vue
 */
const getComponent = path => {
  // Remove leading and trailing slashes
  const cleanPath = path.replace(/^\/|\/$/, "");

  // Split path into segments (e.g., "admin/menu-manager" -> ["admin", "menu-manager"])
  const segments = cleanPath.split("/").filter(Boolean); // filter(Boolean) removes empty strings

  // Convert kebab-case to camelCase for folder names
  // e.g., "menu-manager" -> "menuManager", "prep-closing" -> "prepClosing"
  const convertToCamelCase = str => {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
  };

  // Build the folder path
  const folderPath = segments.map(convertToCamelCase).join("/");

  // Try to import index.vue first
  return () =>
    import(`../views/${folderPath}/index.vue`).catch(() => {
      // If index.vue doesn't exist, try with the last segment as filename
      const fileName =
        segments[segments.length - 1]
          .split("-")
          .map((word, index) =>
            index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)
          )
          .join("") + "View";

      return import(`../views/${folderPath}/${fileName}.vue`).catch(() => {
        // Final fallback: NotFound
        console.error(`Component not found for path: ${path}. Tried:
              - ../views/${folderPath}/index.vue
              - ../views/${folderPath}/${fileName}.vue`);
        return import("../views/NotFound.vue");
      });
    });
};

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
    // Jika user sudah login dan routes belum dimuat, arahkan ke loading
    if (!isLoaded.value) {
      next({ name: "AppLoading" });
      return;
    }
    next({ name: "Dashboard" });
    return;
  }

  // Jika user terautentikasi dan routes belum dimuat
  if (isAuthenticated && !isLoaded.value) {
    // Jika sedang menuju loading page, izinkan
    if (to.name === "AppLoading") {
      // Mulai proses loading routes di background
      setTimeout(async () => {
        try {
          // Muat data cabang terlebih dahulu
          if (!cabangStore.isInitialized) {
            await cabangStore.fetchCabang();
          }

          // Kemudian muat routes dinamis
          await addDynamicRoutes();

          // Setelah selesai, arahkan ke dashboard
          router.push({ name: "Dashboard" });
        } catch (error) {
          console.error("Failed to load application data:", error);
          // Jika gagal, tetap arahkan ke dashboard dengan routes minimal
          router.push({ name: "Dashboard" });
        }
      }, 1000); // Delay 1 detik untuk UX yang lebih baik

      next();
      return;
    }

    // Jika mencoba akses route lain sebelum loading selesai, arahkan ke loading
    next({ name: "AppLoading" });
    return;
  }

  // Check if the route requires admin role
  if (to.meta.requiresAdmin && (!authStore.user || authStore.user.role !== "admin")) {
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

  next();
});

export default router;
