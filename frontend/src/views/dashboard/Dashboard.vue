<template>
  <div class="dashboard fade-in">

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">
          <i class="pi pi-user"></i>
          {{ username }}
          <span class="separator">·</span>
          <i class="pi pi-calendar"></i>
          {{ currentDate }}
        </p>
      </div>
      <Button
        icon="pi pi-refresh"
        label="Refresh"
        outlined
        severity="secondary"
        size="small"
        @click="fetchData"
        :loading="loading"
      />
    </div>

    <!-- Info Strip -->
    <div class="info-strip">
      <!-- Total Stores -->
      <div class="info-card">
        <div class="info-icon icon-blue">
          <i class="pi pi-shopping-bag"></i>
        </div>
        <div class="info-body">
          <div v-if="loading"><Skeleton width="3rem" height="1.6rem" /></div>
          <div v-else class="info-value">{{ stats.totalStores ?? 0 }}</div>
          <div class="info-label">Total Toko</div>
        </div>
      </div>

      <!-- Database Connection -->
      <div class="info-card">
        <div class="info-icon" :class="stats.dbConnected ? 'icon-green' : 'icon-red'">
          <i class="pi pi-database"></i>
        </div>
        <div class="info-body">
          <div v-if="loading"><Skeleton width="6rem" height="1.6rem" /></div>
          <template v-else>
            <div class="info-value db-value">
              <span class="status-dot" :class="stats.dbConnected ? 'dot-green' : 'dot-red'"></span>
              {{ stats.dbConnected ? 'Connected' : 'Disconnected' }}
            </div>
            <div class="info-label">
              Database
              <span class="db-ip-badge">{{ stats.dbHost || 'N/A' }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Last Sync -->
      <div class="info-card">
        <div class="info-icon icon-orange">
          <i class="pi pi-sync"></i>
        </div>
        <div class="info-body">
          <div v-if="loading"><Skeleton width="7rem" height="1.6rem" /></div>
          <div v-else class="info-value info-value--sm">{{ formatDateTime(stats.lastSync) }}</div>
          <div class="info-label">Last Sync</div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="dashboard-main">

      <!-- Page Navigator -->
      <div class="panel page-navigator">
        <div class="panel-header">
          <span class="panel-title">
            <i class="pi pi-th-large"></i>
            Navigasi Halaman
          </span>
        </div>

        <div v-if="menuLoading" class="nav-grid">
          <Skeleton v-for="i in 8" :key="i" height="4.5rem" border-radius="10px" />
        </div>

        <template v-else>
          <div v-if="menuCategories.length === 0" class="empty-state">
            <i class="pi pi-info-circle"></i>
            <p>Tidak ada halaman yang tersedia.</p>
          </div>

          <div v-for="group in menuCategories" :key="group.id || group.label" class="nav-group">
            <div class="nav-group-label">{{ group.label }}</div>
            <div class="nav-grid">
              <div
                v-for="item in group.items"
                :key="item.path"
                class="nav-card"
                @click="$router.push(item.path)"
              >
                <div class="nav-card-icon">
                  <i :class="['pi', item.icon || 'pi-file']"></i>
                </div>
                <div class="nav-card-body">
                  <div class="nav-card-title">{{ item.text }}</div>
                  <div class="nav-card-desc">{{ getPageDesc(item.path) }}</div>
                </div>
                <i class="pi pi-chevron-right nav-card-arrow"></i>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Recent Activity -->
      <div class="panel activity-panel">
        <div class="panel-header">
          <span class="panel-title">
            <i class="pi pi-history"></i>
            Aktivitas Terkini
          </span>
          <button class="view-all-btn" @click="$router.push('/user-activities')">
            Lihat Semua <i class="pi pi-arrow-right"></i>
          </button>
        </div>

        <!-- Skeleton -->
        <div v-if="loading" class="activity-list">
          <div v-for="i in 6" :key="i" class="activity-row">
            <Skeleton shape="circle" size="2.25rem" class="flex-shrink-0" />
            <div class="activity-info" style="flex:1">
              <Skeleton width="65%" height="0.875rem" class="mb-1" />
              <Skeleton width="80%" height="0.75rem" />
            </div>
            <div style="text-align:right">
              <Skeleton width="3rem" height="1.2rem" border-radius="999px" class="mb-1" />
              <Skeleton width="2.5rem" height="0.7rem" />
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="recentActivities.length === 0" class="empty-state">
          <i class="pi pi-inbox"></i>
          <p>Belum ada aktivitas</p>
        </div>

        <!-- Activity Feed -->
        <div v-else class="activity-list">
          <div
            v-for="activity in recentActivities"
            :key="activity.id || activity.createdAt"
            class="activity-row"
          >
            <div class="activity-avatar" :class="getAvatarClass(activity.type)">
              {{ getInitials(activity.user?.fullName || 'S') }}
            </div>
            <div class="activity-info">
              <div class="activity-user">{{ activity.user?.fullName || 'System' }}</div>
              <div class="activity-desc">{{ activity.description }}</div>
            </div>
            <div class="activity-meta">
              <span class="activity-badge" :class="getBadgeClass(activity.type)">
                {{ activity.type || 'info' }}
              </span>
              <div class="activity-time">{{ formatActivityDate(activity.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import dashboardService from '@/services/dashboard.service';
import { useAuthStore, useMenuStore } from '@/stores';

// ── Auth ──────────────────────────────────────────────────────────────────────
const authStore = useAuthStore();
const username = computed(() => authStore.user?.fullName || authStore.user?.username || 'User');

// ── Menu store (for page navigator) ──────────────────────────────────────────
const menuStore = useMenuStore();
const menuCategories = computed(() => menuStore.menuCategories);
const menuLoading = computed(() => menuStore.loading);

// ── Data ──────────────────────────────────────────────────────────────────────
const loading = ref(true);
const stats = ref({});
const recentActivities = ref([]);

const fetchData = async () => {
  loading.value = true;
  try {
    const [statsData, activityData] = await Promise.all([
      dashboardService.getStats(),
      dashboardService.getRecentActivity(),
    ]);
    stats.value = statsData;
    recentActivities.value = activityData;
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

// ── Current date ──────────────────────────────────────────────────────────────
const currentDate = computed(() => {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

// ── Formatters ────────────────────────────────────────────────────────────────
const formatDateTime = (dateString) => {
  if (!dateString) return 'Belum ada';
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatActivityDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Baru saja';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm lalu';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'j lalu';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

// ── Avatar helpers ────────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return 'S';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const getAvatarClass = (type) => {
  const map = {
    login:  'avatar-blue',
    logout: 'avatar-gray',
    sync:   'avatar-orange',
    store:  'avatar-purple',
    report: 'avatar-green',
    create: 'avatar-teal',
    update: 'avatar-indigo',
    delete: 'avatar-red',
  };
  return map[type] || 'avatar-gray';
};

const getBadgeClass = (type) => {
  const map = {
    login:  'badge-blue',
    logout: 'badge-gray',
    sync:   'badge-orange',
    store:  'badge-purple',
    report: 'badge-green',
    create: 'badge-teal',
    update: 'badge-indigo',
    delete: 'badge-red',
  };
  return map[type] || 'badge-gray';
};

// ── Page descriptions map ─────────────────────────────────────────────────────
const PAGE_DESCRIPTIONS = {
  '/stores':                'Kelola data toko dan cabang',
  '/prep-closing':          'Cek persiapan closing harian toko',
  '/prep-closing-server':   'Persiapan closing di sisi server',
  '/rekon-sales':           'Rekonsiliasi data penjualan antar sistem',
  '/penyesuaian':           'Penyesuaian data transaksi toko',
  '/adjust':                'Adjustment data persediaan & transaksi',
  '/cetak-bpb':             'Cetak Bukti Penerimaan Barang',
  '/rekap-backup':          'Rekap status backup data toko',
  '/rekon-persediaan':      'Rekonsiliasi data persediaan toko',
  '/rekon-wt-harian':       'Rekonsiliasi Warehouse Transfer Harian',
  '/rekon-virtual-margin':  'Rekonsiliasi virtual margin berbasis toko',
  '/buat-rmb':              'Buat dan kelola dokumen RMB',
  '/notes':                 'Catatan dan informasi penting',
  '/note-categories':       'Kelola kategori catatan',
  '/reports':               'Laporan dan analisa data',
  '/report-bulanan':        'Laporan bulanan per toko',
  '/screenings':            'Data screening toko',
  '/user-activities':       'Log aktivitas seluruh pengguna',
  '/users':                 'Manajemen akun pengguna',
  '/admin/menu-manager':    'Pengaturan menu navigasi sistem',
  '/settings':              'Pengaturan umum aplikasi',
};

const getPageDesc = (path) => {
  return PAGE_DESCRIPTIONS[path] || 'Buka halaman ini untuk informasi lebih lanjut';
};
</script>

<style>
@import './Dashboard.style.css';
</style>
