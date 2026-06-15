import { ref, onMounted } from "vue";
import rekonSalesApi from "@/services/rekonSales.service.js";
import { useAuthStore } from "@/stores";
import { useToastService } from "@/utils/toast";

export function useScreening() {
  const isReconciling = ref(false);
  const isMassScreening = ref(false);
  const currentTaskId = ref(null);
  const toast = useToastService();
  const authStore = useAuthStore();

  onMounted(() => {
    currentTaskId.value = getTaskId();
  });

  const getTaskId = () => {
    const fallbackUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    })();
    const username = authStore?.user?.username || fallbackUser?.username || "";
    return username ? `rekonSalesTask_${username}` : null;
  };

  const screenCabang = async ({ cabang, periode, force = false }) => {
    try {
      isMassScreening.value = true;
      isReconciling.value = true;
      const params = { cabang, periode };
      if (force) params.force = true;
      // Non-blocking trigger
      rekonSalesApi.screening(params).catch(err => {
        console.error("Screening trigger error (non-blocking):", err);
      });
      toast.showInfo("Info", "Screening dimulai");
    } catch (err) {
      isReconciling.value = false;
      isMassScreening.value = false;
      toast.showError("Error", err.message || "Gagal memulai screening");
    }
  };

  const screenStore = async ({ kdtk, periode }) => {
    try {
      isMassScreening.value = false;
      isReconciling.value = true;
      await rekonSalesApi.screenStore(kdtk, periode);
    } catch (err) {
      toast.showError("Error", err.message || "Gagal re-screen toko");
    } finally {
      isReconciling.value = false;
    }
  };

  return { isReconciling, isMassScreening, currentTaskId, screenCabang, screenStore };
}
