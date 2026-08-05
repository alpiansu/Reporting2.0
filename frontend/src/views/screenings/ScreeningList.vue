<template>
  <div class="screening-list">
    <div class="page-header">
      <h1 class="page-title">Screenings</h1>
      <div class="header-actions">
        <div class="search-container">
          <i class="pi pi-search search-icon"></i>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search screenings..."
            class="search-input"
            @input="handleSearch"
          />
          <button 
            v-if="searchQuery" 
            class="clear-search" 
            @click="clearSearch"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
        <button class="new-screening-button" @click="openNewScreeningDialog">
          <i class="pi pi-plus"></i>
          New Screening
        </button>
      </div>
    </div>
    
    <div class="filters-container">
      <div class="filter-group">
        <label>Status</label>
        <div class="filter-options">
          <button 
            class="filter-option" 
            :class="{ active: selectedStatus === 'all' }" 
            @click="filterByStatus('all')"
          >
            All
          </button>
          <button 
            class="filter-option" 
            :class="{ active: selectedStatus === 'completed' }" 
            @click="filterByStatus('completed')"
          >
            Completed
          </button>
          <button 
            class="filter-option" 
            :class="{ active: selectedStatus === 'in progress' }" 
            @click="filterByStatus('in progress')"
          >
            In Progress
          </button>
          <button 
            class="filter-option" 
            :class="{ active: selectedStatus === 'pending' }" 
            @click="filterByStatus('pending')"
          >
            Pending
          </button>
        </div>
      </div>
      
      <div class="filter-group">
        <label>Store</label>
        <select v-model="selectedStore" class="store-filter" @change="filterByStore">
          <option value="all">All Stores</option>
          <option v-for="store in stores" :key="store.id" :value="store.id">
            {{ store.name }}
          </option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>Date Range</label>
        <div class="date-range-inputs">
          <input 
            type="date" 
            v-model="dateRange.from" 
            class="date-input"
            @change="filterByDateRange"
          />
          <span class="date-separator">to</span>
          <input 
            type="date" 
            v-model="dateRange.to" 
            class="date-input"
            @change="filterByDateRange"
          />
        </div>
      </div>
      
      <button class="reset-filters" @click="resetFilters">
        <i class="pi pi-filter-slash"></i>
        Reset Filters
      </button>
    </div>
    
    <div v-if="loading" class="loading-container">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Loading screenings...</p>
    </div>
    
    <div v-else-if="filteredScreenings.length === 0" class="empty-state">
      <i class="pi pi-chart-bar"></i>
      <h2>No Screenings Found</h2>
      <p v-if="hasActiveFilters">No screenings match your current filters. Try adjusting your filters or create a new screening.</p>
      <p v-else>There are no screenings in the system yet. Start by creating your first screening.</p>
      <button class="start-screening-button" @click="openNewScreeningDialog">
        <i class="pi pi-plus"></i>
        Create New Screening
      </button>
    </div>
    
    <div v-else class="screenings-grid">
      <div 
        v-for="screening in filteredScreenings" 
        :key="screening.id"
        class="screening-card"
        @click="viewScreeningDetails(screening.id)"
      >
        <div class="card-header">
          <div class="store-info">
            <h3 class="store-name">{{ screening.storeName }}</h3>
            <span class="screening-date">{{ formatDate(screening.date) }}</span>
          </div>
          <span class="status-badge" :class="getStatusClass(screening.status)">
            {{ screening.status }}
          </span>
        </div>
        
        <div class="card-body">
          <div class="score-section">
            <div class="score-label">Overall Score</div>
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
          </div>
          
          <div class="screening-details">
            <div class="detail-item">
              <i class="pi pi-user"></i>
              <span>{{ screening.conductedBy }}</span>
            </div>
            <div class="detail-item">
              <i class="pi pi-check-square"></i>
              <span>{{ screening.completedSections }} / {{ screening.totalSections }} sections</span>
            </div>
            <div class="detail-item">
              <i class="pi pi-calendar"></i>
              <span>{{ formatTime(screening.date) }}</span>
            </div>
          </div>
        </div>
        
        <div class="card-footer">
          <button 
            class="action-button view-button"
            @click.stop="viewScreeningDetails(screening.id)"
          >
            <i class="pi pi-eye"></i>
            View
          </button>
          <button 
            v-if="screening.status !== 'Completed'"
            class="action-button continue-button"
            @click.stop="continueScreening(screening.id)"
          >
            <i class="pi pi-pencil"></i>
            Continue
          </button>
          <button 
            v-else
            class="action-button download-button"
            @click.stop="downloadReport(screening.id)"
          >
            <i class="pi pi-download"></i>
            Report
          </button>
        </div>
      </div>
    </div>
    
    <!-- New Screening Dialog -->
    <div v-if="showNewScreeningDialog" class="dialog-overlay" @click="closeNewScreeningDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>New Screening</h2>
          <button class="close-button" @click="closeNewScreeningDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="startNewScreening" class="screening-form">
            <div class="form-group">
              <label for="storeSelect">Select Store</label>
              <select id="storeSelect" v-model="newScreening.storeId" required>
                <option value="" disabled>Choose a store</option>
                <option v-for="store in stores" :key="store.id" :value="store.id">
                  {{ store.name }}
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="screeningDate">Screening Date</label>
              <input 
                id="screeningDate" 
                type="datetime-local" 
                v-model="newScreening.date" 
                required
              />
            </div>
            
            <div class="form-group">
              <label for="conductedBy">Conducted By</label>
              <input 
                id="conductedBy" 
                type="text" 
                v-model="newScreening.conductedBy" 
                placeholder="Enter name of person conducting screening"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="screeningTemplate">Screening Template</label>
              <select id="screeningTemplate" v-model="newScreening.templateId" required>
                <option value="" disabled>Select a template</option>
                <option v-for="template in screeningTemplates" :key="template.id" :value="template.id">
                  {{ template.name }}
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="screeningNotes">Notes (Optional)</label>
              <textarea 
                id="screeningNotes" 
                v-model="newScreening.notes" 
                placeholder="Add any additional notes or context"
                rows="3"
              ></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" @click="closeNewScreeningDialog">Cancel</button>
              <button type="submit" class="submit-button" :disabled="isSubmitting">
                <span v-if="!isSubmitting">Start Screening</span>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// State
