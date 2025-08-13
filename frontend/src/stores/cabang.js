import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { mCabangService } from '../services';

export const useCabangStore = defineStore('cabang', () => {
  // State
  const cabangList = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const initialized = ref(false);

  // Getters
  const allCabang = computed(() => cabangList.value);
  const isInitialized = computed(() => initialized.value);

  // Actions
  async function fetchCabang() {
    // Jika data sudah diinisialisasi, tidak perlu fetch lagi
    if (initialized.value) return cabangList.value;
    
    try {
      loading.value = true;
      error.value = null;
      
      const response = await mCabangService.getAllCabang();
      cabangList.value = response.data.data;
      initialized.value = true;
      
      return cabangList.value;
    } catch (err) {
      error.value = err.message || 'Gagal memuat data cabang';
      console.error('Error fetching cabang data:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Force refresh data cabang
  async function refreshCabang() {
    initialized.value = false;
    return await fetchCabang();
  }

  return {
    // State
    cabangList,
    loading,
    error,
    initialized,
    
    // Getters
    allCabang,
    isInitialized,
    
    // Actions
    fetchCabang,
    refreshCabang
  };
});