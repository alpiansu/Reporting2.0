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

<style scoped>
.dashboard {
  padding: 16px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--text-color);
}

/* Stats Cards */
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 20px;
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: rgba(var(--primary-color-rgb), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.stat-icon i {
  font-size: 1.5rem;
  color: var(--primary-color);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--text-color);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0;
}

/* Charts */
.dashboard-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.chart-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.chart-action-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-color-secondary);
}

.chart-action-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.chart-content {
  padding: 20px;
  height: 300px;
}

.chart-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  color: var(--text-color-secondary);
}

.chart-placeholder i {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* Tables */
.dashboard-tables {
  margin-bottom: 24px;
}

.table-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.table-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.view-all {
  color: var(--primary-color);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.view-all:hover {
  text-decoration: underline;
}

.table-content {
  padding: 0;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 12px 20px;
  font-weight: 600;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.data-table td {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: var(--text-color);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.empty-table {
  text-align: center;
  padding: 32px;
  color: var(--text-color-secondary);
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-completed {
  background-color: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.status-in-progress {
  background-color: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.status-pending {
  background-color: rgba(108, 117, 125, 0.1);
  color: #6c757d;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dashboard-charts {
    grid-template-columns: 1fr;
  }
  
  .dashboard-stats {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 480px) {
  .dashboard-stats {
    grid-template-columns: 1fr;
  }
  
  .stat-card {
    padding: 16px;
  }
  
  .chart-content {
    height: 250px;
  }
}
</style>