import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores';
import { setDocumentTitle } from '../utils/title';

// Layouts
import AuthLayout from '../layouts/AuthLayout.vue';
import MainLayout from '../layouts/MainLayout.vue';

// Auth Views
import Login from '../views/auth/Login.vue';

// Dashboard Views
import Dashboard from '../views/dashboard/Dashboard.vue';

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        name: 'Login',
        component: Login,
        meta: { requiresGuest: true, title: 'Login' }
      },
      // Add other auth routes like forgot-password, reset-password, etc.
    ]
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: { requiresAuth: true, title: 'Dashboard' }
      },
      {
        path: 'stores',
        name: 'Stores',
        component: () => import('../views/stores/StoreList.vue'),
        meta: { requiresAuth: true, title: 'Stores' }
      },
      {
        path: 'stores/:id',
        name: 'StoreDetails',
        component: () => import('../views/stores/StoreDetails.vue'),
        meta: { requiresAuth: true, title: 'Store Details' }
      },
      {
        path: 'screenings',
        name: 'Screenings',
        component: () => import('../views/screenings/ScreeningList.vue'),
        meta: { requiresAuth: true, title: 'Screenings' }
      },
      {
        path: 'screenings/:id',
        name: 'ScreeningDetails',
        component: () => import('../views/screenings/ScreeningDetails.vue'),
        meta: { requiresAuth: true, title: 'Screening Details' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/profile/Profile.vue'),
        meta: { requiresAuth: true, title: 'Profile' }
      },
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
    meta: { title: 'Page Not Found' }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;
  
  // Set document title based on route meta
  if (to.meta.title) {
    setDocumentTitle(to.meta.title);
  } else if (to.name) {
    setDocumentTitle(to.name);
  }
  
  // Check if the route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  }
  // Check if the route requires guest access (like login page)
  else if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: 'Dashboard' });
  }
  else {
    next();
  }
});

export default router;