const screenings = ref([]);
const stores = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedStatus = ref('all');
const selectedStore = ref('all');
const dateRange = ref({
  from: '',
  to: ''
});
const showNewScreeningDialog = ref(false);
const isSubmitting = ref(false);
const newScreening = ref({
  storeId: '',
  date: new Date().toISOString().slice(0, 16),
  conductedBy: '',
  templateId: '',
  notes: ''
});

// Mock data for screening templates
const screeningTemplates = ref([
  { id: 1, name: 'Standard Store Audit' },
  { id: 2, name: 'Health & Safety Inspection' },
  { id: 3, name: 'Visual Merchandising Review' },
  { id: 4, name: 'Inventory Management Audit' }
]);

// Fetch data
onMounted(async () => {
  try {
    // In a real app, these would be API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock stores data
    stores.value = [
      { id: 1, name: 'Store Alpha' },
      { id: 2, name: 'Store Beta' },
      { id: 3, name: 'Store Gamma' },
      { id: 4, name: 'Store Delta' },
      { id: 5, name: 'Store Epsilon' }
    ];
    
    // Mock screenings data
    screenings.value = [
      {
        id: 101,
        storeId: 1,
        storeName: 'Store Alpha',
        date: '2023-11-28T09:00:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 92,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 98,
        storeId: 2,
        storeName: 'Store Beta',
        date: '2023-11-25T13:45:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 88,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 95,
        storeId: 3,
        storeName: 'Store Gamma',
        date: '2023-11-22T09:30:00',
        conductedBy: 'Jane Smith',
        status: 'In Progress',
        score: 45,
        completedSections: 5,
        totalSections: 10
      },
      {
        id: 92,
        storeId: 4,
        storeName: 'Store Delta',
        date: '2023-11-20T10:15:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 95,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 85,
        storeId: 1,
        storeName: 'Store Alpha',
        date: '2023-09-15T10:30:00',
        conductedBy: 'Jane Smith',
        status: 'Completed',
        score: 88,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 82,
        storeId: 3,
        storeName: 'Store Gamma',
        date: '2023-08-30T11:15:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 78,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 78,
        storeId: 4,
        storeName: 'Store Delta',
        date: '2023-08-15T13:30:00',
        conductedBy: 'Jane Smith',
        status: 'Completed',
        score: 92,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 76,
        storeId: 2,
        storeName: 'Store Beta',
        date: '2023-08-12T10:00:00',
        conductedBy: 'Jane Smith',
        status: 'Completed',
        score: 82,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 67,
        storeId: 3,
        storeName: 'Store Gamma',
        date: '2023-06-05T14:45:00',
        conductedBy: 'Jane Smith',
        status: 'Completed',
        score: 80,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 64,
        storeId: 1,
        storeName: 'Store Alpha',
        date: '2023-06-22T14:15:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 95,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 63,
        storeId: 4,
        storeName: 'Store Delta',
        date: '2023-05-22T09:45:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 90,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 54,
        storeId: 2,
        storeName: 'Store Beta',
        date: '2023-05-18T15:30:00',
        conductedBy: 'John Doe',
        status: 'Completed',
        score: 85,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 48,
        storeId: 4,
        storeName: 'Store Delta',
        date: '2023-02-18T14:00:00',
        conductedBy: 'Jane Smith',
        status: 'Completed',
        score: 88,
        completedSections: 10,
        totalSections: 10
      },
      {
        id: 42,
        storeId: 1,
        storeName: 'Store Alpha',
        date: '2023-03-10T11:45:00',
        conductedBy: 'Jane Smith',
        status: 'Completed',
        score: 90,
        completedSections: 10,
        totalSections: 10
      }
    ];
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    loading.value = false;
  }
});

