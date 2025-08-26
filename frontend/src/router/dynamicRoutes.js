import { ref } from 'vue';
import { menuService } from '../services';

// Layouts
import MainLayout from "../layouts/MainLayout.vue";

// Menyimpan rute yang dihasilkan secara dinamis
const dynamicRoutes = ref([]);
const isLoaded = ref(false);
const error = ref(null);

/**
 * Mengubah data menu dari backend menjadi rute Vue Router
 * @param {Array} menuCategories - Kategori menu dari backend
 * @returns {Array} - Array rute yang kompatibel dengan Vue Router
 */
const transformMenuToRoutes = (menuCategories) => {
  if (!Array.isArray(menuCategories) || menuCategories.length === 0) {
    return [];
  }

  // Rute utama dengan MainLayout sebagai komponen induk
  const mainRoute = {
    path: '/',
    component: MainLayout,
    children: []
  };

  // Iterasi melalui semua kategori menu
  menuCategories.forEach(category => {
    if (Array.isArray(category.items)) {
      // Iterasi melalui semua item dalam kategori
      category.items.forEach(item => {
        if (item.path) {
          // Tentukan apakah menu memerlukan hak admin berdasarkan roles
          const requiresAdmin = Array.isArray(item.roles) && 
            item.roles.length > 0 && 
            !item.roles.includes('user') && 
            (item.roles.includes('admin') || item.roles.includes('superadmin'));

          // Buat rute untuk setiap item menu
          const route = {
            path: item.path.startsWith('/') ? item.path.substring(1) : item.path,
            name: item.id,
            // Gunakan dynamic import untuk lazy loading komponen
            component: () => {
              // Tentukan path komponen berdasarkan path menu
              const componentPath = getComponentPath(item.path);
              return import(`../views/${componentPath}.vue`);
            },
            meta: {
              requiresAuth: true,
              requiresAdmin: requiresAdmin,
              title: item.text,
              icon: item.icon,
              roles: item.roles || [],
              layout: 'main' // Menandai bahwa rute ini menggunakan MainLayout
            }
          };

          // Tambahkan rute ke children dari mainRoute
          mainRoute.children.push(route);
        }
      });
    }
  });

  return [mainRoute];
};

/**
 * Mendapatkan path komponen berdasarkan path menu
 * @param {string} menuPath - Path menu dari backend
 * @returns {string} - Path komponen untuk import
 */
const getComponentPath = (menuPath) => {
  // Hapus leading slash jika ada
  const path = menuPath.startsWith('/') ? menuPath.substring(1) : menuPath;
  
  // Pemetaan khusus untuk path tertentu
  const specialPaths = {
    'dashboard': 'dashboard/Dashboard',
    'stores': 'stores/StoreList',
    'screenings': 'screenings/ScreeningList',
    'rekon-wt-harian': 'rekonWtHarian/RekonWtHarianView',
    'sales-report': 'reports/SalesReport',
    'inventory-report': 'reports/InventoryReport',
    'profile': 'profile/Profile',
    'admin/menu-manager': 'admin/MenuManager',
    'users': 'admin/UserManager',
    'settings': 'admin/Settings'
  };

  // Gunakan pemetaan khusus jika ada
  if (specialPaths[path]) {
    return specialPaths[path];
  }
  
  // Jika tidak ada pemetaan khusus, coba konversi path ke format komponen
  // Contoh: '/admin/menu-manager' menjadi 'admin/MenuManager'
  const pathParts = path.split('/');
  if (pathParts.length > 1) {
    // Untuk path dengan struktur direktori, gunakan format direktori/Komponen
    const directory = pathParts.slice(0, -1).join('/');
    const lastPart = pathParts[pathParts.length - 1];
    // Ubah format kebab-case menjadi PascalCase untuk nama komponen
    const componentName = lastPart
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return `${directory}/${componentName}`;
  }
  
  // Untuk path tunggal, ubah format kebab-case menjadi PascalCase
  return path
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

/**
 * Memuat rute dinamis dari backend
 * @returns {Promise<Array>} - Promise yang menyelesaikan array rute
 */
const loadDynamicRoutes = async () => {
  try {
    error.value = null;
    
    // Ambil data menu dari backend
    const response = await menuService.getMenusForCurrentUser();
    const menuData = response.data || [];
    
    // Transformasi menu menjadi rute
    const routes = transformMenuToRoutes(menuData);
    dynamicRoutes.value = routes;
    
    isLoaded.value = true;
    return routes;
  } catch (err) {
    error.value = err.message || 'Failed to load dynamic routes';
    console.error('Error loading dynamic routes:', err);
    throw err;
  }
};

export {
  dynamicRoutes,
  isLoaded,
  error,
  loadDynamicRoutes,
  transformMenuToRoutes
};