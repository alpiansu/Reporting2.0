// src/pages/PrepClosing/composables/usePrepClosing.js

import { ref, computed } from "vue";
import prepClosingApi from "@/services/prepClosing.service.js";

export function usePrepClosing() {
  // State
  const loading = ref(false);
  const error = ref(null);
  const summary = ref(null);
  const stores = ref([]);
  const selectedStore = ref(null);
  const categories = ref([]);
  const rulesSummary = ref([]);
  const selectedRuleKeys = ref([]);

  // Pagination
  const pagination = ref({
    currentPage: 1,
    itemsPerPage: 10,
    total: 0,
    totalPages: 0,
  });

  // Sorting
  const sortColumn = ref("KDTK");
  const sortOrder = ref("ASC");

  // Search
  const searchQuery = ref("");

  // Computed
  const hasData = computed(() => stores.value.length > 0);

  const readyPercentage = computed(() => {
    if (!summary.value || summary.value.total_stores === 0) return 0;
    return (summary.value.ready_stores / summary.value.total_stores) * 100;
  });

  // Methods
  const fetchSummary = async (periode, cabang) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await prepClosingApi.getSummary(periode, cabang);
      summary.value = response.data.data;
    } catch (err) {
      error.value = err.response?.data?.message || "Gagal memuat summary";
      console.error("Error fetching summary:", err);
    } finally {
      loading.value = false;
    }
  };

  const fetchRulesSummary = async (periode, cabang) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await prepClosingApi.getRulesSummary(periode, cabang);
      rulesSummary.value = response.data.data || [];
    } catch (err) {
      error.value = err.response?.data?.message || "Gagal memuat rules summary";
      console.error("Error fetching rules summary:", err);
    } finally {
      loading.value = false;
    }
  };

  const fetchStores = async (periode, cabang, params = {}) => {
    try {
      loading.value = true;
      error.value = null;

      // Update internal state jika ada sorting baru
      if (params.sortColumn !== undefined) {
        sortColumn.value = params.sortColumn;
      }
      if (params.sortOrder !== undefined) {
        sortOrder.value = params.sortOrder;
      }
      if (params.searchQuery !== undefined) {
        searchQuery.value = params.searchQuery;
      }

      const response = await prepClosingApi.getResumePerShop({
        periode,
        cabang,
        page: params.page || pagination.value.currentPage,
        limit: params.limit || pagination.value.itemsPerPage,
        sortColumn: params.sortColumn || sortColumn.value,
        sortOrder: params.sortOrder || sortOrder.value,
        searchQuery: params.searchQuery || searchQuery.value,
        ruleKeys: params.ruleKeys !== undefined ? params.ruleKeys : selectedRuleKeys.value,
      });

      stores.value = response.data.data;
      pagination.value = {
        currentPage: response.data.page,
        itemsPerPage: response.data.limit,
        total: response.data.total,
        totalPages: response.data.totalPages,
      };
    } catch (err) {
      error.value = err.response?.data?.message || "Gagal memuat data toko";
      console.error("Error fetching stores:", err);
    } finally {
      loading.value = false;
    }
  };

  const fetchStoreDetails = async (kdtk, periode) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await prepClosingApi.getStoreDetails(kdtk, periode);
      selectedStore.value = response.data.data;
    } catch (err) {
      error.value = err.response?.data?.message || "Gagal memuat detail toko";
      console.error("Error fetching store details:", err);
    } finally {
      loading.value = false;
    }
  };

  const fetchCategories = async (periode, cabang) => {
    try {
      const response = await prepClosingApi.getIssuesByCategory(periode, cabang);
      categories.value = response.data.data.sort((a, b) => a.order - b.order);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const updateNote = async (cabang, kdtk, periode, noteText) => {
    try {
      const response = await prepClosingApi.updateNote({
        cabang,
        kdtk,
        periode,
        noteText,
      });

      // Update store in list
      const storeIndex = stores.value.findIndex(s => s.KDTK === kdtk);
      if (storeIndex !== -1) {
        // Force fully reactive update via object spread
        stores.value[storeIndex] = { ...stores.value[storeIndex], note: response };
        // Create new array reference to guarantee data table reactivity
        stores.value = [...stores.value];
      }

      // Update selected store if it's the same
      if (selectedStore.value && selectedStore.value.KDTK === kdtk) {
        selectedStore.value = { ...selectedStore.value, note: response };
      }

      return response;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Gagal menyimpan note");
    }
  };

  const refreshAll = async (periode, cabang, params = {}) => {
    await Promise.all([
      fetchSummary(periode, cabang),
      fetchRulesSummary(periode, cabang),
      fetchStores(periode, cabang, params),
      fetchCategories(periode, cabang),
    ]);
  };

  const isRuleSelected = key => selectedRuleKeys.value.includes(key);
  const toggleRuleSelection = key => {
    const idx = selectedRuleKeys.value.indexOf(key);
    if (idx >= 0) {
      selectedRuleKeys.value.splice(idx, 1);
    } else {
      selectedRuleKeys.value.push(key);
    }
  };
  const clearRuleSelection = () => {
    selectedRuleKeys.value = [];
  };

  const resetFilters = () => {
    searchQuery.value = "";
    sortColumn.value = "KDTK";
    sortOrder.value = "ASC";
    pagination.value.currentPage = 1;
  };

  return {
    // State
    loading,
    error,
    summary,
    stores,
    selectedStore,
    categories,
    rulesSummary,
    selectedRuleKeys,
    pagination,
    sortColumn,
    sortOrder,
    searchQuery,

    // Computed
    hasData,
    readyPercentage,

    // Methods
    fetchSummary,
    fetchRulesSummary,
    fetchStores,
    fetchStoreDetails,
    fetchCategories,
    updateNote,
    refreshAll,
    resetFilters,
    isRuleSelected,
    toggleRuleSelection,
    clearRuleSelection,
  };
}
