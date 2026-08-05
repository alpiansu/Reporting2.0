<template>
  <div class="inventory-report">
    <page-title title="Inventory Report" :include-app-name="true" separator=" | " />
    
    <div class="page-header">
      <h1>Inventory Report</h1>
      <p>Laporan stok dan inventori produk</p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Filter Laporan</h2>
      </div>
      <div class="card-body">
        <div class="filter-row">
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
            <label for="category">Kategori</label>
            <select id="category" v-model="filters.category" class="form-select">
              <option value="">Semua Kategori</option>
              <option v-for="category in categories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="stockStatus">Status Stok</label>
            <select id="stockStatus" v-model="filters.stockStatus" class="form-select">
              <option value="">Semua Status</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
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
            <i class="pi pi-box"></i>
          </div>
          <div class="summary-content">
            <h3>{{ reportData.totalProducts }}</h3>
            <p>Total Products</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon in-stock">
            <i class="pi pi-check-circle"></i>
          </div>
          <div class="summary-content">
            <h3>{{ reportData.inStockProducts }}</h3>
            <p>In Stock</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon low-stock">
            <i class="pi pi-exclamation-triangle"></i>
          </div>
          <div class="summary-content">
            <h3>{{ reportData.lowStockProducts }}</h3>
            <p>Low Stock</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon out-of-stock">
            <i class="pi pi-times-circle"></i>
          </div>
          <div class="summary-content">
            <h3>{{ reportData.outOfStockProducts }}</h3>
            <p>Out of Stock</p>
          </div>
        </div>
      </div>

      <!-- Inventory Table -->
      <div class="card">
        <div class="card-header">
          <h2>Detail Inventori</h2>
          <div class="header-actions">
            <button @click="exportReport" class="btn btn-secondary">
              <i class="pi pi-download"></i> Export
            </button>
            <button @click="refreshData" class="btn btn-outline">
              <i class="pi pi-refresh"></i> Refresh
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Kode Produk</th>
                  <th>Nama Produk</th>
                  <th>Kategori</th>
                  <th>Store</th>
                  <th>Stok Saat Ini</th>
                  <th>Minimum Stok</th>
                  <th>Status</th>
                  <th>Nilai Stok</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in reportData.details" :key="item.id">
                  <td>{{ item.productCode }}</td>
                  <td>{{ item.productName }}</td>
                  <td>{{ item.category }}</td>
                  <td>{{ item.storeName }}</td>
                  <td>{{ item.currentStock }}</td>
                  <td>{{ item.minimumStock }}</td>
                  <td>
                    <span class="status-badge" :class="getStatusClass(item.status)">
                      {{ getStatusText(item.status) }}
                    </span>
                  </td>
                  <td>{{ formatCurrency(item.stockValue) }}</td>
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
const categories = ref([]);

const filters = ref({
  storeId: '',
  category: '',
  stockStatus: ''
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
      totalProducts: 150,
      inStockProducts: 120,
      lowStockProducts: 25,
      outOfStockProducts: 5,
      details: [
        {
          id: 1,
          productCode: 'PRD001',
          productName: 'Product A',
          category: 'Electronics',
          storeName: 'Store A',
          currentStock: 50,
          minimumStock: 10,
          status: 'in-stock',
          stockValue: 2500000
        },
        {
          id: 2,
          productCode: 'PRD002',
          productName: 'Product B',
          category: 'Clothing',
          storeName: 'Store B',
          currentStock: 5,
          minimumStock: 10,
          status: 'low-stock',
          stockValue: 750000
        },
        {
          id: 3,
          productCode: 'PRD003',
          productName: 'Product C',
          category: 'Food',
          storeName: 'Store C',
          currentStock: 0,
          minimumStock: 5,
          status: 'out-of-stock',
          stockValue: 0
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
  console.log('Exporting inventory report...');
};

const refreshData = () => {
  generateReport();
};

const getStatusClass = (status) => {
  switch (status) {
    case 'in-stock': return 'status-success';
    case 'low-stock': return 'status-warning';
    case 'out-of-stock': return 'status-danger';
    default: return '';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'in-stock': return 'In Stock';
    case 'low-stock': return 'Low Stock';
    case 'out-of-stock': return 'Out of Stock';
    default: return status;
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);
};

// Load initial data
onMounted(async () => {
  try {
    // Load stores and categories for filter
    stores.value = [
      { id: 1, name: 'Store A' },
      { id: 2, name: 'Store B' },
      { id: 3, name: 'Store C' }
    ];
    
    categories.value = [
      'Electronics',
      'Clothing',
      'Food',
      'Books',
      'Home & Garden'
    ];
    
    // Generate initial report
    await generateReport();
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }
});
</script>

<style scoped src="./InventoryReport.style.css"></style>