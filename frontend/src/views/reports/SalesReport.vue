<template>
  <div class="sales-report">
    <page-title title="Sales Report" :include-app-name="true" separator="ย |ย " />
    
    <div class="page-header">
      <h1>Sales Report</h1>
      <p>Laporan penjualan dan analisis revenue</p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Filter Laporan</h2>
      </div>
      <div class="card-body">
        <div class="filter-row">
          <div class="form-group">
            <label for="startDate">Tanggal Mulai</label>
            <input type="date" id="startDate" v-model="filters.startDate" class="form-input">
          </div>
          <div class="form-group">
            <label for="endDate">Tanggal Akhir</label>
            <input type="date" id="endDate" v-model="filters.endDate" class="form-input">
          </div>
          <div class="form-group">
            <label for="store">Store</label>
            <select id="store" v-model="filters.storeId" class="form-select">
              <option value="">Semua Store</option>
              <option v-for="store in stores" :key="store.id" :value="store.id">
                {{ store.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <button @click="generateReport" class="btn btn-primary" :disabled="loading">
              <i class="pi pi-search"></i> Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Memuat laporan...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
    </div>

    <div v-else-if="reportData" class="report-content">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-icon">
            <i class="pi pi-dollar"></i>
          </div>
          <div class="summary-content">
            <h3>{{ formatCurrency(reportData.totalSales) }}</h3>
            <p>Total Sales</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">
            <i class="pi pi-shopping-cart"></i>
          </div>
          <div class="summary-content">
            <h3>{{ reportData.totalTransactions }}</h3>
            <p>Total Transactions</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">
            <i class="pi pi-chart-line"></i>
          </div>
          <div class="summary-content">
            <h3>{{ formatCurrency(reportData.averageTransaction) }}</h3>
            <p>Average Transaction</p>
          </div>
        </div>
      </div>

      <!-- Sales Table -->
      <div class="card">
        <div class="card-header">
          <h2>Detail Penjualan</h2>
          <button @click="exportReport" class="btn btn-secondary">
            <i class="pi pi-download"></i> Export
          </button>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Store</th>
                  <th>Total Sales</th>
                  <th>Transactions</th>
                  <th>Avg Transaction</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in reportData.details" :key="item.id">
                  <td>{{ formatDate(item.date) }}</td>
                  <td>{{ item.storeName }}</td>
                  <td>{{ formatCurrency(item.totalSales) }}</td>
                  <td>{{ item.transactions }}</td>
                  <td>{{ formatCurrency(item.avgTransaction) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { PageTitle } from '../../components/transitions';

// State
const loading = ref(false);
const error = ref(null);
const reportData = ref(null);
const stores = ref([]);

const filters = ref({
  startDate: '',
  endDate: '',
  storeId: ''
});

// Methods
const generateReport = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock data
    reportData.value = {
      totalSales: 1250000,
      totalTransactions: 150,
      averageTransaction: 8333,
      details: [
        {
          id: 1,
          date: '2024-01-15',
          storeName: 'Store A',
          totalSales: 500000,
          transactions: 60,
          avgTransaction: 8333
        },
        {
          id: 2,
          date: '2024-01-15',
          storeName: 'Store B',
          totalSales: 750000,
          transactions: 90,
          avgTransaction: 8333
        }
      ]
    };
  } catch (err) {
    error.value = err.message || 'Failed to generate report';
  } finally {
    loading.value = false;
  }
};

const exportReport = () => {
  // Implement export functionality
  console.log('Exporting report...');
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('id-ID');
};

// Load initial data
onMounted(async () => {
  try {
    // Load stores for filter
    stores.value = [
      { id: 1, name: 'Store A' },
      { id: 2, name: 'Store B' },
      { id: 3, name: 'Store C' }
    ];
    
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    filters.value.startDate = startDate.toISOString().split('T')[0];
    filters.value.endDate = endDate.toISOString().split('T')[0];
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }
});
</script>

<style scoped>
.sales-report {
  padding: 1rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.page-header p {
  color: var(--text-secondary-color);
  font-size: 0.9rem;
}

.card {
  background-color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  overflow: hidden;
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.card-body {
  padding: 1rem;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.form-input,
.form-select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--primary-color, #3B82F6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--primary-color, #3B82F6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-color-dark, #2563EB);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6B7280;
  color: white;
}

.btn-secondary:hover {
  background-color: #4B5563;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary-color);
}

.loading-state i {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--primary-color, #3B82F6);
}

.error-state i {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #EF4444;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-icon {
  width: 3rem;
  height: 3rem;
  background: var(--primary-color, #3B82F6);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
}

.summary-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
}

.summary-content p {
  color: var(--text-secondary-color);
  margin: 0;
  font-size: 0.875rem;
}

.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

.data-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: var(--text-color);
}

.data-table tbody tr:hover {
  background-color: #f8f9fa;
}
</style>