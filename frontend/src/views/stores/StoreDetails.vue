<template>
  <div class="store-details">
    <div class="page-header">
      <div class="header-left">
        <button class="back-button" @click="goBack">
          <i class="pi pi-arrow-left"></i>
        </button>
        <h1 class="page-title">{{ store?.name || 'Store Details' }}</h1>
        <span v-if="store" class="store-status" :class="getStatusClass(store.status)">{{ store.status }}</span>
      </div>
      <div class="header-actions">
        <button class="action-button edit-button" @click="openEditDialog">
          <i class="pi pi-pencil"></i>
          Edit
        </button>
        <button class="action-button delete-button" @click="confirmDelete">
          <i class="pi pi-trash"></i>
          Delete
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Loading store details...</p>
    </div>
    
    <div v-else-if="!store" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <h2>Store Not Found</h2>
      <p>The store you're looking for doesn't exist or has been removed.</p>
      <button class="back-to-list" @click="goToStoreList">
        <i class="pi pi-list"></i>
        Back to Store List
      </button>
    </div>
    
    <div v-else class="store-content">
      <div class="store-info-card">
        <h2 class="section-title">Store Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Store ID</span>
            <span class="info-value">{{ store.id }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Name</span>
            <span class="info-value">{{ store.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Address</span>
            <span class="info-value">{{ store.address }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Region</span>
            <span class="info-value">{{ store.region }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Phone</span>
            <span class="info-value">{{ store.phone }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value status-value" :class="getStatusClass(store.status)">{{ store.status }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Created At</span>
            <span class="info-value">{{ formatDate(store.createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Last Updated</span>
            <span class="info-value">{{ formatDate(store.updatedAt) }}</span>
          </div>
        </div>
      </div>
      
      <div class="screening-history-card">
        <div class="card-header">
          <h2 class="section-title">Screening History</h2>
          <button class="new-screening-button" @click="startNewScreening">
            <i class="pi pi-plus"></i>
            New Screening
          </button>
        </div>
        
        <div v-if="screenings.length === 0" class="empty-screenings">
          <i class="pi pi-chart-bar"></i>
          <p>No screenings have been conducted for this store yet.</p>
          <button class="start-screening-button" @click="startNewScreening">
            Start First Screening
          </button>
        </div>
        
        <div v-else class="screening-table-container">
          <table class="screening-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Conducted By</th>
                <th>Status</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="screening in screenings" :key="screening.id">
                <td>{{ formatDate(screening.date) }}</td>
                <td>{{ screening.conductedBy }}</td>
                <td>
                  <span class="status-badge" :class="getScreeningStatusClass(screening.status)">
                    {{ screening.status }}
                  </span>
                </td>
                <td>
                  <div class="score-display">
                    <div class="score-bar">
                      <div 
                        class="score-progress" 
                        :style="{ width: `${screening.score}%` }"
                        :class="getScoreClass(screening.score)"
                      ></div>
                    </div>
                    <span class="score-value">{{ screening.score }}%</span>
                  </div>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="table-action-button" @click="viewScreening(screening.id)">
                      <i class="pi pi-eye"></i>
                    </button>
                    <button 
                      v-if="screening.status !== 'Completed'"
                      class="table-action-button" 
                      @click="continueScreening(screening.id)"
                    >
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button class="table-action-button" @click="downloadReport(screening.id)">
                      <i class="pi pi-download"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Edit Store Dialog (would use a modal component in a real app) -->
    <div v-if="showEditDialog" class="dialog-overlay" @click="closeEditDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>Edit Store</h2>
          <button class="close-button" @click="closeEditDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="handleEditStore" class="store-form">
            <div class="form-group">
              <label for="editStoreName">Store Name</label>
              <input id="editStoreName" v-model="editedStore.name" type="text" placeholder="Enter store name" required />
            </div>
            
            <div class="form-group">
              <label for="editStoreAddress">Address</label>
              <input id="editStoreAddress" v-model="editedStore.address" type="text" placeholder="Enter store address" required />
            </div>
            
            <div class="form-group">
              <label for="editStoreRegion">Region</label>
              <select id="editStoreRegion" v-model="editedStore.regionId" required>
                <option value="" disabled>Select a region</option>
                <option v-for="region in regions" :key="region.id" :value="region.id">{{ region.name }}</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="editStorePhone">Phone Number</label>
              <input id="editStorePhone" v-model="editedStore.phone" type="tel" placeholder="Enter phone number" required />
            </div>
            
            <div class="form-group">
              <label for="editStoreStatus">Status</label>
              <select id="editStoreStatus" v-model="editedStore.status" required>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" @click="closeEditDialog">Cancel</button>
              <button type="submit" class="submit-button" :disabled="editLoading">
                <span v-if="!editLoading">Save Changes</span>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click="cancelDelete">
      <div class="dialog-content delete-dialog" @click.stop>
        <div class="dialog-header">
          <h2>Confirm Delete</h2>
          <button class="close-button" @click="cancelDelete">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <div class="delete-warning">
            <i class="pi pi-exclamation-triangle"></i>
            <p>Are you sure you want to delete <strong>{{ store?.name }}</strong>?</p>
            <p class="warning-text">This action cannot be undone and will also delete all screening data associated with this store.</p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="cancel-button" @click="cancelDelete">Cancel</button>
            <button 
              type="button" 
              class="delete-confirm-button" 
              :disabled="deleteLoading"
              @click="handleDelete"
            >
              <span v-if="!deleteLoading">Delete Store</span>
              <i v-else class="pi pi-spin pi-spinner"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

// State
const store = ref(null);
const screenings = ref([]);
const loading = ref(true);
const showEditDialog = ref(false);
const showDeleteDialog = ref(false);
const editLoading = ref(false);
const deleteLoading = ref(false);
const editedStore = ref({});

// Mock data for regions
const regions = ref([
  { id: 1, name: 'North' },
  { id: 2, name: 'South' },
  { id: 3, name: 'East' },
  { id: 4, name: 'West' },
  { id: 5, name: 'Central' }
]);

// Fetch store details
onMounted(async () => {
  const storeId = parseInt(route.params.id);
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock store data
    if (storeId === 1) {
      store.value = {
        id: 1,
        name: 'Store Alpha',
        address: '123 Main St, City A',
        region: 'North',
        regionId: 1,
        phone: '(123) 456-7890',
        status: 'Active',
        createdAt: '2023-01-15T10:30:00',
        updatedAt: '2023-11-28T14:45:00'
      };
      
      screenings.value = [
        {
          id: 101,
          storeId: 1,
          date: '2023-11-28T09:00:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 92
        },
        {
          id: 85,
          storeId: 1,
          date: '2023-09-15T10:30:00',
          conductedBy: 'Jane Smith',
          status: 'Completed',
          score: 88
        },
        {
          id: 64,
          storeId: 1,
          date: '2023-06-22T14:15:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 95
        },
        {
          id: 42,
          storeId: 1,
          date: '2023-03-10T11:45:00',
          conductedBy: 'Jane Smith',
          status: 'Completed',
          score: 90
        }
      ];
    } else if (storeId === 2) {
      store.value = {
        id: 2,
        name: 'Store Beta',
        address: '456 Oak Ave, City B',
        region: 'South',
        regionId: 2,
        phone: '(234) 567-8901',
        status: 'Active',
        createdAt: '2023-02-20T09:15:00',
        updatedAt: '2023-11-25T16:30:00'
      };
      
      screenings.value = [
        {
          id: 98,
          storeId: 2,
          date: '2023-11-25T13:45:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 88
        },
        {
          id: 76,
          storeId: 2,
          date: '2023-08-12T10:00:00',
          conductedBy: 'Jane Smith',
          status: 'Completed',
          score: 82
        },
        {
          id: 54,
          storeId: 2,
          date: '2023-05-18T15:30:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 85
        }
      ];
    } else if (storeId === 3) {
      store.value = {
        id: 3,
        name: 'Store Gamma',
        address: '789 Pine Rd, City C',
        region: 'East',
        regionId: 3,
        phone: '(345) 678-9012',
        status: 'Inactive',
        createdAt: '2023-03-10T14:20:00',
        updatedAt: '2023-11-22T11:10:00'
      };
      
      screenings.value = [
        {
          id: 95,
          storeId: 3,
          date: '2023-11-22T09:30:00',
          conductedBy: 'Jane Smith',
          status: 'In Progress',
          score: 45
        },
        {
          id: 82,
          storeId: 3,
          date: '2023-08-30T11:15:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 78
        },
        {
          id: 67,
          storeId: 3,
          date: '2023-06-05T14:45:00',
          conductedBy: 'Jane Smith',
          status: 'Completed',
          score: 80
        }
      ];
    } else if (storeId === 4) {
      store.value = {
        id: 4,
        name: 'Store Delta',
        address: '101 Elm Blvd, City D',
        region: 'West',
        regionId: 4,
        phone: '(456) 789-0123',
        status: 'Active',
        createdAt: '2023-04-05T11:45:00',
        updatedAt: '2023-11-20T10:20:00'
      };
      
      screenings.value = [
        {
          id: 92,
          storeId: 4,
          date: '2023-11-20T10:15:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 95
        },
        {
          id: 78,
          storeId: 4,
          date: '2023-08-15T13:30:00',
          conductedBy: 'Jane Smith',
          status: 'Completed',
          score: 92
        },
        {
          id: 63,
          storeId: 4,
          date: '2023-05-22T09:45:00',
          conductedBy: 'John Doe',
          status: 'Completed',
          score: 90
        },
        {
          id: 48,
          storeId: 4,
          date: '2023-02-18T14:00:00',
          conductedBy: 'Jane Smith',
          status: 'Completed',
          score: 88
        }
      ];
    } else if (storeId === 5) {
      store.value = {
        id: 5,
        name: 'Store Epsilon',
        address: '202 Cedar Ln, City E',
        region: 'Central',
        regionId: 5,
        phone: '(567) 890-1234',
        status: 'Pending',
        createdAt: '2023-05-12T16:30:00',
        updatedAt: '2023-11-18T09:40:00'
      };
      
      screenings.value = [];
    } else {
      // Store not found
      store.value = null;
    }
  } catch (error) {
    console.error('Error fetching store details:', error);
    store.value = null;
  } finally {
    loading.value = false;
  }
});

// Methods
const goBack = () => {
  router.back();
};

const goToStoreList = () => {
  router.push('/stores');
};

const getStatusClass = (status) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'status-active';
    case 'inactive':
      return 'status-inactive';
    case 'pending':
      return 'status-pending';
    default:
      return '';
  }
};

const getScreeningStatusClass = (status) => {
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

const getScoreClass = (score) => {
  if (score >= 90) return 'score-excellent';
  if (score >= 80) return 'score-good';
  if (score >= 70) return 'score-average';
  if (score >= 60) return 'score-below-average';
  return 'score-poor';
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const openEditDialog = () => {
  editedStore.value = { ...store.value };
  showEditDialog.value = true;
};

const closeEditDialog = () => {
  showEditDialog.value = false;
};

const handleEditStore = async () => {
  editLoading.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update store data
    const regionObj = regions.value.find(r => r.id === editedStore.value.regionId);
    
    store.value = {
      ...editedStore.value,
      region: regionObj.name,
      updatedAt: new Date().toISOString()
    };
    
    closeEditDialog();
  } catch (error) {
    console.error('Error updating store:', error);
  } finally {
    editLoading.value = false;
  }
};

const confirmDelete = () => {
  showDeleteDialog.value = true;
};

const cancelDelete = () => {
  showDeleteDialog.value = false;
};

const handleDelete = async () => {
  deleteLoading.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Redirect to store list after successful deletion
    router.push('/stores');
  } catch (error) {
    console.error('Error deleting store:', error);
  } finally {
    deleteLoading.value = false;
  }
};

const startNewScreening = () => {
  // In a real app, this would navigate to a new screening form
  console.log('Starting new screening for store:', store.value.id);
};

const viewScreening = (screeningId) => {
  router.push(`/screenings/${screeningId}`);
};

const continueScreening = (screeningId) => {
  router.push(`/screenings/${screeningId}/edit`);
};

const downloadReport = (screeningId) => {
  // In a real app, this would download a PDF report
  console.log('Downloading report for screening:', screeningId);
};
</script>

<style scoped>
.store-details {
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
}

.store-status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-active {
  background-color: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.status-inactive {
  background-color: rgba(108, 117, 125, 0.1);
  color: #6c757d;
}

.status-pending {
  background-color: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.edit-button {
  background-color: white;
  border: 1px solid #ddd;
  color: var(--text-color);
}

.edit-button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.delete-button {
  background-color: white;
  border: 1px solid #ddd;
  color: var(--error-color);
}

.delete-button:hover {
  border-color: var(--error-color);
  background-color: rgba(239, 68, 68, 0.05);
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  text-align: center;
}

.loading-container i, .error-container i {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.error-container i {
  color: var(--error-color);
}

.error-container h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.error-container p {
  color: var(--text-color-secondary);
  margin-bottom: 24px;
}

.back-to-list {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-to-list:hover {
  background-color: var(--primary-color-darken);
}

.store-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.store-info-card, .screening-history-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  padding: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.info-value {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-color);
}

.status-value {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.new-screening-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.new-screening-button:hover {
  background-color: var(--primary-color-darken);
}

.empty-screenings {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  text-align: center;
}

.empty-screenings i {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-screenings p {
  color: var(--text-color-secondary);
  margin-bottom: 24px;
}

.start-screening-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.start-screening-button:hover {
  background-color: var(--primary-color-darken);
}

.screening-table-container {
  padding: 0;
  overflow-x: auto;
}

.screening-table {
  width: 100%;
  border-collapse: collapse;
}

.screening-table th {
  text-align: left;
  padding: 12px 20px;
  font-weight: 600;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.screening-table td {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: var(--text-color);
}

.screening-table tr:last-child td {
  border-bottom: none;
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

.score-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-bar {
  flex: 1;
  height: 8px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow: hidden;
}

.score-progress {
  height: 100%;
  border-radius: 4px;
}

.score-excellent {
  background-color: #28a745;
}

.score-good {
  background-color: #5cb85c;
}

.score-average {
  background-color: #ffc107;
}

.score-below-average {
  background-color: #fd7e14;
}

.score-poor {
  background-color: #dc3545;
}

.score-value {
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.table-action-button {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  color: var(--text-color-secondary);
}

.table-action-button:hover {
  border-color: var(--primary-color);
  background-color: rgba(var(--primary-color-rgb), 0.05);
  color: var(--primary-color);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background-color: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dialog-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dialog-body {
  padding: 20px;
}

.store-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.form-group input, .form-group select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-group input:focus, .form-group select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.cancel-button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cancel-button:hover {
  border-color: var(--text-color);
}

.submit-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.submit-button:hover {
  background-color: var(--primary-color-darken);
}

.submit-button:disabled {
  background-color: var(--primary-color-lighten);
  cursor: not-allowed;
}

.delete-dialog .dialog-content {
  max-width: 450px;
}

.delete-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}

.delete-warning i {
  font-size: 3rem;
  color: var(--error-color);
  margin-bottom: 16px;
  opacity: 0.8;
}

.delete-warning p {
  margin-bottom: 8px;
  color: var(--text-color);
}

.warning-text {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.delete-confirm-button {
  background-color: var(--error-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.delete-confirm-button:hover {
  background-color: #d32f2f;
}

.delete-confirm-button:disabled {
  background-color: #ef9a9a;
  cursor: not-allowed;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-wrap: wrap;
  }
  
  .dialog-content {
    width: 90%;
  }
  
  .table-actions {
    flex-direction: column;
  }
}
</style>