// Computed properties
const filteredScreenings = computed(() => {
  let result = [...screenings.value];
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(screening => 
      screening.storeName.toLowerCase().includes(query) ||
      screening.conductedBy.toLowerCase().includes(query) ||
      screening.status.toLowerCase().includes(query)
    );
  }
  
  // Filter by status
  if (selectedStatus.value !== 'all') {
    result = result.filter(screening => 
      screening.status.toLowerCase() === selectedStatus.value.toLowerCase()
    );
  }
  
  // Filter by store
  if (selectedStore.value !== 'all') {
    result = result.filter(screening => 
      screening.storeId === parseInt(selectedStore.value)
    );
  }
  
  // Filter by date range
  if (dateRange.value.from) {
    const fromDate = new Date(dateRange.value.from);
    fromDate.setHours(0, 0, 0, 0);
    result = result.filter(screening => 
      new Date(screening.date) >= fromDate
    );
  }
  
  if (dateRange.value.to) {
    const toDate = new Date(dateRange.value.to);
    toDate.setHours(23, 59, 59, 999);
    result = result.filter(screening => 
      new Date(screening.date) <= toDate
    );
  }
  
  // Sort by date (newest first)
  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return result;
});

const hasActiveFilters = computed(() => {
  return (
    searchQuery.value !== '' ||
    selectedStatus.value !== 'all' ||
    selectedStore.value !== 'all' ||
    dateRange.value.from !== '' ||
    dateRange.value.to !== ''
  );
});

// Methods
const handleSearch = () => {
  // In a real app, you might want to debounce this
  console.log('Searching for:', searchQuery.value);
};

const clearSearch = () => {
  searchQuery.value = '';
};

const filterByStatus = (status) => {
  selectedStatus.value = status;
};

const filterByStore = () => {
  console.log('Filtering by store:', selectedStore.value);
};

const filterByDateRange = () => {
  console.log('Filtering by date range:', dateRange.value);
};

const resetFilters = () => {
  searchQuery.value = '';
  selectedStatus.value = 'all';
  selectedStore.value = 'all';
  dateRange.value = {
    from: '',
    to: ''
  };
};

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

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleTimeString(undefined, options);
};

const viewScreeningDetails = (screeningId) => {
  router.push(`/screenings/${screeningId}`);
};

const continueScreening = (screeningId) => {
  router.push(`/screenings/${screeningId}/edit`);
};

const downloadReport = (screeningId) => {
  // In a real app, this would download a PDF report
  console.log('Downloading report for screening:', screeningId);
};

const openNewScreeningDialog = () => {
  showNewScreeningDialog.value = true;
};

const closeNewScreeningDialog = () => {
  showNewScreeningDialog.value = false;
  // Reset form
  newScreening.value = {
    storeId: '',
    date: new Date().toISOString().slice(0, 16),
    conductedBy: '',
    templateId: '',
    notes: ''
  };
};

const startNewScreening = async () => {
  isSubmitting.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get store name for the selected store
    const selectedStoreObj = stores.value.find(store => store.id === parseInt(newScreening.value.storeId));
    
    // Create a new screening object
    const newScreeningObj = {
      id: Math.floor(Math.random() * 1000) + 200, // Generate a random ID
      storeId: parseInt(newScreening.value.storeId),
      storeName: selectedStoreObj.name,
      date: newScreening.value.date,
      conductedBy: newScreening.value.conductedBy,
      status: 'In Progress',
      score: 0,
      completedSections: 0,
      totalSections: 10
    };
    
    // Add to screenings list (in a real app, this would be handled by the API)
    screenings.value.unshift(newScreeningObj);
    
    // Close dialog and navigate to the new screening
    closeNewScreeningDialog();
    router.push(`/screenings/${newScreeningObj.id}/edit`);
  } catch (error) {
    console.error('Error creating screening:', error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped src="./ScreeningList.style.css"></style>