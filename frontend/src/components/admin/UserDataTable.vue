<template>
  <div class="user-data-table">
    <!-- Search and Controls -->
    <div class="table-controls">
      <div class="search-container">
        <div class="search-box">
          <i class="pi pi-search search-icon"></i>
          <input 
            type="text" 
            v-model="searchQuery" 
            @input="handleSearch"
            placeholder="Cari pengguna (username, nama, email, role)..."
            class="search-input"
          />
          <button 
            type="button" 
            v-if="searchQuery" 
            @click="clearSearch" 
            class="clear-button"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
      
      <div class="table-actions">
        <button @click="$emit('refresh')" class="action-button refresh-button">
          <i class="pi pi-refresh"></i>
          Refresh
        </button>
        <button @click="$emit('export')" class="action-button export-button">
          <i class="pi pi-download"></i>
          Export
        </button>
        <button @click="$emit('print')" class="action-button print-button">
          <i class="pi pi-print"></i>
          Print
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner">
        <i class="pi pi-spin pi-spinner"></i>
      </div>
      <p>Memuat data pengguna...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">
        <i class="pi pi-exclamation-triangle"></i>
      </div>
      <p>{{ error }}</p>
      <button @click="$emit('refresh')" class="retry-button">
        <i class="pi pi-refresh"></i>
        Coba Lagi
      </button>
    </div>

    <!-- Data Table -->
    <div v-else class="table-container">
      <!-- Table Header -->
      <div class="table-header">
        <h3 class="table-title">Daftar Pengguna</h3>
        <div class="table-info">
          <span class="total-records">Total: {{ totalRecords }} pengguna</span>
          <span class="filtered-records" v-if="isFiltered">
            ({{ filteredData.length }} hasil pencarian)
          </span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="paginatedData.length === 0" class="empty-state">
        <div class="empty-icon">
          <i class="pi pi-users"></i>
        </div>
        <h4>{{ isFiltered ? 'Tidak ada hasil pencarian' : 'Belum ada pengguna' }}</h4>
        <p>{{ isFiltered ? 'Coba ubah kata kunci pencarian' : 'Belum ada pengguna yang terdaftar dalam sistem' }}</p>
        <button v-if="isFiltered" @click="clearSearch" class="clear-filter-button">
          <i class="pi pi-times"></i>
          Hapus Filter
        </button>
      </div>

      <!-- Table Content -->
      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th 
                v-for="column in columns" 
                :key="column.key"
                @click="handleSort(column.key)"
                :class="{ 
                  'sortable': column.sortable,
                  'sort-asc': sortColumn === column.key && sortOrder === 'asc',
                  'sort-desc': sortColumn === column.key && sortOrder === 'desc'
                }"
              >
                {{ column.label }}
                <i 
                  v-if="column.sortable" 
                  class="sort-icon pi" 
                  :class="{
                    'pi-sort': sortColumn !== column.key,
                    'pi-sort-up': sortColumn === column.key && sortOrder === 'asc',
                    'pi-sort-down': sortColumn === column.key && sortOrder === 'desc'
                  }"
                ></i>
              </th>
              <th class="actions-column">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedData" :key="user.id" class="table-row">
              <td>{{ user.username }}</td>
              <td>{{ user.fullName }}</td>
              <td>{{ user.email }}</td>
              <td>
                <span class="role-badge" :class="`role-${user.role}`">
                  {{ user.role }}
                </span>
              </td>
              <td>
                <span class="status-badge" :class="user.isActive ? 'active' : 'inactive'">
                  {{ user.isActive ? 'Aktif' : 'Nonaktif' }}
                </span>
              </td>
              <td>{{ formatLastLogin(user.lastLogin) }}</td>
              <td class="actions-cell">
                <div class="action-buttons">
                  <button 
                    @click="$emit('edit-user', user)" 
                    class="action-btn edit-btn"
                    title="Edit Pengguna"
                  >
                    <i class="pi pi-pencil"></i>
                  </button>
                  <button 
                    @click="$emit('reset-password', user)" 
                    class="action-btn reset-btn"
                    title="Reset Password"
                  >
                    <i class="pi pi-key"></i>
                  </button>
                  <button 
                    @click="$emit('delete-user', user)" 
                    class="action-btn delete-btn"
                    title="Hapus Pengguna"
                  >
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination-container">
        <div class="pagination-info">
          <span>Menampilkan {{ startRecord }} - {{ endRecord }} dari {{ filteredData.length }} data</span>
        </div>
        
        <div class="pagination-controls">
          <button 
            @click="goToPage(1)" 
            :disabled="currentPage === 1"
            class="pagination-btn"
            title="Halaman Pertama"
          >
            <i class="pi pi-angle-double-left"></i>
          </button>
          
          <button 
            @click="goToPage(currentPage - 1)" 
            :disabled="currentPage === 1"
            class="pagination-btn"
            title="Halaman Sebelumnya"
          >
            <i class="pi pi-angle-left"></i>
          </button>
          
          <div class="page-numbers">
            <button 
              v-for="page in visiblePages" 
              :key="page"
              @click="goToPage(page)"
              :class="{ 'active': page === currentPage }"
              class="page-btn"
            >
              {{ page }}
            </button>
          </div>
          
          <button 
            @click="goToPage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="pagination-btn"
            title="Halaman Selanjutnya"
          >
            <i class="pi pi-angle-right"></i>
          </button>
          
          <button 
            @click="goToPage(totalPages)" 
            :disabled="currentPage === totalPages"
            class="pagination-btn"
            title="Halaman Terakhir"
          >
            <i class="pi pi-angle-double-right"></i>
          </button>
        </div>
        
        <div class="items-per-page">
          <label for="itemsPerPage">Per halaman:</label>
          <select 
            id="itemsPerPage" 
            v-model="itemsPerPage" 
            @change="handleItemsPerPageChange"
            class="items-select"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
});

