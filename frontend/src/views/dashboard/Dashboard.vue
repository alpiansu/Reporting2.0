<template>
  <div class="dashboard">
    <!-- Custom page title with specific options -->
    <page-title title="Dashboard Overview" :include-app-name="true" separator=" - " />
    
    <h1 class="page-title">Dashboard</h1>
    
    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-shopping-bag"></i>
        </div>
        <div class="stat-content">
          <h3 class="stat-value">{{ stats.totalStores || 0 }}</h3>
          <p class="stat-label">Total Stores</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-chart-bar"></i>
        </div>
        <div class="stat-content">
          <h3 class="stat-value">{{ stats.totalScreenings || 0 }}</h3>
          <p class="stat-label">Total Screenings</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-calendar"></i>
        </div>
        <div class="stat-content">
          <h3 class="stat-value">{{ stats.screeningsThisMonth || 0 }}</h3>
          <p class="stat-label">Screenings This Month</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-check-circle"></i>
        </div>
        <div class="stat-content">
          <h3 class="stat-value">{{ stats.completedScreenings || 0 }}</h3>
          <p class="stat-label">Completed Screenings</p>
        </div>
      </div>
    </div>
    
    <div class="dashboard-charts">
      <div class="chart-card">
        <div class="chart-header">
          <h2 class="chart-title">Screenings by Month</h2>
          <div class="chart-actions">
            <button class="chart-action-button">
              <i class="pi pi-refresh"></i>
            </button>
            <button class="chart-action-button">
              <i class="pi pi-ellipsis-h"></i>
            </button>
          </div>
        </div>
        <div class="chart-content">
          <!-- Chart placeholder - would use a chart library like Chart.js or PrimeVue Charts -->
          <div class="chart-placeholder">
            <i class="pi pi-chart-line"></i>
            <p>Monthly screening data visualization</p>
          </div>
        </div>
      </div>
      
      <div class="chart-card">
        <div class="chart-header">
          <h2 class="chart-title">Stores by Region</h2>
          <div class="chart-actions">
            <button class="chart-action-button">
              <i class="pi pi-refresh"></i>
            </button>
            <button class="chart-action-button">
              <i class="pi pi-ellipsis-h"></i>
            </button>
          </div>
        </div>
        <div class="chart-content">
          <!-- Chart placeholder - would use a chart library like Chart.js or PrimeVue Charts -->
          <div class="chart-placeholder">
            <i class="pi pi-chart-pie"></i>
            <p>Regional store distribution</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="dashboard-tables">
      <div class="table-card">
        <div class="table-header">
          <h2 class="table-title">Recent Screenings</h2>
          <router-link to="/screenings" class="view-all">View All</router-link>
        </div>
        <div class="table-content">
          <table class="data-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Date</th>
                <th>Status</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="recentScreenings.length === 0">
                <td colspan="4" class="empty-table">No recent screenings found</td>
              </tr>
              <tr v-for="(screening, index) in recentScreenings" :key="index">
                <td>{{ screening.storeName }}</td>
                <td>{{ formatDate(screening.date) }}</td>
                <td>
                  <span class="status-badge" :class="getStatusClass(screening.status)">
                    {{ screening.status }}
                  </span>
                </td>
                <td>{{ screening.score }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// Mock data - would be replaced with API calls
const stats = ref({
  totalStores: 24,
  totalScreenings: 156,
  screeningsThisMonth: 12,
  completedScreenings: 142
});

const recentScreenings = ref([
  { storeName: 'Store Alpha', date: '2023-11-28', status: 'Completed', score: 92 },
  { storeName: 'Store Beta', date: '2023-11-25', status: 'Completed', score: 88 },
  { storeName: 'Store Gamma', date: '2023-11-22', status: 'In Progress', score: 45 },
  { storeName: 'Store Delta', date: '2023-11-20', status: 'Completed', score: 95 },
  { storeName: 'Store Epsilon', date: '2023-11-18', status: 'Pending', score: 0 }
]);

// Format date for display
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

// Get CSS class based on status
const getStatusClass = (status) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'status-completed';
    case 'in progress':
      return 'status-in-progress';
    case 'pending':
      return 'status-pending';
    default:
      return '';
  }
};

// Fetch dashboard data
onMounted(() => {
  // Would fetch data from API here
  console.log('Dashboard mounted, would fetch data here');
});
</script>

<style>
@import './Dashboard.style.css';
</style>