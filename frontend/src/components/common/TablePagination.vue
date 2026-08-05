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

<style scoped src="./TablePagination.style.css"></style>