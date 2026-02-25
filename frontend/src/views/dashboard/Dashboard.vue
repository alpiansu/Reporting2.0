<template>
  <div class="dashboard fade-in">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard Overview</h1>
        <p class="text-sm text-gray-500 mt-1">Welcome back, {{ username }}! Here's what's happening today.</p>
      </div>
      <div class="flex gap-2">
        <Button 
          icon="pi pi-refresh" 
          label="Refresh" 
          outlined 
          severity="secondary" 
          @click="fetchData" 
          :loading="loading" 
        />
        <Button 
          icon="pi pi-cog" 
          severity="secondary" 
          text 
        />
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="dashboard-stats">
      <div v-if="loading" v-for="i in 4" :key="'skeleton-stat-' + i" class="stat-card-custom">
        <Skeleton shape="circle" size="3.5rem" class="mr-4" />
        <div class="flex-grow">
          <Skeleton width="40%" height="1.5rem" class="mb-2" />
          <Skeleton width="60%" />
        </div>
      </div>
      
      <template v-else>
        <div class="stat-card-custom">
          <div class="stat-icon icon-blue">
            <i class="pi pi-shopping-bag"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalStores || 0 }}</div>
            <div class="stat-label">Total Stores</div>
          </div>
        </div>

        <div class="stat-card-custom">
          <div class="stat-icon icon-purple">
            <i class="pi pi-check-circle"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalPenyesuaian || 0 }}</div>
            <div class="stat-label">Penyesuaian</div>
          </div>
        </div>

        <div class="stat-card-custom">
          <div class="stat-icon icon-orange">
            <i class="pi pi-chart-bar"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalRekonSales || 0 }}</div>
            <div class="stat-label">Rekon Sales</div>
          </div>
        </div>

        <div class="stat-card-custom">
          <div class="stat-icon icon-green">
            <i class="pi pi-sync"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value text-sm overflow-hidden text-ellipsis whitespace-nowrap">
              {{ formatDateTime(stats.lastSync) }}
            </div>
            <div class="stat-label">Last Sync</div>
          </div>
        </div>
      </template>
    </div>

    <div class="dashboard-grid">
      <!-- Main Content Area -->
      <div class="flex flex-col gap-6">
        <!-- Quick Actions -->
        <Card class="quick-actions-card shadow-sm">
          <template #title>
            <div class="flex items-center gap-2">
              <i class="pi pi-bolt text-yellow-500"></i>
              <span>Quick Actions</span>
            </div>
          </template>
          <template #content>
            <div class="actions-grid">
              <Button icon="pi pi-shopping-bag" label="Stores" severity="primary" outlined class="action-btn" @click="$router.push('/stores')" />
              <Button icon="pi pi-check-square" label="Screening" severity="info" outlined class="action-btn" @click="$router.push('/prep-closing')" />
              <Button icon="pi pi-sync" label="Rekon Sales" severity="help" outlined class="action-btn" @click="$router.push('/rekon-sales')" />
              <Button icon="pi pi-sliders-h" label="Adjust" severity="secondary" outlined class="action-btn" @click="$router.push('/adjust')" />
            </div>
          </template>
        </Card>

        <!-- Data Insights -->
        <Card class="activity-card shadow-sm">
          <template #title>
            <div class="flex items-center gap-2">
              <i class="pi pi-chart-pie text-indigo-500"></i>
              <span>Data Insights</span>
            </div>
          </template>
          <template #content>
            <div class="flex flex-col gap-6">
              <div class="grid grid-cols-2 gap-4">
                <div class="insight-item p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col">
                  <span class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Reports Ready</span>
                  <span class="text-2xl font-black text-indigo-700">{{ stats.totalRekonSales + stats.totalPenyesuaian }}</span>
                </div>
                <div class="insight-item p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col">
                  <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Active Stores</span>
                  <span class="text-2xl font-black text-emerald-700">{{ stats.totalStores }}</span>
                </div>
              </div>

              <div class="system-summary p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h4 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <i class="pi pi-server text-gray-400"></i>
                  System Status
                </h4>
                <div class="flex flex-col gap-3">
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">Database Connection</span>
                    <Tag severity="success" value="Connected" rounded />
                  </div>
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">Last Background Sync</span>
                    <span class="font-medium text-gray-700">{{ formatActivityDate(stats.lastSync) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Sidebar / Activity Feed -->
      <Card class="activity-card shadow-sm">
        <template #title>
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <i class="pi pi-history text-purple-500"></i>
              <span>Recent Activity</span>
            </div>
            <Button icon="pi pi-arrow-right" text severity="secondary" @click="$router.push('/user-activities')" size="small" />
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="flex flex-col gap-4">
            <div v-for="i in 5" :key="'skeleton-activity-' + i" class="flex gap-4">
              <Skeleton shape="circle" size="2.5rem" />
              <div class="flex-grow">
                <Skeleton width="80%" class="mb-2" />
                <Skeleton width="40%" height="0.75rem" />
              </div>
            </div>
          </div>

          <Timeline v-else :value="recentActivities" class="custom-timeline">
            <template #content="slotProps">
              <div class="activity-item">
                <div class="activity-content">
                  <div class="activity-user">{{ slotProps.item.user?.fullName || 'System' }}</div>
                  <div class="activity-desc">{{ slotProps.item.description }}</div>
                  <div class="activity-time">
                    <i class="pi pi-clock text-[10px] mr-1"></i>
                    {{ formatActivityDate(slotProps.item.createdAt) }}
                  </div>
                </div>
              </div>
            </template>
            <template #marker="slotProps">
              <Avatar 
                :label="getInitials(slotProps.item.user?.fullName || 'System')" 
                shape="circle" 
                :class="getAvatarClass(slotProps.item.type)"
              />
            </template>
          </Timeline>
          
          <div v-if="!loading && recentActivities.length === 0" class="text-center py-8 text-gray-400">
            <i class="pi pi-inbox text-4xl mb-2 opacity-20"></i>
            <p>No recent activity</p>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Timeline from 'primevue/timeline';
import Skeleton from 'primevue/skeleton';
import Avatar from 'primevue/avatar';
import Tag from 'primevue/tag';
import dashboardService from '@/services/dashboard.service';

const loading = ref(true);
const stats = ref({});
const recentActivities = ref([]);

// Mock user data - normally from a store
const userJson = localStorage.getItem('user');
const user = userJson ? JSON.parse(userJson) : { fullName: 'User' };
const username = computed(() => user.fullName || 'User');

const fetchData = async () => {
  loading.value = true;
  try {
    const [statsData, activityData] = await Promise.all([
      dashboardService.getStats(),
      dashboardService.getRecentActivity()
    ]);
    stats.value = statsData;
    recentActivities.value = activityData;
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
  } finally {
    loading.value = false;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const formatActivityDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

const getInitials = (name) => {
  if (!name) return 'S';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const getAvatarClass = (type) => {
  switch (type) {
    case 'login': return 'bg-blue-100 text-blue-600';
    case 'sync': return 'bg-orange-100 text-orange-600';
    case 'store': return 'bg-purple-100 text-purple-600';
    case 'report': return 'bg-green-100 text-green-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style>
@import './Dashboard.style.css';

/* Override PrimeVue PrimeIcons alignment in timeline if needed */
.custom-timeline .p-timeline-event-opposite {
  display: none;
}

.custom-timeline .p-timeline-event-content {
  padding-bottom: 1.5rem;
}
</style>
