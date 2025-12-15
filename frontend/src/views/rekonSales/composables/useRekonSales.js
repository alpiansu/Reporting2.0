import { ref, reactive } from "vue";
import rekonSalesApi from "@/services/rekonSales.service.js";
import { useToastService } from "@/utils/toast";

/**
 * useRekonSales manages state and data fetching for Rekon Sales
 */
export function useRekonSales() {
  const toast = useToastService();

  const now = new Date();
  const filters = reactive({
    cabang: "All",
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  });
  const summary = ref(null);
  const stores = ref([]);
  const pagination = reactive({ page: 1, limit: 10, total: 0 });
  const sortColumn = ref("KDTK");
  const sortOrder = ref("ASC");
  const searchQuery = ref("");
  const loading = ref(false);

  const fetchSummary = async () => {
    try {
      const res = await rekonSalesApi.getSummary({ cabang: filters.cabang, month: filters.month, year: filters.year });
      summary.value = res?.data;
    } catch (err) {
      toast.showError("Error", err.message || "Gagal memuat ringkasan");
    }
  };

  const normalizeStoreData = storesArr => {
    return (storesArr || []).map(store => ({
      ...store,
      CABANG: store?.CABANG ?? store?.CAB ?? store?.cabang ?? store?.cab ?? "Unknown",
      CAB: store?.CAB ?? store?.CABANG ?? store?.cabang ?? store?.cab ?? "Unknown",
    }));
  };

  const fetchStores = async () => {
    loading.value = true;
    try {
      const res = await rekonSalesApi.getResumePerShop({
        cabang: filters.cabang,
        month: filters.month,
        year: filters.year,
        page: pagination.page,
        limit: pagination.limit,
        searchQuery: searchQuery.value || undefined,
        sortColumn: sortColumn.value,
        sortOrder: sortOrder.value,
      });
      const rawStores = Array.isArray(res?.data?.data) ? res.data.data : [];
      stores.value = normalizeStoreData(rawStores);
      pagination.total = res?.data?.total ?? 0;
      pagination.page = res?.data?.page ?? pagination.page;
      pagination.limit = res?.data?.limit ?? pagination.limit;
    } catch (err) {
      toast.showError("Error", err.message || "Gagal memuat data toko");
    } finally {
      loading.value = false;
    }
  };

  const fetchStoreDetails = async ({ kdtk }) => {
    return await rekonSalesApi.getStoreDetails({ kdtk, month: filters.month, year: filters.year });
  };

  const fetchDifferences = async ({ kdtk, page = 1, limit = 100 }) => {
    return await rekonSalesApi.getDifferences({ kdtk, month: filters.month, year: filters.year, page, limit });
  };

  const fetchKodePesananIssues = async ({ kdtk }) => {
    return await rekonSalesApi.getKodePesananIssues({ kdtk, month: filters.month, year: filters.year });
  };

  const updateNote = async ({ cabang, kdtk, tanggal, noteText }) => {
    return await rekonSalesApi.updateNote({ cabang, kdtk, tanggal, noteText });
  };

  const refreshAll = async () => {
    const results = await Promise.allSettled([fetchSummary(), fetchStores()]);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`refreshAll failed at step ${i}:`, r.reason);
    });
  };

  return {
    filters,
    summary,
    stores,
    pagination,
    sortColumn,
    sortOrder,
    searchQuery,
    loading,
    fetchSummary,
    fetchStores,
    fetchStoreDetails,
    fetchDifferences,
    fetchKodePesananIssues,
    updateNote,
    refreshAll,
  };
}