const emit = defineEmits([
  'refresh', 
  'export', 
  'print', 
  'edit-user', 
  'reset-password', 
  'delete-user'
]);

// Table configuration
const columns = [
  { key: 'username', label: 'Username', sortable: true },
  { key: 'fullName', label: 'Nama Lengkap', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'isActive', label: 'Status', sortable: true },
  { key: 'lastLogin', label: 'Login Terakhir', sortable: true }
];

// Search and filter state
const searchQuery = ref('');
const searchTimeout = ref(null);

// Sorting state
const sortColumn = ref(null);
const sortOrder = ref('asc');

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Computed properties
const totalRecords = computed(() => props.data.length);

const isFiltered = computed(() => searchQuery.value.length > 0);

const filteredData = computed(() => {
  let result = [...props.data];
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(user => 
      user.username.toLowerCase().includes(query) ||
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  }
  
  // Apply sorting
  if (sortColumn.value) {
    result.sort((a, b) => {
      let aVal = a[sortColumn.value];
      let bVal = b[sortColumn.value];
      
      // Handle different data types
      if (sortColumn.value === 'lastLogin') {
        aVal = a.lastLogin ? new Date(a.lastLogin) : new Date(0);
        bVal = b.lastLogin ? new Date(b.lastLogin) : new Date(0);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  return result;
});

const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / itemsPerPage.value);
});

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredData.value.slice(start, end);
});

const startRecord = computed(() => {
  if (filteredData.value.length === 0) return 0;
  return (currentPage.value - 1) * itemsPerPage.value + 1;
});

const endRecord = computed(() => {
  const end = currentPage.value * itemsPerPage.value;
  return Math.min(end, filteredData.value.length);
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  
  // Adjust start if we're near the end
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

// Methods
const handleSearch = () => {
  // Debounce search
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  searchTimeout.value = setTimeout(() => {
    // Reset to first page when searching
    currentPage.value = 1;
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = '';
  currentPage.value = 1;
};

const handleSort = (column) => {
  if (sortColumn.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortOrder.value = 'asc';
  }
  
  // Reset to first page when sorting
  currentPage.value = 1;
};

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const handleItemsPerPageChange = () => {
  // Reset to first page when changing items per page
  currentPage.value = 1;
};

const formatLastLogin = (lastLogin) => {
  if (!lastLogin) return 'Belum pernah';
  
  return new Date(lastLogin).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Watch for data changes to reset pagination
watch(() => props.data, () => {
  currentPage.value = 1;
}, { deep: true });

// Watch for filtered data changes to adjust current page
watch(filteredData, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = totalPages.value;
  }
});
</script>

<style scoped>
.user-data-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* Table Controls */
.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  gap: 1rem;
}

.search-container {
  flex: 1;
  max-width: 400px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #6b7280;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  color: #374151;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  background: white;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}

.clear-button {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: #374151;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.loading-spinner {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #667eea;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #dc2626;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.retry-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #dc2626;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  margin-top: 1rem;
  transition: background 0.2s ease;
}

.retry-button:hover {
  background: #b91c1c;
}

/* Table Container */
.table-container {
  padding: 1.5rem;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.table-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.table-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
}

.filtered-records {
  color: #667eea;
  font-weight: 500;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  color: #d1d5db;
  margin-bottom: 1rem;
}

.empty-state h4 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.clear-filter-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #667eea;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.2s ease;
}

.clear-filter-button:hover {
  background: #5a67d8;
}

/* Table */
.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: #f9fafb;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.data-table th.sortable:hover {
  background: #f3f4f6;
}

.sort-icon {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.6;
}

.data-table th.sort-asc,
.data-table th.sort-desc {
  background: #e0e7ff;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
}

.table-row:hover {
  background: #f9fafb;
}

.table-row:last-child td {
  border-bottom: none;
}

/* Badges */
.role-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.role-superadmin {
  background: #fef3c7;
  color: #92400e;
}

.role-admin {
  background: #dbeafe;
  color: #1e40af;
}

.role-user {
  background: #d1fae5;
  color: #065f46;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

/* Action Buttons */
.actions-cell {
  width: 120px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.edit-btn {
  background: #dbeafe;
  color: #1e40af;
}

.edit-btn:hover {
  background: #bfdbfe;
  transform: translateY(-1px);
}

.reset-btn {
  background: #fef3c7;
  color: #92400e;
}

.reset-btn:hover {
  background: #fde68a;
  transform: translateY(-1px);
}

.delete-btn {
  background: #fee2e2;
  color: #991b1b;
}

.delete-btn:hover {
  background: #fecaca;
  transform: translateY(-1px);
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  gap: 1rem;
}

.pagination-info {
  font-size: 14px;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #374151;
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 2px;
  margin: 0 8px;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #374151;
  font-weight: 500;
}

.page-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
}

.items-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #374151;
  cursor: pointer;
}

.items-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Responsive */
@media (max-width: 768px) {
  .table-controls {
    flex-direction: column;
    gap: 1rem;
  }
  
  .search-container {
    max-width: none;
  }
  
  .table-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .pagination-container {
    flex-direction: column;
    gap: 1rem;
  }
  
  .pagination-controls {
    order: 1;
  }
  
  .pagination-info {
    order: 2;
  }
  
  .items-per-page {
    order: 3;
  }
}
</style>