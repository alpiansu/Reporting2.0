<template>
  <div class="pagination-container">
    <div class="pagination-info">
      <span class="records-info">Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ totalItems }}
        data</span>
    </div>

    <div class="pagination-controls">
      <button @click="goToFirstPage" :disabled="currentPage === 1" class="btn btn-icon"
        title="Halaman pertama">
        <i class="pi pi-angle-double-left"></i>
      </button>

      <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-icon" title="Halaman sebelumnya">
        <i class="pi pi-angle-left"></i>
      </button>

      <div class="page-numbers">
        <template v-for="pageNum in displayedPageNumbers" :key="pageNum">
          <button v-if="pageNum !== '...'" @click="goToPage(pageNum)"
            :class="['btn', 'btn-page', currentPage === pageNum ? 'btn-active' : '']">
            {{ pageNum }}
          </button>
          <span v-else class="ellipsis">...</span>
        </template>
      </div>

      <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-icon"
        title="Halaman selanjutnya">
        <i class="pi pi-angle-right"></i>
      </button>

      <button @click="goToLastPage" :disabled="currentPage === totalPages" class="btn btn-icon"
        title="Halaman terakhir">
        <i class="pi pi-angle-double-right"></i>
      </button>
    </div>

    <div class="items-per-page">
      <label for="items-per-page-select">Per halaman:</label>
      <select 
        id="items-per-page-select" 
        :value="itemsPerPage" 
        @change="$emit('update:itemsPerPage', parseInt($event.target.value))" 
        class="items-select"
      >
        <option v-for="option in itemsPerPageOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  totalItems: {
    type: Number,
    required: true
  },
  itemsPerPage: {
    type: Number,
    required: true
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [10, 25, 50, 100]
  }
});

const emit = defineEmits(['update:currentPage', 'update:itemsPerPage']);

const totalPages = computed(() => {
  return Math.ceil(props.totalItems / props.itemsPerPage);
});

const startIndex = computed(() => {
  return (props.currentPage - 1) * props.itemsPerPage;
});

const endIndex = computed(() => {
  return Math.min(startIndex.value + props.itemsPerPage, props.totalItems);
});

const displayedPageNumbers = computed(() => {
  const total = totalPages.value;
  const current = props.currentPage;
  const delta = 2; // Number of pages to show before and after current page
  
  if (total <= 7) {
    // If we have 7 or fewer pages, show all
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  
  // Always include first and last page
  let pages = [1];
  
  // Calculate start and end of the displayed range
  const rangeStart = Math.max(2, current - delta);
  const rangeEnd = Math.min(total - 1, current + delta);
  
  // Add ellipsis if needed before the range
  if (rangeStart > 2) {
    pages.push('...');
  }
  
  // Add all pages in the range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }
  
  // Add ellipsis if needed after the range
  if (rangeEnd < total - 1) {
    pages.push('...');
  }
  
  // Add the last page
  if (total > 1) {
    pages.push(total);
  }
  
  return pages;
});

const goToPage = (page) => {
  emit('update:currentPage', page);
};

const prevPage = () => {
  if (props.currentPage > 1) {
    goToPage(props.currentPage - 1);
  }
};

const nextPage = () => {
  if (props.currentPage < totalPages.value) {
    goToPage(props.currentPage + 1);
  }
};

const goToFirstPage = () => {
  goToPage(1);
};

const goToLastPage = () => {
  goToPage(totalPages.value);
};
</script>

<style scoped>
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid #e9ecef;
  font-size: 0.875rem;
}

.pagination-info {
  color: #666;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  border: none;
  gap: 0.5rem;
  font-size: 0.875rem;
  background-color: #eceff1;
  color: #455a64;
}

.btn:hover {
  background-color: #cfd8dc;
}

.btn:active {
  transform: translateY(1px);
}

.btn-icon {
  padding: 0.25rem 0.5rem;
}

.btn-page {
  min-width: 2rem;
  height: 2rem;
  padding: 0;
}

.btn-active {
  background-color: var(--primary-color);
  color: white;
}

.btn:disabled {
  background-color: #b0bec5;
  cursor: not-allowed;
}

.ellipsis {
  padding: 0 0.5rem;
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.items-select {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: #f5f5f5;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 2rem;
}

.items-select:hover {
  border-color: #bbb;
  background-color: #fff;
}

.items-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
  background-color: #fff;
}

@media (max-width: 768px) {
  .pagination-container {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .items-per-page {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>