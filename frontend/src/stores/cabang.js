import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { mCabangService } from "../services";

export const useCabangStore = defineStore("cabang", () => {
  // State
  const cabangList = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const initialized = ref(false);

  // Getters
  const allCabang = computed(() => {
    // Jika cabangList kosong dan belum diinisialisasi, fetch data cabang
    if (cabangList.value.length === 0 && !initialized.value && !loading.value) {
      // Gunakan setTimeout untuk menghindari infinite loop
      setTimeout(() => {
        fetchCabang();
      }, 0);
    }
    return cabangList.value;
  });
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
      error.value = err.message || "Gagal memuat data cabang";
      console.error("Error fetching cabang data:", err);
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

  // Helper function untuk mendapatkan nama cabang berdasarkan kode cabang
  function getCabangName(kdcab) {
    // Jika kode cabang kosong atau "SEMUA", kembalikan "Semua Cabang"
    if (!kdcab || kdcab === "SEMUA") {
      return "Semua Cabang";
    }
    
    // Cari cabang berdasarkan kode
    const cabang = cabangList.value.find(c => c.kdcab === kdcab);
    
    // Jika cabang ditemukan, kembalikan nama cabang, jika tidak kembalikan kode cabang
    return cabang ? cabang.namacab : kdcab;
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
    refreshCabang,
    getCabangName,
  };
});
