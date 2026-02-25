<template>
  <div class="rekon-persediaan-view">
    <PageHeader title="Rekon Persediaan" subtitle="Rekonsiliasi HPP Store vs WRC (Monthly)" />
    
    <div class="view-content">
      <div class="card screening-form-card">
        <RekonPersediaanForm @view-results="handleViewResults" @screening-started="handleScreeningStarted" />
      </div>

      <div class="results-section mt-4">
        <RekonPersediaanTable ref="rekonTable" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import RekonPersediaanForm from './components/RekonPersediaanForm.vue';
import RekonPersediaanTable from './components/RekonPersediaanTable.vue';
import './RekonPersediaan.style.css';

const rekonTable = ref(null);

const handleViewResults = (filters) => {
  if (rekonTable.value) {
    rekonTable.value.refresh(filters);
  }
};

const handleScreeningStarted = () => {
  // Logic after screening starts
};
</script>

<style scoped>
.rekon-persediaan-view {
  padding: 1.5rem;
}
.screening-form-card {
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
</style>
